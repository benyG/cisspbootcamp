import { CohortStatus, MessageChannel, PrismaClient } from "@prisma/client";

import { PROGRAM_PRICES } from "../lib/programs";
import { SERVICE_CATALOGUE } from "../lib/services";

const prisma = new PrismaClient();

/** Francophone Africa — tier `africa` (CADRAGE §3, §4). */
const AFRICA_COUNTRIES = [
  "BF", "BI", "BJ", "CD", "CF", "CG", "CI", "CM", "DJ", "DZ", "GA", "GN",
  "GQ", "HT", "KM", "MA", "MG", "ML", "MR", "MU", "NE", "RW", "SC", "SN",
  "TD", "TG", "TN",
];

/** Phase 2 markets — tier `international`, also the fallback for anywhere else. */
const INTERNATIONAL_COUNTRIES = [
  "AT", "AU", "BE", "CA", "CH", "DE", "DK", "ES", "FI", "FR", "GB", "IE",
  "IT", "LU", "NL", "NO", "NZ", "PT", "SE", "US",
];

const PRICING_TIERS = [
  {
    code: "africa",
    amountUsd: 62_500,
    countries: AFRICA_COUNTRIES,
    label: "Afrique francophone",
  },
  {
    code: "international",
    amountUsd: 120_000,
    countries: INTERNATIONAL_COUNTRIES,
    label: "International",
  },
  {
    code: "enterprise",
    amountUsd: 0,
    countries: [],
    label: "Entreprise (sur devis)",
  },
];

/**
 * Message bodies use {{placeholder}} markers. Ben edits them from
 * /admin/parametres (SPECS A9), so the wording here is only a starting point.
 */
const MESSAGE_TEMPLATES = [
  {
    key: "scanner_result",
    channel: MessageChannel.email,
    subject: "Votre diagnostic CISSP, {{prenom}}",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Voici le résultat de votre évaluation : {{verdict}}.\n\n" +
      "Le détail complet est ici : {{lien_resultat}}\n\n" +
      "Ben — Coach CISSP",
  },
  {
    key: "booking_confirmation",
    channel: MessageChannel.email,
    subject: "C'est confirmé : {{date_heure}}",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Notre appel de 15 minutes est fixé au {{date_heure}} ({{fuseau}}).\n" +
      "Lien de visio : {{lien_meet}}\n\n" +
      "Besoin de changer ? {{lien_reprogrammation}}\n\n" +
      "Ben — Coach CISSP",
  },
  {
    key: "booking_reminder_24h",
    channel: MessageChannel.email,
    subject: "Demain : notre appel de 15 minutes",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Petit rappel : nous nous parlons demain à {{date_heure}} ({{fuseau}}).\n" +
      "Lien de visio : {{lien_meet}}\n\n" +
      "Ben — Coach CISSP",
  },
  {
    key: "booking_reminder_1h",
    channel: MessageChannel.email,
    subject: "Dans 1 heure",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Notre appel commence dans une heure : {{lien_meet}}\n\n" +
      "Ben — Coach CISSP",
  },
  {
    key: "payment_confirmation",
    channel: MessageChannel.email,
    subject: "Votre place est réservée — {{cohorte}}",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Votre paiement est confirmé, votre place dans la {{cohorte}} est réservée.\n" +
      "Votre reçu est en pièce jointe.\n\n" +
      "Ben — Coach CISSP",
  },
  {
    key: "followup_scanner_j2",
    channel: MessageChannel.whatsapp,
    subject: null,
    body:
      "Bonjour {{prenom}}, Ben (coach CISSP). Vous avez fait le diagnostic il y a " +
      "deux jours. On prend 15 minutes pour en parler ? {{lien_rdv}}",
  },
  {
    key: "followup_scanner_j7",
    channel: MessageChannel.whatsapp,
    subject: null,
    body:
      "Bonjour {{prenom}}, je reviens vers vous une dernière fois. " +
      "Si le CISSP est toujours d'actualité : {{lien_rdv}}",
  },
  {
    key: "followup_after_call_j3",
    channel: MessageChannel.whatsapp,
    subject: null,
    body:
      "Bonjour {{prenom}}, suite à notre échange — où en êtes-vous de votre décision ? " +
      "Je garde une place pour la {{cohorte}}.",
  },
  {
    key: "onboarding_documents",
    channel: MessageChannel.email,
    subject: "Bienvenue dans la {{cohorte}} : vos documents de préparation",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Votre place dans la {{cohorte}} est confirmée, et la préparation commence maintenant. " +
      "Voici vos documents de préparation, en pièces jointes ou en lien :\n{{liste_documents}}\n\n" +
      "Lisez-les dans l'ordre, prenez des notes sur ce qui vous semble flou : nous en parlerons dès la première session.\n\n" +
      "Une question d'ici là ? Répondez simplement à ce message.\n\n" +
      "Ben — Coach CISSP",
  },
  {
    key: "unpaid_reminder_j1",
    channel: MessageChannel.email,
    subject: "Votre place n'est pas encore confirmée",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Votre inscription est enregistrée mais le paiement n'est pas finalisé. " +
      "Vous pouvez le reprendre ici : {{lien_paiement}}\n\n" +
      "Ben — Coach CISSP",
  },
  {
    key: "unpaid_reminder_j3",
    channel: MessageChannel.email,
    subject: "Dernier rappel : votre place expire",
    body:
      "Bonjour {{prenom}},\n\n" +
      "Sans paiement, votre place sera libérée pour la liste d'attente. " +
      "Finaliser : {{lien_paiement}}\n\n" +
      "Ben — Coach CISSP",
  },
  {
    key: "invite_to_book",
    channel: MessageChannel.whatsapp,
    subject: null,
    body:
      "Bonjour {{prenom}}, votre profil ressort bien sur le diagnostic CISSP. " +
      "Je vous propose 15 minutes pour en parler : {{lien_rdv}}",
  },
];

