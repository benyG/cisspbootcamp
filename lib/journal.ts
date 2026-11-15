/**
 * The single journal (lot D): every action the business took, by hand or
 * on its own, in Ben's words and grouped so he can read a day in seconds.
 * Pure: the labels and the categories; the page reads actions_log.
 */

export const JOURNAL_LABELS: Record<string, string> = {
  scanner_submitted: "Analyse de profil remplie",
  sales_message_drafted: "Message de relance rédigé",
  diagnosis_sent: "Message de relance envoyé",
  call_booked: "Appel réservé",
  call_rescheduled: "Appel déplacé",
  call_cancelled: "Appel annulé",
  call_outcome: "Issue de l’appel notée",
  followup_sent: "Relance envoyée",
  followup_postponed: "Relance reportée",
  invited_to_book: "Invité à réserver un appel",
  after_call_email: "Lien de paiement envoyé après l’appel",
  result_reminder: "Rappel après l’analyse envoyé",
  marketing_followup_sent: "Relance marketing envoyée",
  unsubscribed: "Désinscription",
  marked_lost: "Marqué perdu",
  registration_started: "Inscription commencée",
  registered_by_admin: "Inscrit directement par vous",
  moved_to_cohort: "Déplacé vers une autre cohorte",
  payment_confirmed: "Paiement confirmé",
  payment_confirmed_manually: "Paiement confirmé à la main",
  payment_amount_mismatch: "Montant reçu inattendu",
  balance_reminder: "Rappel de solde envoyé",
  balance_paid: "Solde payé",
  balance_confirmed_manually: "Solde confirmé à la main",
  seat_held: "Place tenue",
  seat_released: "Place libérée",
  seat_hold_refused: "Place non tenue (complet)",
  service_order_started: "Commande de conseil ouverte",
  service_paid: "Séance de conseil payée",
  session_booked: "Séance réservée",
  session_outcome: "Séance faite / absent",
  session_booking_reminded: "Lien de réservation renvoyé",
  onboarding_sent: "Documents de préparation envoyés",
  evaluation_completed: "Évaluation remplie",
  replay_published: "Replay publié",
  replay_viewed: "Replay regardé",
  practice_test_done: "Test d’entraînement terminé",
  personal_schedule_proposed: "Plan de révision proposé",
  personal_schedule_confirmed: "Plan de révision confirmé",
  personal_schedule_invited: "Plan de révision envoyé à l’agenda",
  personal_schedule_refused: "Plan de révision refusé",
  cohort_session_invited: "Invitation aux séances envoyée",
  ia_journees_picked: "Journées Bâtisseur IA choisies",
  ia_brief_saved: "Fiche projet Bâtisseur IA enregistrée",
  playbook_health: "Playbook : alerte technique",
  playbook_unfinished: "Playbook : « finalisez votre place » envoyé",
  playbook_unfinished_done: "Inscription non finalisée traitée",
  playbook_late: "Playbook : alerte de retard",
  playbook_opening: "Playbook : ouverture des inscriptions annoncée",
  playbook_opening_admin: "Playbook : rappel d’ouvrir les inscriptions",
  playbook_hot: "Playbook : suite du diagnostic envoyée",
  playbook_last_call: "Playbook : dernier appel envoyé",
  playbook_full: "Playbook : cohorte pleine",
  playbook_wrapup: "Playbook : fin de cohorte",
  playbook_content: "Playbook : publications proposées",
  campaign_done: "Étape de campagne faite",
  analyst_done: "Pari de l’analyste fait",
  ai_usage: "Appel IA",
  ai_budget_alert: "Alerte de budget IA",
  market_watch: "Veille du marché faite",
  mcp_call: "Appel de Claude (MCP)",
  mcp_request_decided: "Demande de Claude validée ou refusée",
  admin_reminder: "Rappel administratif envoyé",
  morning_digest: "E-mail du matin envoyé",
};

export const JOURNAL_CATEGORIES = {
  messages: { label: "Messages", match: (t: string) => /(sent|reminder|reminded|email|followup|invited|unsubscribed|marked_lost|drafted)$/.test(t) && !t.startsWith("admin_") },
  sales: { label: "Ventes", match: (t: string) => /^(registration|registered|payment|balance|seat|service|moved|call_|scanner)/.test(t) },
  playbooks: { label: "Playbooks", match: (t: string) => t.startsWith("playbook_") || t === "campaign_done" },
  ai: { label: "IA", match: (t: string) => t.startsWith("ai_") || t === "market_watch" || t === "analyst_done" },
  mcp: { label: "Claude (MCP)", match: (t: string) => t.startsWith("mcp_") },
  admin: { label: "Administratif", match: (t: string) => t.startsWith("admin_") || t === "morning_digest" },
} as const;
export type JournalCategory = keyof typeof JOURNAL_CATEGORIES;

/** Noisy, one per AI call: shown under « IA », not in « Tout ». */
export const QUIET_TYPES = ["ai_usage", "mcp_call"] as const;

export function journalLabel(type: string): string {
  return JOURNAL_LABELS[type] ?? type.replaceAll("_", " ");
}

/** The types of a category among the known ones (the database filters by list). */
export function typesOf(category: JournalCategory | null): string[] | null {
  if (!category) return null;
  return Object.keys(JOURNAL_LABELS).filter((t) => JOURNAL_CATEGORIES[category].match(t));
}
