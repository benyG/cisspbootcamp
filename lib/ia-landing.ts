/**
 * Copy of the Bâtisseur IA landing page (Ben, 05/11, from the validated
 * prototype): what a participant writes and learns each journée, the day's
 * timetable, the site's own build log as proof, the questions people ask.
 * Facts only: the log comes from the repository history.
 */

/** Per journée, beside JOURNEES (lib/ia-days.ts): a tab label, the example prompt, the skills. */
export const DAY_DEMO: ReadonlyArray<{ short: string; prompt: string; skills: readonly string[] }> = [
  { short: "Premier déploiement", prompt: "Crée le site de mon atelier de couture avec une page de prise de rendez-vous, et mets-le en ligne.", skills: ["Mettre une application en ligne", "Décrire une page à Claude Code et la corriger", "Sauvegarder votre code sur GitHub"] },
  { short: "Le cœur métier", prompt: "Ajoute la liste de mes clientes avec leurs mesures et l’état de chaque commande.", skills: ["Créer vos écrans et votre base de clients", "Protéger l’accès à vos données", "Faire tester chaque changement"] },
  { short: "Vendre et encaisser", prompt: "Ajoute un acompte par Orange Money ou carte, et relance un devis resté trois jours sans réponse.", skills: ["Brancher le paiement mobile money et carte", "Programmer des relances par e-mail", "Écrire une page d’offre qui vend"] },
  { short: "Piloter", prompt: "Fais-moi le tableau de bord du mois et les factures en PDF pour mon comptable.", skills: ["Construire votre tableau de bord", "Produire factures et reçus en PDF", "Préparer l’export pour le comptable"] },
  { short: "Automatiser", prompt: "Chaque lundi, prépare les relances de la semaine et laisse-moi les valider avant l’envoi.", skills: ["Créer un assistant qui prépare votre travail", "Poser des garde-fous : rien ne part sans vous", "Présenter votre application au groupe"] },
];

/**
 * A training day, in minutes from the start (10 h Montréal by default): 5 h
 * of teaching and 1 h of pause, as lib/ia-days.ts counts them. Validated by Ben (05/11).
 */
export const DAY_PLAN: ReadonlyArray<{ at: number; title: string; text: string; kind: "show" | "you" | "pause" | "review" }> = [
  { at: 0, title: "Démonstration", text: "Ben construit l’étape du jour en direct, sur un projet d’exemple.", kind: "show" },
  { at: 45, title: "Vous construisez", text: "Même étape, sur votre application. Ben passe d’un écran à l’autre.", kind: "you" },
  { at: 150, title: "Pause", text: "1 heure.", kind: "pause" },
  { at: 210, title: "Vous construisez", text: "Vous terminez, vous testez, vous mettez en ligne.", kind: "you" },
  { at: 315, title: "Revue en groupe", text: "Chacun montre ce qui marche. Ce qui bloque se règle ensemble.", kind: "review" },
];

/** The build log of this site (git history of the repository), in plain words. */
export const SITE_LOG: ReadonlyArray<{ date: string; label: string; text: string; incident?: boolean }> = [
  { date: "2026-09-21", label: "21 sept. 2026", text: "Premier jour : le site est en ligne, avec son analyse de profil." },
  { date: "2026-09-22", label: "22 sept.", text: "La file d’actions du coach : chaque matin, qui relancer, qui appeler, quoi valider." },
  { date: "2026-09-24", label: "24 sept.", text: "Prise de rendez-vous : le créneau d’abord, le paiement ensuite, le rappel la veille." },
  { date: "2026-09-28", label: "28 sept.", text: "Un studio marketing avec Claude : posts, visuels, relances personnalisées." },
  { date: "2026-10-27", label: "27 oct.", text: "Google coupe l’accès à l’agenda. La page de rendez-vous plante. Diagnostiquée, corrigée, testée, remise en ligne le jour même.", incident: true },
  { date: "2026-11-03", label: "3 nov.", text: "Le Bâtisseur IA : programme, diagnostic, inscription, calendrier des journées. En une journée." },
  { date: "2026-11-04", label: "4 nov.", text: "Paiement en deux fois, avec rappels du solde et reçu mis à jour." },
];

export const IA_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  { q: "Construisez-vous l’application pour moi ?", a: "Non : c’est une formation. Vous la construisez vous-même, en direct, avec Ben qui montre chaque étape et vous débloque. À la fin, l’application est à vous, et vous savez la faire évoluer seul." },
  { q: "Je ne sais pas coder.", a: "C’est prévu. Vous décrivez ce que vous voulez en français, Claude Code écrit le code, vous vérifiez le résultat à l’écran. Si l’ordinateur vous intimide, une séance d’accueil d’une heure installe tout avec vous avant la J1." },
  { q: "Ma connexion coupe souvent.", a: "Claude Code tourne aussi dans le cloud : si votre connexion coupe, le travail continue et vous le retrouvez en vous reconnectant." },
  { q: "Je ne suis pas libre tous les week-ends.", a: "Vous entrez par une J1, puis vous choisissez vos J2 à J5 parmi les samedis et dimanches suivants, sur votre calendrier personnel." },
];
