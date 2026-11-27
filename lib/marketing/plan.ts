import { randomBytes } from "node:crypto";
import { iaUrl } from "@/lib/ia-domain";

/**
 * Cohort marketing (Ben, 28/09): what the admin marketing page computes
 * without the model. Pure, so it is tested and Ben can retune it.
 */

export const CHANNELS = {
  linkedin: { label: "LinkedIn", utmSource: "linkedin", format: "Post LinkedIn, visuel 1080 × 1350 (4:5)" },
  whatsapp_status: { label: "Statut WhatsApp", utmSource: "whatsapp", format: "Statut WhatsApp, visuel vertical 1080 × 1920 (9:16)" },
  whatsapp_group: { label: "Groupe WhatsApp", utmSource: "whatsapp", format: "Message de groupe WhatsApp, visuel carré 1080 × 1080" },
  tiktok: { label: "TikTok (vidéo)", utmSource: "tiktok", format: "Vidéo TikTok verticale 9:16, 15 à 30 secondes" },
} as const;
export type Channel = keyof typeof CHANNELS;

export const ANGLES = {
  test: "Testez-vous : 5 questions d'entraînement CISSP corrigées",
  eligibilite: "Suis-je éligible ? L'analyse de profil en 3 minutes",
  places: "Places limitées, date de clôture",
  emploi: "Compatible avec un emploi (soirs, mercredi lecture, week-ends)",
  associate: "Sans les 5 ans : le titre Associate of ISC²",
  mobile_money: "Paiement simple par carte, y compris depuis Orange Money (carte Visa virtuelle Max it)",
  conseil_du_jour: "Le réflexe CISSP du jour (raisonner en manager)",
  cc: "Débuter : la certification CC en 15 jours",
  coach: "Un coach qui tient le rythme avec vous",
} as const;
export type Angle = keyof typeof ANGLES;

/**
 * The one art direction every visual brief follows, so the posts read as one
 * brand. Taken from the site's charter (docs/DESIGN.md).
 */
export const ART_DIRECTION = [
  "Direction artistique « Nuit et vert », identique sur tous les canaux :",
  "- Fond bleu nuit #071A33, un seul accent vert #17B890, blanc cassé #F7F8F6 ; rien d'autre.",
  "- Typographie Inter Tight très grasse pour le titre (un seul mot ou chiffre en vert), Inter pour le reste. Beaucoup d'espace vide.",
  "- Photographie réelle, jamais d'illustration générique : professionnels africains francophones de la cybersécurité, 30 à 45 ans, en contexte de travail crédible (bureau, salle de réunion, datacenter), lumière naturelle chaude, regard assuré.",
  "- Interdits : capuche de hacker, code vert façon Matrix, cadenas 3D, globe numérique, bouclier brillant, stock photo souriant face caméra.",
  "- Signature graphique : une fine ligne verte de progression en 15 points (les 15 jours), et « CISSP Bootcamp » en bas à gauche.",
  "- Vidéo : plans lents et stables, caméra à l'épaule discrète, étalonnage froid dans les ombres et chaud sur la peau, texte à l'écran court en Inter Tight blanche, vert pour le mot clé.",
].join("\n");

/** Bâtisseur IA art direction (Ben, 04/11): the same colours, other people, other signature. */
export const IA_ART_DIRECTION = [
  "Direction artistique « Nuit et vert », version Bâtisseur IA :",
  "- Fond bleu nuit #071A33, un seul accent vert #17B890, blanc cassé #F7F8F6 ; rien d'autre.",
  "- Typographie Inter Tight très grasse pour le titre (un seul mot ou chiffre en vert), Inter pour le reste. Beaucoup d'espace vide.",
  "- Photographie réelle, jamais d'illustration générique : entrepreneurs et indépendants africains francophones, 28 à 50 ans, dans leur activité (boutique, atelier, cabinet, bureau partagé, comptoir), un ordinateur portable ou un téléphone en main, lumière naturelle chaude, attitude concentrée et fière.",
  "- Interdits : robot, humanoïde, cerveau lumineux, visage en circuits, code vert façon Matrix, hologramme, main robotique, stock photo souriant face caméra.",
  "- Signature graphique : une fine ligne verte de progression en 6 points (les 6 journées), et « Bâtisseur IA » en bas à gauche.",
  "- Vidéo : plans lents et stables, caméra à l'épaule discrète, étalonnage froid dans les ombres et chaud sur la peau, texte à l'écran court en Inter Tight blanche, vert pour le mot clé. Un écran peut apparaître flou, jamais lisible.",
].join("\n");

