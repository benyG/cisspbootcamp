# CISSP Bootcamp — guide d'exploitation

Application de vente et de pilotage des bootcamps CISSP de Ben.
Stratégie : `docs/CADRAGE.md`. Fonctionnel et modèle de données : `docs/SPECS.md`.
Charte graphique : `docs/DESIGN.md`. Cadre technique : `CLAUDE.md`.

Ce guide couvre le quotidien : déployer, configurer les services, faire tourner
une cohorte, réparer ce qui casse.

## 1. Comment ça tourne

| Brique | Où | Rôle |
|---|---|---|
| Site et admin | Vercel, projet `cisspbootcamp` | Next.js 15, déployé à chaque fusion dans `main` |
| Base MySQL | Hostinger, base dédiée `u729626061_cisspboot` | Prisma, migrations appliquées au déploiement |
| Domaine | `cisspbootcamp.online` (DNS chez Hostinger) | A/CNAME vers Vercel |
| E-mails | Resend | Résultats, confirmations, rappels, reçus |
| Agenda et Meet | Google Calendar (compte `cisspbootcamp08@gmail.com`) | Créneaux et appels de découverte |
| Carte bancaire | Stripe Checkout | Webhook `checkout.session.completed` |
| Mobile money | Netticket | API + webhook + page de secours |
| Message de relance | API Claude | Brouillon que Ben valide, jamais le verdict |
| Rappels et polling | GitHub Actions, toutes les 15 min | Appelle `/api/cron/reminders` et `/api/cron/netticket` |
| Taux de change | Vercel Cron, 1×/jour | `/api/cron/rates` |

Parcours prospect : landing → scanner (11 questions) → résultat à l'écran et par
e-mail → appel de 15 min → validation du message par Ben → `/inscription` →
paiement → reçu PDF → place en cohorte.

## 2. Déployer

Rien à taper. Une fusion dans `main` déclenche Vercel, qui exécute
`pnpm db:deploy && pnpm db:seed && pnpm build` (`vercel.json`) : migrations en
attente, jeu de données de départ (idempotent), puis build.

Vérifier après chaque déploiement :

1. Vercel → Deployments : le dernier est **Ready**.
2. `https://cisspbootcamp.online/` répond, le scanner s'ouvre sur la question
   d'expérience.
3. Vercel → Logs, filtre `error` : rien de nouveau.

Si le build échoue sur la base (« Can't reach database server ») : Hostinger →
Bases de données → Accès distant, l'adresse autorisée doit être `%`.

Revenir en arrière : Vercel → Deployments → déploiement précédent → **Promote
to Production**. Les migrations ne sont pas annulées ; elles sont toujours
additives, l'ancien code fonctionne dessus.

### Le domaine

Le domaine principal dans Vercel doit être `cisspbootcamp.online` (sans `www`),
avec `www` qui redirige vers lui. Les webhooks Stripe et Netticket ainsi que le
retour OAuth Google sont enregistrés sur l'adresse sans `www` ; si c'est
l'inverse, ils reçoivent une redirection 308 et échouent.

## 3. Configurer les services

Toutes les variables sont listées dans `.env.example`. Sur Vercel : Settings →
Environment Variables, cibles **Production** et **Preview**. Un changement de
variable prend effet au déploiement suivant (Deployments → ⋯ → Redeploy).

### Google (connexion admin + agenda)

Procédure complète, écran par écran : `docs/SETUP-GOOGLE.md`. En résumé :
projet Google Cloud, API Calendar activée, écran de consentement **publié**,
client OAuth avec les deux URI de redirection, puis `/admin/parametres/google`
→ **Connecter l'agenda**. Les disponibilités (jours, heures, fuseau) se règlent
sur la même page.

### Stripe

1. Dashboard Stripe → Développeurs → Clés API : `STRIPE_SECRET_KEY` (`sk_live_…`)
   et `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_live_…`).
2. Développeurs → Webhooks → Ajouter un endpoint :
   - URL : `https://cisspbootcamp.online/api/webhooks/stripe`
   - Événements : `checkout.session.completed` et
     `checkout.session.async_payment_succeeded`
   - Copier la clé de signature dans `STRIPE_WEBHOOK_SECRET` (`whsec_…`).
3. Test réel à 1 USD : `/admin/parametres/prix`, mettre le palier Afrique à
   `1`, s'inscrire depuis un résultat de scanner validé, payer, vérifier dans
   la file d'actions que la place est `payée`, rembourser depuis Stripe, puis
   remettre `625`.

