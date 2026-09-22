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

  // 1. Experience first — the hook question (Ben, 21/09/2026).
  await page.getByRole("button", { name: "5 ans ou plus" }).click();
  await page.getByRole("button", { name: "En poste" }).click();
  await page.getByRole("button", { name: "Oui", exact: true }).click();
  // Certifications: none.
  await page.getByRole("button", { name: /aucune, continuer/i }).click();
  // Domains: five of the eight.
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
  await page.getByRole("button", { name: "4", exact: true }).click();
  await page.getByRole("button", { name: "Non, jamais" }).click();
  await page.getByRole("button", { name: "Dans 3 à 6 mois" }).click();
  await page.getByRole("button", { name: "Oui", exact: true }).click();
  await page.getByRole("button", { name: "Oui", exact: true }).click();
  // Country last (Ben's decision): Cameroon → Africa tier, 625 USD.
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
  await expect(page.getByRole("link", { name: /réserver mon appel/i })).toBeVisible();

  const lead = await prisma.lead.findUniqueOrThrow({ where: { email: prospect.email } });
  expect(lead.consentAt).not.toBeNull();
  expect(lead.country).toBe("CM");
  expect(lead.tier).toBe("africa");
  expect(lead.readiness).toBe("ready");
});

test("réservation : un créneau réel, confirmé, enregistré", async ({ page }) => {
  await page.goto(`/rdv?t=${resultToken}`);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(`${prospect.firstName}, choisissez votre créneau.`);
  await expect(page.getByText(/heures affichées dans votre fuseau/i)).toBeVisible();

  const slot = page.getByRole("button", { pressed: false }).filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
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

test("inscription : fermée avant validation de Ben, offre au bon palier ensuite", async ({ page }) => {
  // The sales message is still waiting for Ben: the offer stays closed.
  await page.goto(`/inscription?t=${resultToken}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/commencez par votre analyse/i);

  // Ben validates the message in /admin/diagnostics → the link opens.
  await prisma.scannerResponse.update({ where: { resultToken }, data: { status: "approved" } });

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