export function artDirectionFor(kind: MarketingKind): string {
  return kind === "ia" ? IA_ART_DIRECTION : ART_DIRECTION;
}

/**
 * Where a post sends people (Ben, 29/09): the free practice test, playful and
 * shareable, or the profile analysis, which qualifies. The test page then
 * leads to the analysis, with the same tracking.
 */
export const DESTINATIONS = {
  scanner: { label: "Analyse de profil", path: "/scanner", forModel: "l'analyse de profil gratuite (11 questions, 3 minutes) : éligibilité, délai estimé, voie conseillée" },
  test: { label: "Test CISSP (5 questions)", path: "/test", forModel: "un test gratuit de 5 questions d'entraînement originales, au niveau et dans l'esprit du CISSP, corrigées, sans compte, en 10 minutes ; il mène ensuite à l'analyse de profil" },
  conseil: { label: "Conseil carrière", path: "/conseil", forModel: "les séances de conseil carrière de Ben (bilan de carrière, évolution vers le management ou le poste de RSSI, reconversion…), payantes, avec prise de rendez-vous en ligne" },
  cohorte: { label: "Inscription à la cohorte", path: "/", forModel: "la page du bootcamp : programme, rythme, prix selon le pays et inscription à la prochaine cohorte" },
  devis: { label: "Demande de devis (entreprises)", path: "/entreprises?formation=cissp", forModel: "la page des formations CISSP et CC pour les entreprises : une session réservée à une équipe, sur site ou en ligne, à leurs dates, avec un formulaire de demande de devis" },
} as const;

/** Where a Bâtisseur IA post sends people (Ben, 04/11). */
export const IA_DESTINATIONS = {
  ia_diagnostic: { label: "Diagnostic IA", path: "/ia/diagnostic", forModel: "le diagnostic d'autonomie gratuit (5 questions, 3 minutes), pour une activité ou un projet : où en est l'entreprise (projet, manuel, assisté) et les trois tâches à mettre en pilote automatique d'abord" },
  ia_page: { label: "Page Bâtisseur IA", path: "/ia", forModel: "la page du Bâtisseur IA : bâtir son entreprise autonome avec l'IA, programme des 6 journées le week-end (chacune met une fonction de l'entreprise en pilote automatique), prix selon le pays, prochaines dates d'entrée" },
  ia_inscription: { label: "Inscription IA", path: "/ia/inscription", forModel: "l'inscription au Bâtisseur IA : choix de la date d'entrée (J1), paiement par carte bancaire" },
  ia_devis: { label: "Demande de devis (entreprises)", path: "/ia/entreprises", forModel: "la page Bâtisseur IA Entreprises : l'équipe met l'IA au travail dans l'entreprise, un processus après l'autre (diagnostic, pilote, déploiement, suivi), avec une demande de devis et un appel de 30 minutes" },
} as const;

export const ALL_DESTINATIONS = { ...DESTINATIONS, ...IA_DESTINATIONS } as const;
export type Destination = keyof typeof ALL_DESTINATIONS;

/**
 * Two audiences (Ben, 04/11): the certifications (CISSP and CC) speak to
 * IT and security people; Bâtisseur IA speaks to business owners. Each has
 * its pillars, link destinations, art direction and follow-ups.
 */
