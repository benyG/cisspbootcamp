# CISSP Bootcamp

Application de vente et de pilotage des bootcamps CISSP.
Stratégie : `docs/CADRAGE.md` — fonctionnel et modèle de données : `docs/SPECS.md`.

> Le guide d'exploitation complet (déployer, configurer Google/Stripe, ajouter un
> témoignage) arrive à l'étape 8. Ci-dessous, le strict nécessaire pour démarrer.

## Démarrer

```bash
pnpm install
cp .env.example .env        # puis renseigner les valeurs
pnpm db:deploy              # applique les migrations
pnpm db:seed                # paliers de prix, gabarits, cohorte de test
pnpm dev
```

Le mot de passe MySQL doit être **encodé dans l'URL** : `@` devient `%40`,
`:` devient `%3A`, `/` devient `%2F`. Sans cela, Prisma lit l'URL de travers.

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | serveur local sur http://localhost:3000 |
| `pnpm test` | tests unitaires (Vitest) |
| `pnpm test:e2e` | parcours navigateur (Playwright, profil mobile 360 px) |
| `pnpm lint` / `pnpm typecheck` | qualité |
| `pnpm db:migrate` | crée une migration à partir du schéma (dev) |
| `pnpm db:deploy` | applique les migrations existantes (prod) |
| `pnpm db:seed` | jeu de données de départ |
| `pnpm db:studio` | explorateur de base |

## Configuration des services

- Google (connexion admin + agenda) : `docs/SETUP-GOOGLE.md`, pas à pas.
- Netticket : `docs/NETTICKET.md`.

## Accès admin

`/admin` est réservé à un seul compte Google, celui de `ADMIN_EMAIL`.
Il n'existe aucun compte public en V1 : les prospects sont identifiés par
des jetons signés.

## État d'avancement

- [x] Étape 1 — socle : Next.js, Prisma, schéma Partie C, auth admin, tests
- [x] Étape 2 — scanner de profil, validation par le coach
- [x] Étape 3 — booking Google Calendar
- [~] Étape 4 — paiement : Stripe fait, Netticket en attente de l'événement et des réponses XOF/Wave
- [ ] Étape 5 — cohortes
- [ ] Étape 6 — file d'actions admin
- [ ] Étape 7 — landing page
- [ ] Étape 8 — parcours Playwright complet et guide d'exploitation
