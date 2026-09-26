# CISSP Bootcamp — Spécifications fonctionnelles

*Version 1.0 — 17 septembre 2026*

Deux rôles : **Prospect/Participant** (public) et **Coach** (Ben, seul admin en V1).

---

## PARTIE A — V1 (périmètre strict, 2 semaines)

### A1. Landing page `/`

**Objectif** : convaincre en 30 secondes et envoyer vers le scanner.

Sections, dans l'ordre :
1. Accroche coach CISSP + bouton « Évaluer mon profil » (→ scanner)
2. Pour qui / pas pour qui (prérequis 5 ans d'expérience, en français, 40 h)
3. Déroulé du bootcamp (semaines, format, accompagnement jusqu'à l'examen)
4. Témoignages (texte ou vidéo, 2 minimum ; composant vide masqué si aucun)
5. Le coach (photo, certification CISSP, conférences, ISO 27001)
6. Prochaine cohorte : date + jauge « X places restantes sur 10 »
7. Prix affiché selon le pays détecté (voir A4), avec mention des moyens de paiement
8. FAQ
9. Second appel à l'action → scanner

Contraintes : mobile-first (majorité du trafic africain sur mobile), chargement < 2 s sur 3G, FR uniquement. Design : `docs/DESIGN.md` et le prototype validé le 21/09/2026. Le questionnaire est **sur la landing**. Les textes viennent de `site_settings` (édités dans `/admin/parametres/site`) ; cohorte, jauge, prix et témoignages viennent de la base.

### A2. Scanner de profil « CISSP ready » `/scanner`

**Objectif** : aimant principal. Diagnostique l'éligibilité, capture le contact, propose l'étape suivante.

**Étape 1 — Questionnaire** (8–12 questions, une par écran sur mobile) :
- Pays de résidence (liste) → détermine le palier de prix
- Statut : en poste / étudiant / en reconversion / indépendant
- Années d'expérience en sécurité de l'information (0 / 1–2 / 3–4 / 5+)
- Domaines CISSP couverts par l'expérience (cases à cocher sur les 8 domaines)
- Diplôme ou certification permettant la dérogation d'un an (oui/non/je ne sais pas)
- Niveau d'anglais technique (l'examen est en anglais)
- Déjà tenté l'examen ? (non / oui, échoué / oui, réussi)
- Objectif d'examen (< 3 mois / 3–6 mois / 6–12 mois / pas défini)
- Budget : « Une inscription à [prix du palier] est-elle envisageable ? » (oui / oui si financée par l'employeur / non / à discuter)
- Disponible pour la cohorte de [mois suivant] ? (oui / plutôt la suivante / je ne sais pas)

**Étape 2 — Capture** : prénom, nom, e-mail, WhatsApp (indicatif + numéro), consentement RGPD explicite (case non pré-cochée), lien vers politique de confidentialité.

**Étape 3 — Résultat immédiat** *(décision de Ben, 21/09/2026 — remplace la validation préalable du 19/09)* : dès la soumission, le prospect voit son analyse à l'écran sur `/scanner/resultat/[token]` (verdict, trois axes en barres animées, délai accompagné vs seul, prochaine étape) **et** la reçoit par e-mail. Ben reçoit une notification par e-mail avec verdict, chaleur, délai, objectifs du prospect et le lien vers l'admin.

**Étape 4 — Message de relance validé par Ben** : à la soumission, un message de relance commerciale est rédigé par l'IA (`lib/scanner/ai-message.ts`, Claude) à partir du diagnostic fourni comme faits — l'IA argumente, elle ne diagnostique jamais. Sans clé API ou en cas d'échec, le gabarit de `lib/scanner/message.ts` est utilisé. Le message attend dans `/admin/diagnostics` (statut `pending_review`) ; Ben le relit, le corrige, puis **Valider et envoyer** l'expédie avec le lien de réservation. Rien ne part sans ce clic. Les messages en attente depuis plus de 24 h sont signalés.

- Trois axes montrés au prospect : prérequis ISC², couverture des 8 domaines, anglais en lecture. Un quatrième (maturité certification) est réservé au coach.
- Ordre du questionnaire : l'expérience ouvre (elle décide de l'éligibilité), le pays ferme (demandé en premier, il est intrusif). Tant que le pays est inconnu, la question de budget nomme les deux paliers.
- Appel à l'action adapté au verdict :
  - Prêt / sous conditions → « Réserver 15 min avec le coach » (→ A3)
  - Pas encore → ressources, « Je vous recontacte dans 6 mois » (lead conservé, tag `nurture`)