export type MarketingKind = "cert" | "ia";
export const marketingKind = (program: string): MarketingKind => (program === "ia" ? "ia" : "cert");

/** The angle's natural destination: the test angle opens the test. */
export function defaultDestination(angle: Angle): Destination {
  return angle === "test" ? "test" : "scanner";
}

/**
 * Editorial pillars (Ben, 29/09; rewritten 27/11): posts that make people
 * who are not yet in training say « tiens, c'est intéressant » — notions
 * explained, career, why get certified, why a bootcamp, the field's trends —
 * not the course's own method, which is for those already enrolled. These
 * are the slots and their defaults; Ben edits labels, intents, examples,
 * destinations and weights in Marketing › Ligne éditoriale (lib/marketing/editorial.ts).
 */
export const PILLARS = {
  decouverte: { label: "Le saviez-vous ?", destination: "cohorte", examples: ["C'est quoi la GIA (gestion des identités et des accès) ?", "La triade confidentialité, intégrité, disponibilité en trois exemples du quotidien", "RTO et RPO : la différence en une minute"] },
  carriere: { label: "Carrière cyber", destination: "cohorte", examples: ["RSSI, GRC, SOC, pentest : les métiers de la cybersécurité expliqués", "Passer de la technique au management de la sécurité", "Ce qu'un recruteur regarde dans un profil cyber"] },
  tendances: { label: "Tendances du domaine", destination: "cohorte", examples: ["Ce que les lois sur les données personnelles changent pour les entreprises", "L'IA générative : nouveaux risques, nouveaux rôles en sécurité", "Le zero trust, au-delà du mot à la mode"] },
  certification: { label: "Pourquoi se certifier", destination: "cohorte", examples: ["Ce que le CISSP dit de vous à un employeur", "CISSP, CISM ou CC : à chacun son moment", "Le titre Associate of ISC² : certifié avant les 5 ans d'expérience"] },
  bootcamp: { label: "Pourquoi un bootcamp", destination: "cohorte", examples: ["Se préparer seul ou accompagné : ce qui change", "Pourquoi une préparation courte et intensive", "Ce qu'apporte un groupe qui avance au même rythme"] },
  entreprises: { label: "Former une équipe", destination: "devis", examples: ["Pourquoi former toute une équipe à la gouvernance de la sécurité", "Ce qu'un manager gagne à parler le même langage que son RSSI", "Former ses équipes ou recruter : comparer honnêtement"] },
  offre: { label: "Offre et cohorte", destination: "cohorte", examples: ["Places limitées, date de clôture", "Paiement par carte, même depuis Orange Money", "Un coach qui tient le rythme avec vous"] },
} as const satisfies Record<string, { label: string; destination: Destination; examples: readonly string[] }>;

