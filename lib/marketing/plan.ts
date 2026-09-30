import { randomBytes } from "node:crypto";

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
  mobile_money: "Paiement simple, y compris mobile money",
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
} as const;
export type Destination = keyof typeof DESTINATIONS;

/** The angle's natural destination: the test angle opens the test. */
export function defaultDestination(angle: Angle): Destination {
  return angle === "test" ? "test" : "scanner";
}

/**
 * Editorial pillars (Ben, 29/09): most posts give value (method, career,
 * choices), about one in five sells. Each pillar has a natural destination
 * for its single call to action, and a few subject ideas to start from.
 */
export const PILLARS = {
  methode: { label: "Méthode CISSP", destination: "test", examples: ["Raisonner en manager, pas en technicien", "Les pièges du format adaptatif", "Un domaine du CBK expliqué simplement"] },
  carriere: { label: "Carrière cyber", destination: "conseil", examples: ["Devenir RSSI : ce qui manque souvent au profil", "Passer de la technique à la GRC", "Se reconvertir dans la cybersécurité"] },
  certification: { label: "Choisir sa certification", destination: "scanner", examples: ["CISSP, CISM ou CC : par où commencer ?", "Ce que le CISSP change dans une carrière", "Certification ou expérience d'abord ?"] },
  eligibilite: { label: "Éligibilité", destination: "scanner", examples: ["Les 5 ans d'expérience : ce qui compte vraiment", "Le titre Associate of ISC²", "Les domaines qui valident l'expérience"] },
  candidat: { label: "Vie du candidat", destination: "cohorte", examples: ["Préparer le CISSP en travaillant", "Le mercredi lecture et les week-ends denses", "Gérer le stress du jour J"] },
  offre: { label: "Offre et cohorte", destination: "cohorte", examples: ["Places limitées, date de clôture", "Paiement par carte ou mobile money", "Un coach qui tient le rythme avec vous"] },
} as const satisfies Record<string, { label: string; destination: Destination; examples: readonly string[] }>;
export type Pillar = keyof typeof PILLARS;

/** Post formats, with what the model must produce and where they fit. */
export const FORMATS = {
  standard: { label: "Post classique", channels: ["linkedin", "whatsapp_status", "whatsapp_group", "tiktok"], rule: "Accroche, développement court, une seule action." },
  cas: { label: "Mini-cas « Que feriez-vous ? »", channels: ["linkedin", "whatsapp_group", "tiktok"], rule: "Une situation de manager sécurité en 3 à 5 phrases, une question à choix (A, B, C, D), invitation à répondre en commentaire ; la réponse commentée sera donnée plus tard. Pas de réponse dans le post." },
  mythe: { label: "Mythe ou réalité", channels: ["linkedin", "whatsapp_status", "whatsapp_group", "tiktok"], rule: "Une idée reçue répandue, puis la réalité, expliquée simplement." },
  erreur: { label: "Erreur fréquente", channels: ["linkedin", "whatsapp_group", "tiktok"], rule: "Une erreur fréquente des candidats ou des professionnels, pourquoi elle coûte, comment l'éviter." },
  comparatif: { label: "Comparatif", channels: ["linkedin", "whatsapp_group"], rule: "Deux options côte à côte (certifications, parcours, méthodes) : pour qui, ce que ça demande, ce que ça apporte. Honnête, sans dénigrer." },
  checklist: { label: "Checklist en 5 points", channels: ["linkedin", "whatsapp_status", "whatsapp_group"], rule: "Cinq points courts et concrets, numérotés." },
  carrousel: { label: "Carrousel LinkedIn", channels: ["linkedin"], rule: "Le texte du post, puis le contenu de 6 à 8 diapositives dans le brief visuel (une idée par diapositive, titre de 6 mots au plus)." },
  sondage: { label: "Sondage LinkedIn", channels: ["linkedin"], rule: "Une question et 4 réponses de 30 caractères au plus, écrites à la fin du texte sous « Options du sondage : », puis une phrase qui annonce le lien." },
  coulisses: { label: "Coulisses du bootcamp", channels: ["linkedin", "whatsapp_status", "tiktok"], rule: "Ce qui se passe réellement dans une préparation avec Ben (méthode, rythme, outils), sans inventer d'élève, de chiffre ni de témoignage." },
  face_camera: { label: "Face caméra « 3 conseils en 30 s »", channels: ["tiktok"], rule: "Script parlé par Ben face caméra : une accroche, trois conseils, une action. Le storyboard suit le script." },
  pov: { label: "« POV » TikTok", channels: ["tiktok"], rule: "Format « POV : vous … » mis en scène, situation reconnaissable par un candidat ou un professionnel de la cyber." },
} as const satisfies Record<string, { label: string; channels: readonly Channel[]; rule: string }>;
export type Format = keyof typeof FORMATS;

export function formatsFor(channel: Channel): Format[] {
  return (Object.keys(FORMATS) as Format[]).filter((f) => (FORMATS[f].channels as readonly Channel[]).includes(channel));
}

/** Share of selling posts above which the balance warns: about one in five. */
export const MAX_OFFER_SHARE = 0.25;

export type BalancePost = { pillar: string | null; angle: string; destination: string };

/** Old posts carry no pillar: their angle says what they were. */
export function pillarOf(p: BalancePost): Pillar {
  if (p.pillar && p.pillar in PILLARS) return p.pillar as Pillar;
  if (p.angle === "conseil_du_jour" || p.angle === "test") return "methode";
  if (p.angle === "associate" || p.angle === "eligibilite") return "eligibilite";
  if (p.angle === "emploi") return "candidat";
  return "offre";
}

/**
 * The editorial balance of the last posts: counts by pillar and by
 * destination, and one line of advice when it leans too much one way.
 */
export function editorialBalance(posts: BalancePost[]): { byPillar: Record<Pillar, number>; byDestination: Record<Destination, number>; advice: string | null } {
  const byPillar = Object.fromEntries(Object.keys(PILLARS).map((k) => [k, 0])) as Record<Pillar, number>;
  const byDestination = Object.fromEntries(Object.keys(DESTINATIONS).map((k) => [k, 0])) as Record<Destination, number>;
  for (const p of posts) {
    byPillar[pillarOf(p)]++;
    if (p.destination in byDestination) byDestination[p.destination as Destination]++;
  }
  if (posts.length === 0) return { byPillar, byDestination, advice: "Aucun post sur 30 jours : commencez par un post de valeur (méthode ou carrière)." };
  const missing = (Object.keys(PILLARS) as Pillar[]).filter((k) => k !== "offre" && byPillar[k] === 0);
  let advice: string | null = null;
  if (posts.length >= 3 && byPillar.offre / posts.length > MAX_OFFER_SHARE) advice = `${byPillar.offre} posts de vente sur ${posts.length} : place à la valeur, par exemple « ${PILLARS[missing[0] ?? "methode"].label} ».`;
  else if (missing.length > 0 && posts.length >= 4) advice = `Pas encore de post « ${PILLARS[missing[0]].label} » ce mois-ci.`;
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
  return `${appUrl}${DESTINATIONS[destination].path}?${params.toString()}`;
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

export type SegmentKey = "called" | "test_low" | "test_high" | "hot" | "associate" | "conseil" | "cc";

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
