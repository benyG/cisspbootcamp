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

### Lot 2 — Actions réversibles (directes, journalisées)

| Outil | Actions de l'admin couvertes |
|---|---|
| `update_lead` | Notes, étiquettes, statut, prochaine relance, reporter, marquer perdu |
| `record_call_outcome` | Résultat d'un appel découverte ou d'une séance de conseil |
| `mark_followup_done` | Relance faite (WhatsApp ou e-mail envoyé à la main), inscription inachevée traitée |
| `seat_hold` | Garder une place après un appel, la libérer |
| `draft_followup` | Rédiger une relance personnalisée (IA), sans l'envoyer |
| `marketing_drafts` | Idées de sujets, générer des posts en brouillon, modifier un brouillon, générer un visuel |
| `schedule_post` | Programmer ou déprogrammer un post LinkedIn (annulable jusqu'au jour J) |
| `promo_codes` | Créer un code partenaire ou des codes de parrainage, activer ou désactiver |
| `ad_campaigns` | Créer une campagne suivie, mettre à jour la dépense, l'arrêter |
| `cohorts` | Créer ou modifier une cohorte, enregistrer le plan de campagne, cocher une étape |
| `playbooks` | Changer le mode d'un playbook (arrêt, essai, actif) |
| `analyst` | Retenir ou écarter une orientation, la marquer faite, relancer l'analyse |
| `send_test_email` | M'envoyer l'e-mail de test (à Ben uniquement) |

### Lot 3 — Actions sensibles (préparées par Claude, validées par Ben)

| Outil | Actions de l'admin couvertes |
|---|---|
| `request_payment_confirmation` | Confirmer un paiement manuel, un solde, un paiement de conseil |
| `request_direct_registration` | Inscrire directement un prospect dans une cohorte |
| `request_diagnosis_send` | Valider et envoyer une analyse (ou la mettre de côté) |
| `request_email` | Envoyer à un prospect : relance, invitation à réserver, rappel de séance, accueil |
| `request_catch_up` | Rattrapage en un clic d'une cohorte en retard |
| `request_linkedin_publish` | Publier un post LinkedIn maintenant |
| `request_cohort_send` | Envoyer accueil, sessions et calendriers personnels d'une cohorte |
| `request_price_change` | Modifier un palier ou le prix d'un programme |
| `request_deletion` | Supprimer un prospect (RGPD) ou une cohorte vide |

### Restent dans l'admin seulement

Connexions Google et LinkedIn, téléversement de vidéos, replays et documents, textes du site, gabarits, témoignages, devis, évaluations, dates du Bâtisseur IA. Ils demandent un navigateur, des fichiers, ou une relecture à l'écran. À ajouter plus tard si le besoin se présente.