/** Bâtisseur IA pillars (Ben, 04/11; rewritten 27/11 in the same spirit): curiosity and interest first, the offer about one post in ten. */
export const IA_PILLARS = {
  ia_decouverte: { label: "Le saviez-vous ? (IA)", destination: "ia_page", examples: ["C'est quoi un agent IA, en une phrase ?", "Comment une IA peut répondre à partir de vos propres documents", "Une API expliquée avec l'exemple d'une boutique"] },
  cas_usage: { label: "Cas d'usage", destination: "ia_page", examples: ["Relancer ses prospects sans y penser", "Savoir qui a payé, sans chercher", "Des devis et factures en un clic"] },
  autonome: { label: "L'entreprise autonome", destination: "ia_page", examples: ["Une entreprise autonome, ce n'est pas une entreprise sans humains", "Manuel, assisté, autonome : où en est votre entreprise ?", "Ce qu'une entreprise peut confier à l'IA, et ce qu'elle garde"] },
  ia_tendances: { label: "Tendances IA et entreprise", destination: "ia_page", examples: ["Ce que les nouveaux modèles d'IA changent pour une petite entreprise", "Paiement en ligne et mobile money : ce qui s'automatise", "Ce qu'une petite entreprise peut automatiser aujourd'hui"] },
  ia_pourquoi: { label: "Pourquoi bâtir soi-même", destination: "ia_page", examples: ["Agence, logiciel du marché ou sur mesure : comparer honnêtement", "Ne pas savoir coder n'empêche plus de construire", "Garder la main sur son propre système"] },
  ia_bootcamp: { label: "Pourquoi un bootcamp", destination: "ia_page", examples: ["Apprendre en construisant son propre projet", "Six journées le week-end : pourquoi ce format", "Avancer en groupe, avec d'autres entrepreneurs"] },
  garde_fous: { label: "Bons réflexes", destination: "ia_page", examples: ["Ne jamais confier ses mots de passe à une IA", "Relire ce que l'IA a écrit avant de publier", "Commencer petit : une tâche, puis la suivante"] },
  ia_entreprises: { label: "L'IA dans votre entreprise", destination: "ia_devis", examples: ["Ce qu'une PME peut confier à l'IA dès ce mois-ci", "Garder ses données chez soi : l'IA installée dans vos locaux", "Un processus automatisé, mesuré, avec un interrupteur"] },
  offre: { label: "Offre et dates", destination: "ia_inscription", examples: ["Les prochaines entrées J1", "6 journées le week-end, aux dates de votre choix", "Paiement par carte, même depuis Orange Money"] },
} as const satisfies Record<string, { label: string; destination: Destination; examples: readonly string[] }>;

/** Pillars of posts kept before 27/11, read as today's closest pillar. */
const LEGACY_PILLARS: Record<string, string> = { methode: "decouverte", eligibilite: "certification", candidat: "bootcamp", construire: "ia_pourquoi", outils: "ia_decouverte", entrepreneur: "cas_usage" };

export type Pillar = keyof typeof PILLARS | keyof typeof IA_PILLARS;
export const ALL_PILLARS: Record<Pillar, { label: string; destination: Destination; examples: readonly string[] }> = { ...PILLARS, ...IA_PILLARS };

export function pillarsFor(kind: MarketingKind): Record<string, { label: string; destination: Destination; examples: readonly string[] }> {
  return kind === "ia" ? IA_PILLARS : PILLARS;
}

export function destinationsFor(kind: MarketingKind): Record<string, { label: string; path: string; forModel: string }> {
  return kind === "ia" ? IA_DESTINATIONS : DESTINATIONS;
}