Une place n'est jamais marquée payée depuis le navigateur : uniquement par le
webhook signé, la vérification Netticket côté serveur, ou la confirmation
manuelle de Ben en mode de secours.

### Netticket (mobile money)

Détails, limites et décisions : `docs/NETTICKET.md`. En résumé :

1. `NETTICKET_API_KEY`, `NETTICKET_EVENT_REFERENCE`, `NETTICKET_WEBHOOK_SECRET`
   sur Vercel.
2. Profil développeur Netticket : `webhook_url =
   https://cisspbootcamp.online/api/webhooks/netticket`, `webhook_hash` = la
   valeur de `NETTICKET_WEBHOOK_SECRET`.
3. `/admin/parametres/prix` : un **code de ticket** par palier. Palier sans
   code = pas de bouton mobile money pour ses pays.
4. Mode de secours (API indisponible) : `NETTICKET_FALLBACK_URL` renseigné,
   `NETTICKET_API_KEY` vide. Le prospect paie sur la page Netticket avec notre
   référence, Ben confirme depuis la file d'actions.

### Resend (e-mails)

`RESEND_API_KEY` et `EMAIL_FROM` (`Ben — CISSP Bootcamp <bonjour@cisspbootcamp.online>`).
Le domaine `cisspbootcamp.online` doit être vérifié dans Resend (enregistrements
DNS SPF et DKIM chez Hostinger). Sans clé, les e-mails sont écrits dans les
logs Vercel au lieu d'être envoyés : rien ne bloque, mais rien ne part.

### Rappels automatiques (GitHub Actions)

Le plan Vercel Hobby n'autorise qu'un cron par jour. Les rappels d'appel (24 h
et 1 h avant) et le suivi des paiements mobile money passent donc par
`.github/workflows/reminders.yml`, toutes les 15 min. Deux secrets à créer sur
GitHub (Settings → Secrets and variables → Actions) :

- `APP_URL` = `https://cisspbootcamp.online`
- `CRON_SECRET` = la même valeur que sur Vercel

Sans eux, le workflow échoue à chaque exécution (onglet Actions du dépôt).
GitHub suspend un workflow planifié après 60 jours sans commit ; un commit
le relance. Sur Vercel Pro : remettre
`{ "path": "/api/cron/reminders", "schedule": "*/15 * * * *" }` dans
`vercel.json` et supprimer le workflow.

### Message de relance rédigé par l'IA

`ANTHROPIC_API_KEY` sur Vercel. Sans clé, un gabarit sans IA est utilisé. Le
verdict du scanner, lui, vient toujours des règles de `lib/scoring.ts`.

## 4. Faire tourner une cohorte

### Chaque jour : `/admin`

La file d'actions montre, dans l'ordre : appels du jour, messages de relance à
valider, relances à envoyer (bouton WhatsApp ou e-mail, puis **Envoyé**),
paiements à confirmer, places à inviter. Chaque ligne a son bouton ; rien
d'autre à ouvrir.

Un nouveau profil arrive par e-mail à `ADMIN_EMAIL` avec le lien de son
diagnostic. Sur `/admin/diagnostics/[id]` : lire l'analyse, corriger le message
de relance si besoin, **Valider**. Tant que le message n'est pas validé, le lien
d'inscription du prospect reste fermé.

### Ouvrir une cohorte : `/admin/cohortes`

Nom, dates, capacité (10), statut **ouverte**. La landing affiche
automatiquement la prochaine cohorte ouverte et sa jauge. Quand elle est
pleine, les inscriptions basculent sur la suivante ; s'il n'y en a pas, le
prospect est mis en liste d'attente et Ben prévenu.

### Tarifs : `/admin/parametres/prix`

Deux paliers : Afrique francophone 625 USD, international 1 200 USD, plus
« entreprise » sur devis. Les montants locaux affichés (FCFA, EUR…) sont
indicatifs, convertis chaque nuit ; on encaisse en USD.

### Ajouter un témoignage : `/admin/temoignages`

Prénom, poste, pays, texte, URL de vidéo YouTube (facultatif), ordre, case
**Publié**. Le témoignage apparaît sur la landing dès l'enregistrement. L'URL de
la vidéo de présentation de Ben se règle dans `/admin/parametres/site`, avec
les textes de la page d'accueil.

### Données personnelles

