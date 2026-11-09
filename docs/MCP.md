# Prise MCP — piloter l'application depuis Claude

Ben, 09/11 : « tout ce que l'application sait faire, je veux pouvoir le demander depuis Claude ou un autre outil ».

L'application expose une prise MCP (Model Context Protocol) à l'adresse :

```
https://www.cisspbootcamp.online/api/mcp
```

On l'ajoute dans Claude comme **connecteur personnalisé** (Paramètres → Connecteurs → Ajouter un connecteur personnalisé), ou dans Claude Code (`claude mcp add --transport http cisspbootcamp https://www.cisspbootcamp.online/api/mcp`).

## Sécurité

- **Même porte que l'admin.** La première connexion ouvre la page de connexion Google de l'admin : seule l'adresse `ADMIN_EMAIL` passe. Ben voit ensuite quel outil demande l'accès (son nom, son adresse de retour) et clique « Autoriser ».
- **Jetons.** Jeton d'accès valable 1 h, renouvelé automatiquement (jeton de renouvellement 30 jours, changé à chaque usage). Seule leur empreinte est stockée. PKCE obligatoire (OAuth 2.1).
- **Déconnexion.** `/admin/mcp` liste les outils connectés ; « Déconnecter » coupe l'accès immédiatement.
- **Journal.** Chaque appel d'outil est noté (outil, application, date) et visible sur `/admin/mcp`.
- **Trois niveaux d'outils :**
  - **Lecture** — libre.
  - **Actions réversibles** — directes, journalisées.
  - **Actions sensibles** — Claude les *prépare* ; elles n'ont lieu qu'après un clic de Ben dans l'admin (« Demandes de Claude à valider »). Le statut `paid` ne vient jamais de la prise sans ce clic.
- **Jamais exposé :** import de contacts, envoi en masse ou non sollicité (CADRAGE §6), clés API, connexions Google/LinkedIn (elles se font dans le navigateur).

Les outils appellent les mêmes fonctions que l'admin, avec la même validation Zod.

## Catalogue

### Lot 1 — Lecture (en ligne)

| Outil | Ce qu'il donne |
|---|---|
| `pilot_overview` | Cohortes en campagne : places payées / objectif, état sur la courbe, prévision, inscriptions en cours, origine des payés |
| `action_queue` | La file d'actions du jour (analyses à valider, appels, relances, paiements à confirmer, soldes…) et les indicateurs de la semaine |
| `search_leads` | Chercher des prospects : nom, e-mail, statut, programme, chaleur minimale |
| `get_lead` | Fiche d'un prospect : analyse, appels, inscriptions et paiements, notes, derniers échanges |
| `list_cohorts` | Toutes les cohortes et leur jauge (payés, pré-engagés, places restantes, clôture des admissions) |
| `upcoming_calls` | Rendez-vous des prochains jours (appels découverte et séances de conseil), avec le lien Meet |
| `free_slots` | Créneaux libres de l'agenda Google pour un appel découverte |
| `payments_overview` | Paiements des 30 derniers jours, paiements à confirmer, soldes dus |
| `funnel_report` | Tunnel de la semaine : étapes, sources, pays, question qui fait perdre, boutons, FAQ |
| `marketing_overview` | Publications récentes et programmées, visites qu'elles ont amenées, brouillons à valider |
| `ads_and_promos` | Pub payante (dépense, coût par prospect et par inscrit, verdict) et codes promo |
| `analyst_report` | Le rapport de l'analyste de la semaine : diagnostic, orientations, décisions |
| `health_check` | Santé des intégrations, avec quoi faire pour corriger |

### Lot 2 — Actions réversibles (en ligne, directes, journalisées)