/** Post formats, with what the model must produce and where they fit. */
export const FORMATS = {
  standard: { label: "Post classique", channels: ["linkedin", "whatsapp_status", "whatsapp_group", "tiktok"], rule: "Accroche, développement court, une seule action." },
  notion: { label: "« C'est quoi… ? »", channels: ["linkedin", "whatsapp_status", "whatsapp_group", "tiktok"], rule: "Une seule notion du domaine (un sigle, un concept, un métier), expliquée simplement avec un exemple concret de la vie d'une entreprise, en quelques phrases. L'accroche est la question « C'est quoi, au juste, … ? ». Se termine par une invitation à en apprendre plus." },
  le_saviez_vous: { label: "Le saviez-vous ?", channels: ["linkedin", "whatsapp_status", "whatsapp_group", "tiktok"], rule: "Un fait surprenant mais vrai et vérifiable du domaine (une origine, une règle méconnue, une idée reçue corrigée), puis pourquoi il compte, en quelques phrases. Aucun chiffre qui ne soit pas fourni ou établi." },
  cas: { label: "Mini-cas « Que feriez-vous ? »", channels: ["linkedin", "whatsapp_group", "tiktok"], rule: "Une situation de manager sécurité en 3 à 5 phrases, une question à choix (A, B, C, D), invitation à répondre en commentaire ; la réponse commentée sera donnée plus tard. Pas de réponse dans le post." },
  mythe: { label: "Mythe ou réalité", channels: ["linkedin", "whatsapp_status", "whatsapp_group", "tiktok"], rule: "Une idée reçue répandue, puis la réalité, expliquée simplement." },
  erreur: { label: "Erreur fréquente", channels: ["linkedin", "whatsapp_group", "tiktok"], rule: "Une erreur fréquente des candidats ou des professionnels, pourquoi elle coûte, comment l'éviter." },
  comparatif: { label: "Comparatif", channels: ["linkedin", "whatsapp_group"], rule: "Deux options côte à côte (certifications, parcours, méthodes) : pour qui, ce que ça demande, ce que ça apporte. Honnête, sans dénigrer." },
  checklist: { label: "Checklist en 5 points", channels: ["linkedin", "whatsapp_status", "whatsapp_group"], rule: "Cinq points courts et concrets, numérotés." },
  carrousel: { label: "Carrousel LinkedIn", channels: ["linkedin"], rule: "Le texte du post, puis le contenu de 6 à 8 diapositives dans le brief visuel (une idée par diapositive, titre de 6 mots au plus)." },
  sondage: { label: "Sondage LinkedIn", channels: ["linkedin"], rule: "Une question et 4 réponses de 30 caractères au plus, écrites à la fin du texte sous « Options du sondage : », puis une phrase qui annonce le lien." },
  coulisses: { label: "Coulisses du métier", channels: ["linkedin", "whatsapp_status", "tiktok"], rule: "Un moment vrai de la vie de coach ou du métier de la sécurité (une question souvent posée, une observation, une idée qui surprend), sans détailler la méthode de la formation, sans inventer d'élève, de chiffre ni de témoignage." },
  face_camera: { label: "Face caméra « 3 conseils en 30 s »", channels: ["tiktok"], rule: "Script parlé par Ben face caméra : une accroche, trois conseils, une action. Le storyboard suit le script." },
  pov: { label: "« POV » TikTok", channels: ["tiktok"], rule: "Format « POV : vous … » mis en scène, situation reconnaissable par un candidat ou un professionnel de la cyber." },
} as const satisfies Record<string, { label: string; channels: readonly Channel[]; rule: string }>;
export type Format = keyof typeof FORMATS;

/** Formats whose rule speaks to certification candidates get an IA version. */
const IA_FORMAT_RULES: Partial<Record<Format, string>> = {
  cas: "Une situation d'entrepreneur en 3 à 5 phrases (une tâche répétitive qui coûte du temps), une question à choix (A, B, C, D) sur la façon de l'automatiser, invitation à répondre en commentaire ; la réponse commentée sera donnée plus tard. Pas de réponse dans le post.",
  erreur: "Une erreur fréquente quand on veut automatiser son entreprise ou utiliser l'IA (tout faire d'un coup, ne pas relire, confier ses secrets), pourquoi elle coûte, comment l'éviter.",
  comparatif: "Deux options côte à côte (logiciel du marché, agence, application sur mesure construite avec Claude Code, ne rien changer) : pour qui, ce que ça demande, ce que ça coûte. Honnête, sans dénigrer.",
  coulisses: "Ce qui se passe réellement dans le Bâtisseur IA, ou dans la construction de ce site avec Claude Code, sans inventer de participant, de chiffre ni de témoignage.",
  pov: "Format « POV : vous … » mis en scène, situation reconnaissable par un entrepreneur ou un indépendant (relances oubliées, devis à refaire, WhatsApp débordé).",
};

export function formatRule(format: Format, kind: MarketingKind): string {
  return (kind === "ia" && IA_FORMAT_RULES[format]) || FORMATS[format].rule;
}

export function formatsFor(channel: Channel): Format[] {
  return (Object.keys(FORMATS) as Format[]).filter((f) => (FORMATS[f].channels as readonly Channel[]).includes(channel));
}

/** Share of selling posts above which the balance warns: about one in five. */
export const MAX_OFFER_SHARE = 0.25;

