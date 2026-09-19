import { CohortStatus, MessageChannel, PrismaClient } from "@prisma/client";

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

  // No admin row to seed: the single admin is ADMIN_EMAIL, checked at sign-in.
  // No testimonial either — the landing hides the section while there is none.
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