- Consentement explicite et horodaté à chaque capture ; case jamais pré-cochée.
- Chaque e-mail contient un lien de désinscription en un clic.
- Sur la fiche d'un lead (`/admin/leads/[id]`) : **Supprimer ce lead et tout
  son historique** efface définitivement réponses, appels, inscriptions.
- Aucun import de contacts, aucun envoi non sollicité : ce n'est pas prévu et
  ne doit pas l'être (`docs/CADRAGE.md` §6).

## 5. Quand ça casse

| Symptôme | Cause probable | Action |
|---|---|---|
| Landing en erreur 500 | Base injoignable ou variable manquante | Vercel → Logs ; vérifier `DATABASE_URL` et l'accès distant Hostinger |
| « La réservation est momentanément fermée » | Agenda Google déconnecté ou aucune disponibilité | `/admin/parametres/google` → Reconnecter ; vérifier les créneaux |
| Réservation fermée chaque semaine | Écran de consentement Google resté en mode « Test » | Publier l'application (`docs/SETUP-GOOGLE.md`, étape 3 bis) |
| Paiement carte effectué mais place « en attente » | Webhook Stripe pas reçu | Stripe → Webhooks : erreurs ? URL avec `www` ? Renvoyer l'événement |
| Bouton mobile money absent | Palier sans code de ticket, ou pays hors zone XAF | `/admin/parametres/prix` ; `docs/NETTICKET.md` |
| Aucun e-mail ne part | `RESEND_API_KEY` absente ou domaine non vérifié | Resend → Domains ; Vercel → Logs, chercher `[email]` |
| Rappels d'appel jamais envoyés | Secrets GitHub manquants | Onglet Actions du dépôt, workflow `reminders` |
| Connexion admin refusée | Compte Google différent de `ADMIN_EMAIL` | Se connecter avec le bon compte |

## 6. Développer et tester

```bash
pnpm install
cp .env.example .env        # renseigner DATABASE_URL, ADMIN_EMAIL, AUTH_SECRET, NEXT_PUBLIC_APP_URL
pnpm db:deploy && pnpm db:seed
pnpm dev                    # http://localhost:3000
```

Le mot de passe MySQL doit être encodé dans l'URL : `@` → `%40`, `:` → `%3A`,
`/` → `%2F`.

| Commande | Effet |
|---|---|
| `pnpm test` | tests unitaires : scoring, analyse, tarifs, créneaux, webhooks, gabarits |
| `pnpm test:e2e` | parcours complet en navigateur mobile 360 px (voir ci-dessous) |
| `pnpm lint` / `pnpm typecheck` | qualité |
| `pnpm db:migrate` | crée une migration à partir du schéma (dev) |
| `pnpm db:studio` | explorateur de base |

**Intégration continue** (`.github/workflows/ci.yml`) : à chaque push, lint,
types, tests unitaires, puis le parcours Playwright `tests/e2e/journey.spec.ts`
contre une base MySQL jetable : scanner → résultat → réservation → offre →
paiement confirmé par un webhook Stripe signé. Google Calendar y est remplacé
par `lib/calendar/stub.ts` (`E2E_CALENDAR_STUB=1`, à ne jamais mettre sur
Vercel) ; Stripe n'est sollicité que par sa signature de webhook ; les e-mails
sont journalisés.

Pour le lancer en local, il faut une base MySQL de test et les mêmes variables
que dans le workflow (`DATABASE_URL`, `E2E_CALENDAR_STUB=1`,
`STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` fictifs).

## 7. Règles à ne pas oublier

- Interface, e-mails et messages en français ; code et commits en anglais.
- Montants en centimes, USD comme monnaie de référence.
- Créneaux recalculés à chaque affichage depuis Google Calendar, jamais mis en
  cache plus de 60 s.
- Aucun secret dans le dépôt : `.env` est ignoré par git, `.env.example` ne
  contient que des exemples.
- Une seule personne : pas de notion multi-formateurs.

## État d'avancement

- [x] Étape 1 — socle : Next.js, Prisma, schéma Partie C, auth admin
- [x] Étape 2 — scanner de profil, résultat immédiat, message de relance
- [x] Étape 3 — booking Google Calendar, rappels
- [x] Étape 4 — paiement Stripe et Netticket, reçu PDF, cohortes
- [x] Étape 5 — cohortes et jauge publique
- [x] Étape 6 — file d'actions admin, fiche lead, paramètres
- [x] Étape 7 — landing page (prototype validé le 21/09)
- [x] Étape 8 — parcours Playwright complet, intégration continue, ce guide
