import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import Stripe from "stripe";

/**
 * The whole prospect journey, on a 360 px handset (CLAUDE.md, étape 8):
 * scanner → result on screen → discovery call → registration offer →
 * payment confirmed by the Stripe webhook.
 *
 * Runs against a real MySQL (see .github/workflows/ci.yml). Google Calendar
 * is replaced by lib/calendar/stub.ts (E2E_CALENDAR_STUB=1); Stripe is
 * exercised through its webhook signature only, never its network API; e-mails
 * are logged, not sent (no RESEND_API_KEY).
 */

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const prospect = { firstName: "Awa", lastName: "Testeur", email: `e2e-${stamp}@example.test` };

let resultToken = "";

test("scanner : 11 questions, consentement, résultat immédiat", async ({ page }) => {
  await page.goto("/scanner");

  // The wizard shows the chosen option for a beat (160 ms) before moving on, so
  // each answer waits for its question to be on screen: two consecutive
  // questions answered "Oui" would otherwise receive the same click twice.
  const answer = async (question: RegExp, option: string | RegExp) => {
    await expect(page.getByRole("heading", { name: question })).toBeVisible();
    await page.getByRole("button", { name: option, exact: typeof option === "string" }).click();
  };

  // 1. Experience first — the hook question (Ben, 21/09/2026).
  await answer(/années d'expérience/i, "5 ans ou plus");
  await answer(/situation professionnelle/i, "En poste");
  await answer(/diplôme académique/i, "Oui");
  // Certifications: none.
  await answer(/certifications possédez-vous/i, /aucune, continuer/i);
  // Domains: five of the eight.
  await expect(page.getByRole("heading", { name: /domaines du CISSP/i })).toBeVisible();
  for (const label of [
    "Sécurité et gestion des risques",
    "Sécurité des actifs",
    "Architecture et ingénierie de sécurité",
    "Sécurité des communications et des réseaux",
    "Opérations de sécurité",
  ]) {
    await page.getByLabel(label).check();
  }
  await page.getByRole("button", { name: /^continuer/i }).click();
  await answer(/niveau en anglais/i, "4");
  await answer(/déjà passé l'examen/i, "Non, jamais");
  await answer(/quand souhaitez-vous passer/i, "Dans 3 à 6 mois");
  await answer(/inscription à .* envisageable/i, "Oui");
  await answer(/disponible pour la cohorte/i, "Oui");
  // Country last (Ben's decision): Cameroon → Africa tier, 625 USD.
  await expect(page.getByRole("heading", { name: /dans quel pays résidez-vous/i })).toBeVisible();
  await page.locator("#scanner-country").selectOption("CM");

  // Capture with an explicit, unchecked-by-default consent.
  await expect(page.getByRole("heading", { name: /votre résultat s'affiche tout de suite/i })).toBeVisible();
  const consent = page.locator("#consent");
  await expect(consent).not.toBeChecked();
  await page.locator("#fn").fill(prospect.firstName);
  await page.locator("#ln").fill(prospect.lastName);
  await page.locator("#em").fill(prospect.email);

  // Without consent the server refuses and nothing is stored.
  await page.getByRole("button", { name: /voir mon résultat/i }).click();
  await expect(page.getByText(/votre accord est nécessaire/i)).toBeVisible();
  expect(await prisma.lead.findUnique({ where: { email: prospect.email } })).toBeNull();

  await consent.check();
  await page.getByRole("button", { name: /voir mon résultat/i }).click();

  await expect(page).toHaveURL(/\/scanner\/resultat\/[A-Za-z0-9_-]+$/, { timeout: 30_000 });
  resultToken = page.url().split("/").pop()!;

  await expect(page.getByRole("heading", { level: 1 })).toContainText(prospect.firstName);
  await expect(page.getByText(/avec accompagnement/i)).toBeVisible();
  // The next slots are right on the page (stub calendar in CI), with the full picker one link away.
  await expect(page.getByText(/prochains créneaux/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /voir d’autres créneaux/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /rejoindre la cohorte/i })).toBeVisible();

  const lead = await prisma.lead.findUniqueOrThrow({ where: { email: prospect.email } });
  expect(lead.consentAt).not.toBeNull();

  // The tunnel is measured: the questionnaire and its result left events behind.
  await expect.poll(async () => prisma.funnelEvent.count({ where: { leadId: lead.id, name: "scanner_submit" } })).toBe(1);
  await expect.poll(async () => prisma.funnelEvent.count({ where: { name: "scanner_step", step: 11 } })).toBeGreaterThan(0);
  await expect.poll(async () => prisma.funnelEvent.count({ where: { name: "result_view" } })).toBeGreaterThan(0);
  expect(lead.country).toBe("CM");
  expect(lead.tier).toBe("africa");
  expect(lead.readiness).toBe("ready");
});

test("réservation : un créneau réel, confirmé, enregistré", async ({ page }) => {
  await page.goto(`/rdv?t=${resultToken}`);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(`${prospect.firstName}, choisissez votre créneau.`);
  await expect(page.getByText(/heures affichées dans votre fuseau/i)).toBeVisible();

  // Slots are the buttons labelled with a time; the first one is chosen.
  const slot = page.getByRole("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
  await slot.click();
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /confirmer ce créneau/i }).click();

  await expect(page).toHaveURL(/\/rdv\/confirme\?t=/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`${prospect.firstName}, à`);
  await expect(page.getByRole("link", { name: /lien de la visio/i })).toBeVisible();

  const lead = await prisma.lead.findUniqueOrThrow({ where: { email: prospect.email }, include: { bookings: true } });
  expect(lead.status).toBe("booked");
  expect(lead.bookings).toHaveLength(1);
  expect(lead.bookings[0].startsAt.getTime()).toBeGreaterThan(Date.now());
});

test("inscription : ouverte à un profil prêt, fermée sans jeton, offre au bon palier", async ({ page }) => {
  // No token, no offer: the registration only opens through an analysis.
  await page.goto("/inscription");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/commencez par votre analyse/i);

  // A "ready" profile registers without waiting for Ben's message (brainstorm 24/09).
  await page.goto(`/inscription?t=${resultToken}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`${prospect.firstName}, réservez votre place.`);
  await expect(page.getByText(/625/)).toBeVisible();
  await expect(page.getByText(/FCFA/)).toBeVisible();
  await expect(page.getByText(/places? restantes?/)).toBeVisible();
  await expect(page.getByRole("button", { name: /payer par carte bancaire/i })).toBeVisible();
});

test("paiement : seul le webhook Stripe signé rend la place payée", async ({ page, request }) => {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { email: prospect.email } });
  const cohort = await prisma.cohort.findFirstOrThrow({ where: { status: "open" }, orderBy: { startsAt: "asc" } });

  // What "Payer par carte bancaire" opens before redirecting to Stripe
  // (lib/registration.ts startRegistration) — Checkout itself needs Stripe's API.
  const reference = `CB-E2E-${stamp.toString(36).toUpperCase().slice(-4)}`;
  const registration = await prisma.registration.create({
    data: { leadId: lead.id, cohortId: cohort.id, tier: "africa", amountUsd: 62_500, method: "stripe", reference },
  });
  expect(registration.status).toBe("pending");

  // Stripe's return page never marks anything paid.
  await page.goto(`/inscription/merci?ref=${reference}`);
  await expect(page.getByText(/paiement en cours de confirmation/i)).toBeVisible();
  expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).status).toBe("pending");

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  expect(secret, "STRIPE_WEBHOOK_SECRET doit être défini pour ce test").toBeTruthy();
  const event = {
    id: `evt_e2e_${stamp}`,
    object: "event",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    api_version: "2024-06-20",
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: {
      object: {
        id: `cs_e2e_${stamp}`,
        object: "checkout.session",
        payment_status: "paid",
        amount_total: 62_500,
        currency: "usd",
        client_reference_id: reference,
        metadata: { reference, registrationId: String(registration.id) },
      },
    },
  };
  const body = JSON.stringify(event);

  // A tampered signature is refused and changes nothing.
  const forged = await request.post("/api/webhooks/stripe", {
    data: body,
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
  });
  expect(forged.status()).toBe(400);
  expect((await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).status).toBe("pending");

  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: secret! });
  const accepted = await request.post("/api/webhooks/stripe", {
    data: body,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  });
  expect(accepted.status()).toBe(200);
  expect(await accepted.json()).toMatchObject({ received: true, alreadyPaid: false });

  const paid = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
  expect(paid.status).toBe("paid");
  expect(await prisma.funnelEvent.count({ where: { leadId: lead.id, name: "paid" } })).toBe(1);
  expect(paid.paidAt).not.toBeNull();
  expect(paid.stripeSessionId).toBe(`cs_e2e_${stamp}`);
  expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("registered");

  await page.goto(`/inscription/merci?ref=${reference}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/votre place dans la .* est réservée/i);

  // A replayed webhook is acknowledged without a second confirmation.
  const replay = await request.post("/api/webhooks/stripe", {
    data: body,
    headers: { "content-type": "application/json", "stripe-signature": signature },
  });
  expect(await replay.json()).toMatchObject({ received: true, alreadyPaid: true });
});

/**
 * Consulting (docs/OFFRES.md): the catalogue is priced by country, the order
 * page shows the service, and a paid order (confirmed through the same signed
 * Stripe webhook) opens the session-booking page on the consulting windows.
 */
test("un prospect « pas encore » achète une heure de conseil et réserve sa séance", async ({ page, request }) => {
  await page.goto("/conseil");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/une heure avec ben/i);
  await page.locator("#service-country").selectOption("CM");
  await expect(page.getByText(/bilan de carrière cybersécurité/i).first()).toBeVisible();
  await expect(page.getByText(/^60 USD/).first()).toBeVisible();

  await page.goto("/conseil/bilan?pays=CM");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/bilan de carrière/i);
  // Slot first, payment after (Ben, 24/09): the picker opens the page, the payment form waits behind it.
  await expect(page.getByRole("heading", { name: /choisissez votre créneau/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /retenir ce créneau/i })).toBeVisible();

  // The order itself, as the server action would create it, then the webhook.
  const stamp = Date.now();
  const lead = await prisma.lead.create({
    data: { firstName: "Moussa", lastName: "Conseil", email: `e2e-conseil-${stamp}@example.com`, country: "CM", tier: "africa", consentAt: new Date(), source: "conseil", unsubscribeToken: `unsub-${stamp}` },
  });
  const order = await prisma.serviceOrder.create({
    data: { leadId: lead.id, serviceCode: "bilan", tier: "africa", amountUsd: 6_000, method: "stripe", reference: `CS-E2E-${stamp.toString(36).toUpperCase().slice(-4)}`, sessionsTotal: 1, bookingToken: `book-${stamp}` },
  });

  await page.goto(`/conseil/rdv/${order.bookingToken}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/paiement en attente/i);

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = JSON.stringify({
    id: `evt_cs_${stamp}`, object: "event", type: "checkout.session.completed", created: Math.floor(stamp / 1000), api_version: "2024-06-20", livemode: false, pending_webhooks: 0, request: null,
    data: { object: { id: `cs_e2e_conseil_${stamp}`, object: "checkout.session", payment_status: "paid", amount_total: 6_000, client_reference_id: order.reference, metadata: { reference: order.reference } } },
  });
  const accepted = await request.post("/api/webhooks/stripe", {
    data: body,
    headers: { "content-type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: body, secret: secret! }) },
  });
  expect(accepted.status()).toBe(200);
  expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("paid");
  expect(await prisma.funnelEvent.count({ where: { leadId: lead.id, name: "service_paid" } })).toBe(1);

  await page.goto(`/conseil/merci?ref=${order.reference}`);
  await expect(page.getByRole("link", { name: /choisir mon créneau/i })).toBeVisible();

  await page.goto(`/conseil/rdv/${order.bookingToken}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/choisissez votre créneau/i);
  const slot = page.getByRole("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
  await expect(slot).toBeVisible();
  await slot.click();
  await page.getByRole("button", { name: /confirmer ce créneau/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Moussa, à");

  const booking = await prisma.booking.findFirstOrThrow({ where: { serviceOrderId: order.id } });
  expect(booking.kind).toBe("consulting");
  expect(booking.endsAt.getTime() - booking.startsAt.getTime()).toBe(60 * 60_000);

  // The credited hour comes off the bootcamp price on the registration page.
  const response = await prisma.scannerResponse.create({
    data: { leadId: lead.id, answers: {}, readiness: "ready", heatScore: 50, analysis: {}, coachMessage: "", status: "approved", resultToken: `res-${stamp}` },
  });
  await page.goto(`/inscription?t=${response.resultToken}`);
  await expect(page.getByText(/votre heure de conseil/i)).toBeVisible();
  await expect(page.getByText(/= 565 USD/)).toBeVisible();
});

/**
 * The entry step (docs/OFFRES.md §3): /demarrer sells the seeded CC session,
 * the registration lands on the CC cohort (never the bootcamp's), and the
 * signed webhook confirms it with the CC receipt wording.
 */
test("un débutant s'inscrit à la formation CC depuis /demarrer", async ({ page, request }) => {
  await page.goto("/demarrer");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/première certification/i);
  await page.locator("#program-country").selectOption("CM");
  await expect(page.getByText(/^149 USD/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /réserver ma place/i })).toBeVisible();

  await page.goto("/demarrer/inscription?pays=CM");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/réservez votre place/i);
  await expect(page.getByText(/Session CC/)).toBeVisible();
  await expect(page.getByRole("button", { name: /payer par carte bancaire · 149 USD/i })).toBeVisible();

  const stamp = Date.now();
  const lead = await prisma.lead.create({
    data: { firstName: "Aïcha", lastName: "Debut", email: `e2e-cc-${stamp}@example.com`, country: "CM", tier: "africa", consentAt: new Date(), source: "demarrer", unsubscribeToken: `unsub-cc-${stamp}` },
  });
  // The pending registration the server action opens, on the seeded CC session.
  const ccCohort = await prisma.cohort.findFirstOrThrow({ where: { program: "cc", status: "open" }, orderBy: { startsAt: "asc" } });
  const ccPrice = await prisma.programPrice.findUniqueOrThrow({ where: { program_tier: { program: "cc", tier: "africa" } } });
  expect(ccPrice.amountUsd).toBe(14_900);
  const registration = await prisma.registration.create({
    data: { leadId: lead.id, cohortId: ccCohort.id, tier: "africa", amountUsd: ccPrice.amountUsd, method: "stripe", reference: `CB-CC${stamp.toString(36).toUpperCase().slice(-2)}-E2E1` },
  });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = JSON.stringify({
    id: `evt_cc_${stamp}`, object: "event", type: "checkout.session.completed", created: Math.floor(stamp / 1000), api_version: "2024-06-20", livemode: false, pending_webhooks: 0, request: null,
    data: { object: { id: `cs_e2e_cc_${stamp}`, object: "checkout.session", payment_status: "paid", amount_total: 14_900, client_reference_id: registration.reference, metadata: { reference: registration.reference } } },
  });
  const accepted = await request.post("/api/webhooks/stripe", {
    data: body,
    headers: { "content-type": "application/json", "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: body, secret: secret! }) },
  });
  expect(accepted.status()).toBe(200);
  const paid = await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } });
  expect(paid.status).toBe("paid");
  expect(paid.cohortId).toBe(registration.cohortId);

  const receipt = await request.get(`/inscription/recu/${registration.reference}`);
  expect(receipt.status()).toBe(200);
  expect(receipt.headers()["content-type"]).toContain("application/pdf");
});

/** The free contact starts with the slot; the questionnaire confirms it (Ben, 24/09). */
test("premier contact : le créneau d'abord, le profil ensuite", async ({ page }) => {
  await page.goto("/rdv");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/15 minutes avec ben, gratuites/i);
  const slot = page.getByRole("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
  await expect(slot).toBeVisible();
  await slot.click();
  await page.getByRole("button", { name: /retenir ce créneau, puis mon profil/i }).click();
  await expect(page).toHaveURL(/\/scanner\?suite=rdv/);
  await expect(page.getByText(/créneau retenu/i)).toBeVisible();
});