async function main() {
  for (const tier of PRICING_TIERS) {
    await prisma.pricingTier.upsert({
      where: { code: tier.code },
      update: {
        amountUsd: tier.amountUsd,
        countries: tier.countries,
        label: tier.label,
      },
      create: tier,
    });
  }
  console.log(`Paliers de prix : ${PRICING_TIERS.length}`);

  for (const template of MESSAGE_TEMPLATES) {
    await prisma.messageTemplate.upsert({
      where: { key: template.key },
      update: {},
      create: template,
    });
  }
  console.log(`Gabarits de messages : ${MESSAGE_TEMPLATES.length}`);

  // First commercial milestone (CADRAGE §10): cohort 1, January 2027.
  const cohortName = "Cohorte janvier 2027";
  const existing = await prisma.cohort.findFirst({ where: { name: cohortName } });
  if (!existing) {
    await prisma.cohort.create({
      data: {
        name: cohortName,
        startsAt: new Date("2027-01-11T18:00:00.000Z"),
        endsAt: new Date("2027-02-19T20:00:00.000Z"),
        capacity: 10,
        status: CohortStatus.open,
      },
    });
    console.log(`Cohorte créée : ${cohortName}`);
  } else {
    console.log(`Cohorte déjà présente : ${cohortName}`);
  }

  // Entry-level programme (docs/OFFRES.md §3): prices per tier, and a first
  // CC cohort so /demarrer sells from day one. Ben moves the dates in
  // /admin/cohortes; existing rows are never overwritten.
  for (const [program, prices] of Object.entries(PROGRAM_PRICES) as Array<["cc", Record<string, number>]>) {
    for (const [tier, amountUsd] of Object.entries(prices)) {
      await prisma.programPrice.upsert({ where: { program_tier: { program, tier } }, update: {}, create: { program, tier, amountUsd } });
    }
  }
  const ccCohortName = "Session CC novembre 2026";
  if (!(await prisma.cohort.findFirst({ where: { program: "cc" } }))) {
    await prisma.cohort.create({
      data: { program: "cc", name: ccCohortName, startsAt: new Date("2026-11-16T18:00:00.000Z"), endsAt: new Date("2026-11-30T20:00:00.000Z"), capacity: 15, status: CohortStatus.open },
    });
    console.log(`Cohorte CC créée : ${ccCohortName}`);
  }

  // Default availability (SPECS A3 example): weekday evenings, four slots.
  // Ben adjusts it from /admin/parametres; seed only if nothing is set.
  const rules = await prisma.availabilityRule.count();
  if (rules === 0) {
    await prisma.availabilityRule.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "18:00", end: "19:00" })),
    });
    console.log("Disponibilités par défaut : lundi–vendredi 18:00–19:00");
  }

  // Consulting catalogue (docs/OFFRES.md §2). Copy and prices are only a
  // starting point: Ben edits them from /admin/conseil, so existing rows keep
  // their values; a new service is added with its defaults.
  for (const service of SERVICE_CATALOGUE) {
    const { prices, ...definition } = service;
    await prisma.service.upsert({ where: { code: service.code }, update: {}, create: definition });
    for (const [tier, amountUsd] of Object.entries(prices)) {
      await prisma.servicePrice.upsert({
        where: { serviceCode_tier: { serviceCode: service.code, tier } },
        update: {},
        create: { serviceCode: service.code, tier, amountUsd },
      });
    }
  }
  console.log(`Services de conseil : ${SERVICE_CATALOGUE.length}`);

  // Consulting window: Wednesday, two hours (Ben, 24/09/2026). Seeded once;
  // Ben adjusts the hours from /admin/parametres/google.
  const consultingSeeded = await prisma.siteSetting.findUnique({ where: { key: "seed.consulting_rules" } });
  if (!consultingSeeded) {
    if ((await prisma.availabilityRule.count({ where: { kind: "consulting" } })) === 0) {
      await prisma.availabilityRule.create({ data: { kind: "consulting", weekday: 3, start: "18:00", end: "20:00" } });
      console.log("Plage conseil par défaut : mercredi 18:00–20:00");
    }
    await prisma.siteSetting.create({ data: { key: "seed.consulting_rules", value: { at: new Date().toISOString() } } });
  }

  // Starting exchange rates so local prices show before the first cron run.
  // Refreshed daily by /api/cron/rates; XAF/XOF follow the EUR peg.
  const eurPerUsd = 0.92;
  const seedRates: Record<string, number> = {
    EUR: eurPerUsd,
    XAF: eurPerUsd * 655.957,
    XOF: eurPerUsd * 655.957,
    CAD: 1.36,
    CHF: 0.88,
    MAD: 9.9,
    TND: 3.1,
  };
  for (const [currency, perUsd] of Object.entries(seedRates)) {
    await prisma.exchangeRate.upsert({ where: { currency }, create: { currency, perUsd }, update: {} });
  }
  console.log(`Taux de change initiaux : ${Object.keys(seedRates).length}`);

  // No admin row to seed: the single admin is ADMIN_EMAIL, checked at sign-in.
  // No testimonial either — the landing hides the section while there is none.
}

/**
 * The seed runs inside the Vercel build, right after the migrations. A one-
 * second network blip towards the database (seen on 22/09) must not fail a
 * whole deployment: retry a few times before giving up.
 */
async function withRetries<T>(task: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/Can't reach database server|ECONNRESET|ETIMEDOUT|Server has closed the connection/i.test(message) || attempt === attempts) throw error;
      const wait = attempt * 5_000;
      console.warn(`Base injoignable (tentative ${attempt}/${attempts}), nouvel essai dans ${wait / 1000} s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

withRetries(main)
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