| Outil | Ce qu'il fait | Action de l'admin |
|---|---|---|
| `update_lead` | Ajouter une note datée, notes, étiquettes, statut, prochaine relance, reporter, marquer perdu | Fiche prospect, « Reporter », « Perdu » |
| `record_call_outcome` | Résultat d'un appel ; « veut s'inscrire » et « à relancer » envoient l'e-mail d'après-appel, comme le bouton | File d'actions |
| `mark_followup_done` | Relance envoyée à la main, inscription inachevée traitée | « Envoyé », « Traité » |
| `seat_hold` | Garder une place 48 h, la libérer | Fiche prospect |
| `draft_followup` | Rédiger une relance personnelle (IA), sans l'envoyer | Studio › Relances |
| `suggest_post_topics` | Dix idées de sujets (IA), actualité en option | Studio |
| `generate_posts` | Trois variantes (IA), rangées en brouillons à valider | Studio |
| `edit_post` | Modifier un post non publié (le lien suivi reste) | Studio |
| `schedule_post` | Programmer ou déprogrammer un post LinkedIn | Studio › Programmer |
| `promo_codes` | Code partenaire, codes de parrainage, activer / désactiver | Codes promo |
| `ad_campaigns` | Créer une campagne suivie, dépense, terminer / réactiver | Pub payante |
| `cohorts` | Créer, modifier, cocher une étape de campagne | Cohortes |
| `set_playbook_mode` | Actif, essai ou arrêté | Playbooks |
| `analyst` | Retenir, écarter, effacer, marquer fait, relancer l'analyse | Analyste |
| `send_test_email` | E-mail de test à Ben uniquement | Santé des intégrations |

Les outils et les boutons de l'admin appellent le même code (`lib/admin-ops/`, `lib/marketing/studio.ts`, `lib/marketing/schedule.ts`).

### Lot 3 — Actions sensibles (en ligne : préparées par Claude, validées par Ben)

Chaque outil vérifie ce qu'il peut, écrit en clair ce qui va se passer et crée une **demande** (`McpRequest`). Elle apparaît en tête de la file d'actions et dans Admin › Prise MCP › Demandes. « Valider » l'exécute une seule fois (réservation atomique), avec le même code que le bouton de l'admin, et vérifie tout à nouveau. « Refuser » ne fait rien. Une demande non traitée expire au bout de 7 jours.

| Outil | Ce que fait la validation | Action de l'admin |
|---|---|---|
| `request_payment_confirmation` | Confirme un paiement reçu hors application : inscription, solde, séance de conseil | « Confirmer » (file, fiche, Conseil) |
| `request_direct_registration` | Inscrit un prospect dans une cohorte, place payée ; e-mail « place réservée » et documents en option | Fiche › Inscription directe |
| `request_diagnosis_send` | Envoie l'analyse du scanner (message tel quel ou réécrit), ou la met de côté | Analyses › Valider et envoyer |
| `request_email` | Envoie une relance à un prospect consentant, ou le rappel de réserver une séance payée | Studio › Envoyer, Conseil › Renvoyer le lien |
| `request_catch_up` | Envoie les e-mails de rattrapage d'une cohorte en retard | Pilotage › Rattrapage |
| `request_linkedin_publish` | Publie un post sur LinkedIn tout de suite | Studio › Publier |
| `request_cohort_send` | Documents de préparation ou invitations aux séances, aux inscrits payés | Cohorte › Documents, Sessions |
| `request_price_change` | Change le montant d'un programme pour un palier | Paramètres › Prix |
| `request_deletion` | Supprime un prospect (RGPD) ou une cohorte vide ou dont les inscrits sont déplacés | Fiche › Supprimer, Cohorte › Supprimer |
| `list_requests` | (lecture) Les demandes en attente et le résultat des dernières | — |

Le statut `paid` ne vient donc jamais de Claude : il vient du clic de Ben sur la demande, qui est sa confirmation manuelle (CLAUDE.md, Paiement).

### Restent dans l'admin seulement

Connexions Google et LinkedIn, téléversement de vidéos, replays et documents, textes du site, gabarits, témoignages, devis, évaluations, dates du Bâtisseur IA. Ils demandent un navigateur, des fichiers, ou une relecture à l'écran. À ajouter plus tard si le besoin se présente.