**Scoring** (règles, pas d'IA en V1) :
- Éligibilité : 5+ ans, ou 3–4 ans + dérogation → éligible ; 3–4 sans dérogation → sous conditions (Associate of ISC²) ; < 3 ou étudiant → pas encore.
- Dérogation d'un an : **déduite** d'un diplôme de 4 ans ou d'une certification de la liste (`lib/scoring.ts`, `WAIVER_CERTIFICATIONS`), jamais demandée au prospect. Une certification « autre » ne la donne pas automatiquement.
- Délai jusqu'à l'examen (`lib/analysis.ts`) : calibré sur les cohortes passées, avec coach — senior 1 à 2 mois, médian 2 à 3, trop tôt 4 à 5 (Ben, 26/09 : un mois de moins que le calibrage initial, `COACHING_REDUCTION_MONTHS`, jamais sous 1 à 2 mois). Toujours une fourchette. Le délai seul reste un multiple du calibrage initial (`SOLO_MULTIPLIER`), inchangé.
- Chaleur commerciale (interne, 0–100) : budget oui +30, employeur +20, cohorte prochaine +20, objectif < 6 mois +15, en poste +10, déjà échoué +5. Détermine la priorité dans la file du coach.

### A3. Booking d'appel de découverte `/rdv`

**Objectif** : que le prospect réserve seul un créneau de 15 min.

- Synchronisation **Google Calendar** (OAuth compte de Ben) : les créneaux proposés sont générés à partir de plages de disponibilité configurées (ex. lun–ven, 2 créneaux/jour) moins les événements existants.
- Durée fixe 15 min, tampon 5 min, réservation min. 12 h à l'avance, max. 14 jours.
- Fuseau horaire détecté côté prospect, affiché explicitement.
- À la réservation : événement créé dans Google Calendar avec lien Google Meet, invitation e-mail au prospect, e-mail + WhatsApp de confirmation.
- Rappels automatiques : 24 h et 1 h avant (e-mail ; WhatsApp si consenti).
- Reprogrammation / annulation par lien unique.
- Après l'appel, le coach marque l'issue (voir A6) : `inscrit`, `à relancer`, `pas maintenant`, `non qualifié`, `absent`.
- Prérequis : avoir passé le scanner (le booking récupère le lead par token). Accès direct possible via lien partagé par Ben (crée un lead minimal).

### A4. Tarification et paiement `/inscription`

- **Palier** déterminé par le pays du scanner (ou géolocalisation IP si accès direct, modifiable par le prospect). Table `pricing_tiers` : `africa` 625 USD, `international` 1 200 USD, `enterprise` sur devis.
- Affichage en USD + équivalent local indicatif (FCFA, EUR, CAD) via taux mis à jour quotidiennement.
- **Stripe Checkout** pour carte bancaire (paiement unique ; option 2 versements en V2).
- **Mobile money via Netticket.net** (plateforme déjà utilisée par Ben) :
  - Mode principal, **API** : création de la transaction côté serveur avec une référence unique, redirection du prospect vers le paiement Netticket, puis mise à jour du statut via notification Netticket (webhook) ou vérification de statut (polling par cron toutes les 5 min pendant 24 h). Passage en `paid` uniquement après confirmation Netticket côté serveur.
  - Mode de secours, **redirection simple** : lien vers la page d'achat de ticket Netticket portant la référence ; statut `pending_manual`, confirmation par le coach depuis l'admin.
  - Ben fournit à Claude Code la documentation API Netticket, les clés marchand et le format de notification avant l'étape 4.
- Une inscription payée crée une **place confirmée** dans la cohorte choisie ; le prospect passe au statut `participant`.
- Reçu/facture PDF envoyé par e-mail (mention entreprise possible).
- Webhook Stripe → mise à jour statut, jamais de confiance au retour navigateur.

### A5. Cohortes `/admin/cohortes`

- Entité `cohort` : nom, date de début, date de fin, capacité (10 par défaut), statut (`planned`, `open`, `full`, `running`, `done`).
- **Jauge** : places confirmées (payées) / capacité, + pré-engagements (scanner « disponible pour la prochaine ») en pointillé.
- **Liste d'attente** : si `full`, l'inscription bascule automatiquement sur la cohorte suivante `open`, avec information du prospect.
- Vue publique réduite sur la landing (date + places restantes).

### A6. File d'actions du coach `/admin`

**Objectif** : Ben ouvre, voit 3 actions, exécute, ferme. Tenu en 1 h/jour.

Page d'accueil admin = liste ordonnée par priorité, chaque ligne avec un bouton d'action directe :
0. **Messages de relance à valider** (voir A2, étape 4) : en tête, car un lead chaud refroidit vite.
1. **Appels du jour** : nom, heure, résumé du scanner (verdict, chaleur, points clés), lien Meet, bouton « Marquer l'issue ».
2. **Relances dues** : leads `à relancer` dont la date de relance est atteinte → message WhatsApp/e-mail pré-rédigé, bouton « Envoyé », « Reporter ».
3. **Paiements à confirmer** : Netticket en `pending_manual` (mode de secours).
4. **Nouveaux leads chauds** (chaleur ≥ 60, sans RDV) : bouton « Inviter à réserver ».

Règles de relance V1 (simples, fixes) : après scanner sans RDV → J+2 et J+7 ; après appel `à relancer` → J+3 ; place réservée non payée → J+1 et J+3.

Indicateurs en haut de page (3 chiffres seulement) : leads cette semaine, RDV cette semaine, places confirmées cohorte en cours / 10.

### A7. Fiche lead `/admin/leads/[id]`

Timeline (scanner, e-mails, RDV, issues, paiements), données du scanner, notes libres, statut, tags, actions (inviter, relancer, inscrire manuellement, marquer perdu).

### A8. Communications

- E-mail transactionnel via Resend (ou équivalent) : résultat scanner, confirmation RDV, rappels, confirmation paiement, reçu.
- WhatsApp : V1 = liens `wa.me` pré-remplis ouverts par Ben depuis la file (envoi manuel, 1 clic). V2 = API WhatsApp Business (Meta Cloud API) pour rappels automatiques.
- Tous les gabarits en français, éditables dans `/admin/parametres`.

### A9. Paramètres `/admin/parametres`

Disponibilités calendrier, paliers de prix, gabarits de messages, témoignages (CRUD), FAQ, paramètres Netticket.

### A10. Conformité

- Consentement RGPD explicite au scanner, politique de confidentialité, désinscription en 1 clic.
- Suppression d'un lead sur demande (bouton admin).
- Aucune importation de contacts en masse, aucun envoi non sollicité.

---

## PARTIE B — V2 (à développer après les premiers appels, par briques indépendantes)

### B1. CRM et scoring avancé
Pipeline visuel par étape, scoring recalculé à chaque interaction (ouverture e-mail, clic, réponse), segmentation par pays/entreprise, export CSV.

### B2. Moteur de contenu IA
- Banque d'**angles** : mythe CISSP démonté, cas d'audit vécu, question d'examen expliquée, actu sécurité commentée, témoignage, coulisses de cohorte.
- Génération de 2 publications/semaine (Claude API) dans la voix de Ben (guide de style + 10 exemples de ses textes).
- Déclinaison LinkedIn (long), WhatsApp (court), blog `/blog` (SEO, long terme).
- File de validation dans `/admin` : approuver / modifier / rejeter. Publication LinkedIn via API ; WhatsApp = copie en 1 clic.
- Chaque publication renvoie vers le scanner avec paramètre UTM.

### B3. Veille de canaux
Module qui, à partir de mots-clés, produit et maintient une liste de groupes WhatsApp/Telegram, forums, communautés LinkedIn, événements cyber francophones (lien, taille estimée, pertinence 1–5, statut rejoint/à rejoindre, notes). Ben rejoint et publie manuellement.

### B4. Suivi de cohorte
Présence par séance, avancement, alerte décrochage (2 absences → action dans la file), date d'examen déclarée, résultat, demande de témoignage automatique après réussite.

### B5. Parrainage
Code unique par participant/certifié, suivi des inscrits parrainés, récompense (commission ou session offerte), page « ambassadeurs ».

### B6. Intégration ExamBoot (API)
Création d'un compte test ExamBoot pour chaque participant, quiz de positionnement dans le scanner (optionnel), résultats remontés dans la fiche.

### B7. Paiement avancé
Paiement en 2 fois, devis/facture entreprise, relance automatique d'échéance.

### B8. Tableau de bord objectifs
Vue 10 mois : cohortes, inscrits/objectif, CA, taux de conversion par étape, source des leads.

---

## PARTIE C — Modèle de données (V1)

```
leads
  id, first_name, last_name, email, whatsapp, country, tier, job_title, goals,
  status (new|contacted|booked|called|registered|nurture|lost),
  heat_score, readiness (ready|conditional|not_yet),
  consent_at, source, utm_*, next_followup_at, created_at

scanner_responses
  id, lead_id, answers (JSON), readiness, heat_score, analysis (JSON),
  coach_message, status (pending_review|approved|sent|set_aside),
  reviewed_at, sent_at, result_token, created_at

bookings
  id, lead_id, google_event_id, meet_url, starts_at, ends_at, timezone,
  status (scheduled|done|no_show|cancelled), outcome, notes, reschedule_token

cohorts
  id, name, starts_at, ends_at, capacity, status

registrations
  id, lead_id, cohort_id, tier, amount_usd, currency_local, amount_local,
  method (stripe|netticket), status (pending|pending_manual|paid|refunded),
  stripe_session_id, netticket_transaction_id, reference, paid_at

pricing_tiers
  code, amount_usd, countries (JSON), label

testimonials
  id, name, role, country, text, video_url, published, sort_order

site_settings
  key, value (JSON), updated_at    — textes de la landing, vidéo, coach, FAQ, contact

message_templates
  key, channel (email|whatsapp), subject, body

actions_log
  id, lead_id, type, channel, payload (JSON), created_at
```

---

## PARTIE D — Critères d'acceptation V1

- Un inconnu peut, depuis son téléphone, passer le scanner, obtenir son verdict, réserver un créneau réel dans le Google Calendar de Ben et payer par Stripe en moins de 10 minutes.
- Ben ouvre `/admin`, voit ses actions du jour, et n'a besoin d'aucun autre écran pour tenir sa journée.
- La jauge de la cohorte reflète les paiements Stripe en temps réel via webhook.
- Un lead peut être supprimé et désinscrit en un clic.
- Lighthouse mobile ≥ 85 sur la landing.