export type BalancePost = { pillar: string | null; angle: string; destination: string };

/** Old posts carry no pillar: their angle says what they were. */
export function pillarOf(p: BalancePost, kind: MarketingKind = "cert"): Pillar {
  if (p.pillar && p.pillar in pillarsFor(kind)) return p.pillar as Pillar;
  const legacy = p.pillar ? LEGACY_PILLARS[p.pillar] : undefined;
  if (legacy && legacy in pillarsFor(kind)) return legacy as Pillar;
  if (kind === "ia") return "offre";
  if (p.angle === "conseil_du_jour" || p.angle === "test") return "decouverte";
  if (p.angle === "associate" || p.angle === "eligibilite") return "certification";
  if (p.angle === "emploi") return "bootcamp";
  return "offre";
}

/**
 * The editorial balance of the last posts: counts by pillar and by
 * destination, and one line of advice when it leans too much one way.
 */
export function editorialBalance(posts: BalancePost[], kind: MarketingKind = "cert", line?: Record<string, { label: string; weight: number }>): { byPillar: Record<Pillar, number>; byDestination: Record<Destination, number>; advice: string | null } {
  const base = pillarsFor(kind) as Record<string, { label: string }>;
  // Ben's own names, and only the pillars he keeps on (weight above 0), when his editorial line is given.
  const pillars = line ? Object.fromEntries(Object.keys(base).filter((k) => (line[k]?.weight ?? 1) > 0 || k === "offre").map((k) => [k, { label: line[k]?.label ?? base[k]!.label }])) : base;
  const byPillar = Object.fromEntries(Object.keys(base).map((k) => [k, 0])) as Record<Pillar, number>;
  const byDestination = Object.fromEntries(Object.keys(destinationsFor(kind)).map((k) => [k, 0])) as Record<Destination, number>;
  for (const p of posts) {
    byPillar[pillarOf(p, kind)]++;
    if (p.destination in byDestination) byDestination[p.destination as Destination]++;
  }
  if (posts.length === 0) return { byPillar, byDestination, advice: kind === "ia" ? "Aucun post sur 30 jours : commencez par un « Le saviez-vous ? » ou un cas d'usage." : "Aucun post sur 30 jours : commencez par un « Le saviez-vous ? » ou un post carrière." };
  const missing = (Object.keys(pillars) as Pillar[]).filter((k) => k !== "offre" && byPillar[k] === 0);
  const firstValue = missing[0] ?? Object.keys(pillars).find((k) => k !== "offre") ?? "offre";
  let advice: string | null = null;
  if (posts.length >= 3 && byPillar.offre / posts.length > MAX_OFFER_SHARE) advice = `${byPillar.offre} posts de vente sur ${posts.length} : place à la valeur, par exemple « ${pillars[firstValue]!.label} ».`;
  else if (missing.length > 0 && posts.length >= 4) advice = `Pas encore de post « ${pillars[missing[0]!]!.label} » ce mois-ci.`;
  return { byPillar, byDestination, advice };
}

/**
 * Prospects' own words, made safe to hand to the model for topic ideas:
 * no e-mail, no phone number, no link, short. Names are never sent; a first
 * name typed inside the text is the only thing this cannot catch, which is
 * why the model is told never to quote these texts.
 */
