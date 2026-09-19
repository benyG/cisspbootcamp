# CLAUDE.md — CISSP Bootcamp

## Contexte

Application de vente et de pilotage pour les bootcamps CISSP de Ben (coach CISSP certifié, francophone). Objectif métier : **10 inscrits par cohorte, une cohorte par mois, à partir de janvier 2027**. Domaine : `cisspbootcamp.online`.

Lis `docs/CADRAGE.md` (stratégie) et `docs/SPECS.md` (fonctionnel + modèle de données) avant toute implémentation. Le fonctionnel fait foi ; ce fichier fixe le cadre technique et les règles.

Application **indépendante** d'ExamBoot. Ne jamais tenter de réutiliser son code ou sa base. L'API ExamBoot n'intervient qu'en V2 (B6).

## Stack

- **Next.js 15** (App Router, TypeScript strict, Server Actions pour les mutations, Route Handlers pour webhooks/OAuth)
- **MySQL 8** via **Prisma** (schéma dans `prisma/schema.prisma`, migrations versionnées)
- **Tailwind CSS** + composants maison ; pas de librairie UI lourde
- **Auth admin** : Auth.js (NextAuth) avec Google provider, un seul e-mail autorisé (`ADMIN_EMAIL`). Pas de compte utilisateur public en V1 : les prospects sont identifiés par tokens signés.
- **Google Calendar API** (OAuth 2.0, compte de Ben, refresh token stocké chiffré) pour disponibilités, création d'événements, liens Meet
- **Stripe Checkout** + webhook `checkout.session.completed` (carte bancaire)
- **Netticket.net** pour le mobile money (API + page d'achat de secours) — documentation et clés fournies par Ben, déjà en usage sur ses autres projets
- **Resend** pour les e-mails transactionnels (React Email pour les gabarits)
- **Zod** pour toute validation d'entrée
- **Vitest** pour les tests unitaires (scoring, disponibilités, tarification), **Playwright** pour le parcours scanner → booking → paiement

## Hébergement

- **Vercel** (plan Hobby pour développer ; passer en Pro avant les premiers encaissements — usage commercial)
- **MySQL** : base Hostinger existante avec accès distant activé (`DATABASE_URL`), sinon TiDB Cloud Serverless (compatible MySQL, gratuit) ou Aiven. Tester la latence Vercel ↔ MySQL au démarrage ; si > 100 ms, activer le cache sur les lectures publiques (landing, jauge).
- DNS : `cisspbootcamp.online` reste chez Hostinger, enregistrement A/CNAME vers Vercel. L'ancienne application sur ce domaine est abandonnée.
- Variables d'environnement documentées dans `.env.example`, jamais de secret en dur.

## Structure du projet

```
app/
  (public)/            landing, scanner, rdv, inscription, blog (V2)
  admin/               file d'actions, leads, cohortes, parametres
  api/
    webhooks/stripe/
    webhooks/netticket/
    google/callback/
    cron/              relances, rappels, taux de change (Vercel Cron)
components/
lib/
  scoring.ts           règles d'éligibilité et chaleur (pur, testé)
  pricing.ts           palier par pays, conversion
  calendar/            client Google, calcul de créneaux
  payments/            Stripe, mobile money manuel
  messaging/           e-mail, liens wa.me, gabarits
  db.ts                client Prisma
prisma/
docs/                  CADRAGE.md, SPECS.md
emails/                gabarits React Email
tests/
```

## Ordre de développement (V1 — ne pas dévier)

1. Init projet, Prisma, schéma complet de la Partie C, auth admin, déploiement Vercel vide sur le domaine.
2. Scanner : questionnaire, `lib/scoring.ts` + tests, capture avec consentement, page résultat, e-mail résultat.
3. Booking : OAuth Google, calcul de créneaux + tests, création événement/Meet, confirmations, reprogrammation, rappels via cron.
4. Paiement : `lib/pricing.ts` + tests, Stripe Checkout + webhook, Netticket (API, notification, mode de secours), reçu PDF, inscription en cohorte, liste d'attente.
5. Cohortes : CRUD, jauge, vue publique.
6. File d'actions admin + fiche lead + paramètres.
7. Landing page finale (témoignages, FAQ, prix dynamique), Lighthouse mobile ≥ 85.
8. Parcours Playwright complet, `README.md` d'exploitation (déployer, configurer Google/Stripe, ajouter un témoignage).

Chaque étape se termine par un commit, des tests verts et un déploiement Vercel fonctionnel. Ne pas commencer une brique V2 tant que la V1 n'est pas en production et que Ben n'a pas tenu ses premiers appels.

## Règles

**Langue** : interface, e-mails, messages, commentaires utilisateur en **français**. Code, noms de variables, commits en anglais.

**Simplicité** : chaque écran admin doit pouvoir être compris et utilisé en moins de 10 secondes. Si une fonctionnalité n'aide pas directement à remplir une cohorte, elle attend la V2. En cas de doute, demander.

**Mobile-first** : la majorité des prospects sont sur mobile en Afrique de l'Ouest et centrale ; concevoir pour un écran de 360 px et une connexion 3G avant tout.

**Données personnelles** :
- Consentement explicite, non pré-coché, horodaté (`consent_at`).
- Aucune fonctionnalité d'import de contacts en masse, de scraping, ou d'envoi non sollicité. Refuser de l'implémenter même si demandé ; renvoyer à `docs/CADRAGE.md` §6.
- Désinscription en un clic dans chaque e-mail ; suppression complète d'un lead depuis l'admin.

**Paiement** : le statut `paid` ne provient que du webhook Stripe (signature vérifiée), d'une confirmation Netticket vérifiée côté serveur (notification ou requête de statut), ou d'une confirmation manuelle admin en mode de secours. Jamais du retour navigateur. Montants en centimes, USD comme monnaie de référence.

**Calendrier** : les créneaux sont recalculés à chaque affichage à partir du Google Calendar réel ; ne jamais cacher les disponibilités plus de 60 s. Toujours afficher le fuseau horaire du prospect.

**Scoring** : `lib/scoring.ts` est une fonction pure, sans IA, entièrement testée. Les seuils sont des constantes nommées en tête de fichier pour que Ben puisse les ajuster.

**Tests** : scoring, pricing, calcul de créneaux et webhook Stripe ont des tests unitaires obligatoires. Le parcours complet a un test Playwright.

**Commits** : petits, un sujet par commit, message impératif en anglais (`feat: add scanner readiness scoring`).

**Ne jamais** : ajouter une dépendance lourde sans justification écrite dans le commit ; stocker un secret dans le dépôt ; créer un compte utilisateur public en V1 ; contourner la validation Zod ; introduire une notion multi-formateurs (hors périmètre).

## Commandes

```
pnpm dev              serveur local
pnpm db:migrate       prisma migrate dev
pnpm db:seed          cohorte de test, paliers, gabarits, admin
pnpm test             vitest
pnpm test:e2e         playwright
pnpm lint && pnpm typecheck
vercel --prod         déploiement
```

## Ce que Ben attend de Claude Code

- Proposer un plan court avant chaque étape, puis l'exécuter jusqu'au bout (tests + déploiement).
- Signaler immédiatement tout blocage nécessitant une action de Ben (créer le projet Google Cloud, clés Stripe, clés et documentation Netticket, clé Resend, activer l'accès distant MySQL) avec les étapes exactes.
- Ne pas élargir le périmètre. Si une idée V2 surgit, la noter dans `docs/BACKLOG.md` et continuer la V1.