export function anonymize(text: string, max = 220): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]")
    .replace(/https?:\/\/\S+/g, "[lien]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[numéro]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export const POST_CODE_PATTERN = /^[a-z]{2}-[a-f0-9]{6}$/;

/** A short, unique code for utm_content: channel prefix and random letters. */
export function newPostCode(channel: Channel, random = randomBytes(4)): string {
  const prefix = { linkedin: "li", whatsapp_status: "ws", whatsapp_group: "wg", tiktok: "tt" }[channel];
  return `${prefix}-${random.toString("hex").slice(0, 6)}`;
}

/** The link a post carries, tagged so the cockpit can credit it. */
export function trackedLink(appUrl: string, channel: Channel, cohortId: number | null, code: string, destination: Destination = "scanner"): string {
  const params = new URLSearchParams({
    utm_source: CHANNELS[channel].utmSource,
    utm_medium: "social",
    utm_campaign: cohortId ? `cohorte-${cohortId}` : "cohorte",
    utm_content: code,
  });
  const base = ALL_DESTINATIONS[destination].path;
  const path = `${base}${base.includes("?") ? "&" : "?"}${params.toString()}`;
  // Bâtisseur IA pages live on their own domain once it is set (lib/ia-domain.ts).
  return path.startsWith("/ia") ? iaUrl(path, appUrl) : `${appUrl}${path}`;
}

/** Replaces the [LIEN] placeholder the model writes with the tracked link. */
export function withLink(text: string, link: string): string {
  return text.includes("[LIEN]") ? text.split("[LIEN]").join(link) : `${text.trimEnd()}\n\n${link}`;
}

export type Pace = { remaining: number; daysLeft: number; label: string };

/** "4 places en 12 jours : une inscription tous les 3 jours." */
export function paceFor(remaining: number, admissionClosesAt: Date, now: Date): Pace {
  const daysLeft = Math.max(0, Math.ceil((admissionClosesAt.getTime() - now.getTime()) / 86_400_000));
  if (remaining <= 0) return { remaining: 0, daysLeft, label: "Cohorte complète." };
  if (daysLeft === 0) return { remaining, daysLeft, label: `${remaining} place${remaining > 1 ? "s" : ""} libre${remaining > 1 ? "s" : ""}, admissions closes.` };
  const every = daysLeft / remaining;
  const rhythm = every >= 2 ? `une inscription tous les ${Math.floor(every)} jours` : every >= 1 ? "une inscription par jour" : `${Math.ceil(remaining / daysLeft)} inscriptions par jour`;
  return { remaining, daysLeft, label: `${remaining} place${remaining > 1 ? "s" : ""} en ${daysLeft} jour${daysLeft > 1 ? "s" : ""} : ${rhythm}.` };
}

export type Signals = {
  pace: Pace;
  hotUnpaid: number;
  callsWithoutSeat: number;
  daysSinceLastPost: number | null;
  scansLast7Days: number;
  tests30?: number;
};

/** The day's short to-do, most useful first, at most three lines. */
export function recommendations(s: Signals): string[] {
  const out: string[] = [];
  if (s.pace.remaining === 0) return ["La cohorte est complète : préparez la suivante."];
  if (s.callsWithoutSeat > 0) out.push(`${s.callsWithoutSeat} personne${s.callsWithoutSeat > 1 ? "s" : ""} ont eu l'appel sans s'inscrire : relancez-les en premier (segment « Appel fait »).`);
  if (s.hotUnpaid > 0) out.push(`${s.hotUnpaid} prospect${s.hotUnpaid > 1 ? "s" : ""} chaud${s.hotUnpaid > 1 ? "s" : ""} sans place : un message personnel chacun.`);
  if (s.daysSinceLastPost === null || s.daysSinceLastPost >= 3) out.push(s.daysSinceLastPost === null ? "Aucune publication enregistrée pour cette cohorte : lancez un premier post LinkedIn." : `Pas de publication depuis ${s.daysSinceLastPost} jours : un post aujourd'hui.`);
  if (s.pace.daysLeft > 0 && s.pace.daysLeft <= 7) out.push(`Clôture dans ${s.pace.daysLeft} jour${s.pace.daysLeft > 1 ? "s" : ""} : angle « Places limitées » sur tous les canaux.`);
  if (s.scansLast7Days === 0) out.push("Aucune analyse de profil en 7 jours : partagez le lien de l'analyse (TikTok ou statut WhatsApp).");
  if (s.tests30 === 0) out.push("Aucun test d'entraînement en 30 jours : un post « Testez-vous » vers le test (TikTok ou statut WhatsApp).");
  return out.slice(0, 3);
}

// --- Segments of the follow-ups (Ben, 29/09) ----------------------------

/** Default of the adjustable score threshold, in percent: 3 good answers out of 5. */
export const DEFAULT_TEST_THRESHOLD = 60;

export type SegmentKey = "called" | "test_low" | "test_high" | "hot" | "associate" | "conseil" | "cc" | "ia_ready" | "ia_prepare";
export const IA_SEGMENTS = ["ia_ready", "ia_prepare"] as const;

export type LeadJourney = {
  hadCall: boolean;
  /** Latest practice test score, percent, if the lead took one. */
  testPercent: number | null;
  heatScore: number;
  readiness: string | null;
  /** From the analysis: the lead's own deadline is tighter than the estimate. */
  goalIsTight: boolean;
};

/**
 * One segment per lead, from what they actually did. The call comes first
 * (closest to paying), then the test score against Ben's threshold, then the
 * analysis. Tight deadlines and profiles not ready yet go to consulting or
 * the CC rather than the cohort.
 */
export function segmentOf(j: LeadJourney, threshold: number, hotThreshold: number): SegmentKey | null {
  if (j.hadCall) return "called";
  if (j.readiness === "not_yet") return "cc";
  if (j.testPercent !== null) return j.testPercent >= threshold ? "test_high" : "test_low";
  if (j.goalIsTight) return "conseil";
  if (j.heatScore >= hotThreshold) return "hot";
  if (j.readiness === "conditional") return "associate";
  return null; // ready but cold, no test, no call: nothing personal to say yet
}

/** Fewer than this many results and no figure is ever quoted: too fragile to publish. */
export const MIN_SAMPLE_FOR_STATS = 30;

export type TestStats = { count: number; averagePercent: number; threshold: number; atOrAbove: number };

/** Real figures the content may quote, or null below the minimum sample. */
export function publishableTestStats(percents: number[], threshold: number, minSample = MIN_SAMPLE_FOR_STATS): TestStats | null {
  if (percents.length < minSample) return null;
  const average = Math.round(percents.reduce((a, p) => a + p, 0) / percents.length);
  return { count: percents.length, averagePercent: average, threshold, atOrAbove: Math.round((percents.filter((p) => p >= threshold).length / percents.length) * 100) };
}

export type IaSignals = { pace: Pace; diagnosticsLast7Days: number; diagnosedUnpaid: number; daysSinceLastPost: number | null };

/** The Bâtisseur IA day's to-do (Ben, 04/11), at most three lines. */
export function iaRecommendations(s: IaSignals): string[] {
  if (s.pace.remaining === 0) return ["Cette entrée est complète : ouvrez la suivante dans Admin › Bâtisseur IA."];
  const out: string[] = [];
  if (s.diagnosedUnpaid > 0) out.push(`${s.diagnosedUnpaid} personne${s.diagnosedUnpaid > 1 ? "s ont" : " a"} fait le diagnostic sans s'inscrire : un message personnel chacune (relances ci-dessous).`);
  if (s.daysSinceLastPost === null || s.daysSinceLastPost >= 3) out.push(s.daysSinceLastPost === null ? "Aucune publication pour cette entrée : lancez un premier post, un cas d'usage vers le diagnostic." : `Pas de publication depuis ${s.daysSinceLastPost} jours : un post aujourd'hui.`);
  if (s.pace.daysLeft > 0 && s.pace.daysLeft <= 7) out.push(`Inscriptions closes dans ${s.pace.daysLeft} jour${s.pace.daysLeft > 1 ? "s" : ""} : un post « Offre et dates » sur tous les canaux.`);
  if (s.diagnosticsLast7Days === 0) out.push("Aucun diagnostic IA en 7 jours : partagez le lien du diagnostic (statut WhatsApp ou TikTok).");
  return out.slice(0, 3);
}
