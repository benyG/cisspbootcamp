# Configurer Google — procédure pas à pas

Google sert à deux choses dans l'application :

1. **Se connecter à `/admin`** avec ton compte Google (aucun mot de passe à gérer).
2. **Lire ton agenda et y créer les appels de découverte** avec un lien Meet.

Les deux passent par le **même** projet Google Cloud et le **même** client OAuth.
Compte à utiliser partout : `cisspbootcamp08@gmail.com` (c'est `ADMIN_EMAIL`, et
c'est l'agenda qui recevra les appels).

Durée : 15 minutes. Tout se fait sur https://console.cloud.google.com, connecté
avec ce compte.

---

## Étape 1 — Créer le projet

1. Ouvre https://console.cloud.google.com.
2. En haut à gauche, clique sur le sélecteur de projet (à côté du logo
   Google Cloud) → **Nouveau projet**.
3. Nom : `CISSP Bootcamp`. Organisation : laisse « Aucune ». → **Créer**.
4. Attends la notification, puis **sélectionne ce projet** dans le sélecteur.
   Vérifie que son nom apparaît bien en haut avant de continuer : tout ce qui
   suit se fait *dans* ce projet.

## Étape 2 — Activer l'API Google Calendar

1. Menu ☰ → **API et services** → **Bibliothèque**.
2. Cherche `Google Calendar API` → clique dessus → **Activer**.

C'est la seule API à activer. La connexion admin (OpenID) n'en demande aucune.

## Étape 3 — Écran de consentement OAuth

C'est la fenêtre que Google affiche quand tu autorises l'application.

1. Menu ☰ → **API et services** → **Écran de consentement OAuth**
   (ou « Google Auth Platform » → « Branding » sur les consoles récentes).
2. Type d'utilisateur : **Externe** → **Créer**.
   *(« Interne » exige Google Workspace ; un compte gmail n'y a pas droit.)*
3. Informations sur l'application :
   - Nom de l'application : `CISSP Bootcamp`
   - E-mail d'assistance utilisateur : `cisspbootcamp08@gmail.com`
   - Logo : facultatif, laisse vide
   - Domaine de l'application → Page d'accueil : `https://cisspbootcamp.online`
   - Domaines autorisés : `cisspbootcamp.online`
   - Coordonnées du développeur : `cisspbootcamp08@gmail.com`
   → **Enregistrer et continuer**.
4. **Champs d'application (scopes)** → **Ajouter ou supprimer des champs
   d'application**. Coche ou saisis manuellement ces cinq-là :
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.freebusy`
   → **Mettre à jour** → **Enregistrer et continuer**.
5. **Utilisateurs test** → **Ajouter des utilisateurs** →
   `cisspbootcamp08@gmail.com` → **Enregistrer et continuer**.
6. Résumé → **Revenir au tableau de bord**.

### ⚠️ Étape 3 bis — Publier l'application (indispensable)

Sur le tableau de bord de l'écran de consentement, l'état est
**« Test »**. Clique sur **Publier l'application** → **Confirmer**.

Pourquoi c'est indispensable : en mode « Test », Google **fait expirer les
autorisations au bout de 7 jours**. L'agenda se déconnecterait chaque semaine
et la page de réservation se fermerait. En mode « En production », l'accès
reste valide tant que tu ne le révoques pas.

Google peut afficher « Votre application nécessite une validation ». **Ignore
ce message** : la validation sert aux applications destinées au public.
Ici, la seule personne qui autorise l'accès à un agenda, c'est toi. La
conséquence est simplement un écran d'avertissement au moment de connecter
l'agenda (voir étape 6), que tu passeras une seule fois.

## Étape 4 — Créer le client OAuth

1. Menu ☰ → **API et services** → **Identifiants** → **+ Créer des
   identifiants** → **ID client OAuth**.
2. Type d'application : **Application Web**.
3. Nom : `cisspbootcamp.online`.
4. **Origines JavaScript autorisées** → Ajouter un URI, deux fois :
   ```
   https://cisspbootcamp.online
   http://localhost:3000
   ```
5. **URI de redirection autorisés** → Ajouter un URI, **quatre fois**,
   exactement ceci (pas de slash final, `http` pour localhost) :
   ```
   https://cisspbootcamp.online/api/auth/callback/google
   https://cisspbootcamp.online/api/google/callback
   http://localhost:3000/api/auth/callback/google
   http://localhost:3000/api/google/callback
   ```
   Les deux premiers servent en production, les deux autres à tes tests
   locaux. `/api/auth/callback/google` = connexion admin ;
   `/api/google/callback` = autorisation de l'agenda.
6. **Créer**. Une fenêtre affiche **ID client** et **Code secret du client**.
   Copie-les tout de suite — le secret ne se réaffiche pas. Tu peux aussi
   télécharger le JSON.

Ces deux valeurs vont dans les variables d'environnement :

```
AUTH_GOOGLE_ID="xxxxxxxx.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="GOCSPX-xxxxxxxx"
```

À mettre **dans `.env` en local** (jamais dans le dépôt) **et dans Vercel**
(Settings → Environment Variables). Deux autres variables les accompagnent,
générées une fois pour toutes dans un terminal :

```bash
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → GOOGLE_TOKEN_ENCRYPTION_KEY
```

`GOOGLE_TOKEN_ENCRYPTION_KEY` chiffre en base l'autorisation d'accès à ton
agenda. Si tu la perds ou la changes, il faudra simplement reconnecter
l'agenda (étape 6). Ne la mets nulle part ailleurs que dans les variables
d'environnement.

## Étape 5 — Se connecter à l'admin

1. Ouvre `https://cisspbootcamp.online/admin` (ou `http://localhost:3000/admin`).
2. **Se connecter avec Google** → choisis `cisspbootcamp08@gmail.com`.
3. Tu arrives sur la page d'administration. Tout autre compte Google est
   refusé : c'est `ADMIN_EMAIL` qui décide.

Si Google répond « redirect_uri_mismatch » : l'URI de redirection de
l'étape 4.5 n'est pas exactement la bonne. Compare caractère par caractère,
en particulier `http` / `https` et l'absence de slash final.

## Étape 6 — Connecter l'agenda

1. Dans l'admin → **Agenda et disponibilités** (`/admin/parametres/google`).
2. **Connecter Google Calendar**.
3. Google affiche la liste des autorisations demandées (voir agenda, créer
   des événements). Comme l'application n'est pas « validée » par Google, un
   écran **« Google n'a pas validé cette application »** apparaît :
   clique sur **Paramètres avancés** → **Accéder à CISSP Bootcamp (non
   sécurisé)**. Ce libellé alarmant est le texte standard de Google pour
   toute application non soumise à leur validation ; l'application est la
   tienne.
4. **Continuer** / **Autoriser**.
5. Retour dans l'admin avec « Agenda connecté ». Vérifie que le compte
   affiché est bien `cisspbootcamp08@gmail.com`.
6. Règle le **fuseau horaire** de tes disponibilités (par défaut
   `Africa/Douala` ; par exemple `Africa/Dakar`, `Europe/Paris`,
   `America/Toronto`) et ajuste les plages. Par défaut : lundi–vendredi,
   18:00–19:00.

## Étape 7 — Vérifier

1. Depuis un autre appareil ou une fenêtre privée, ouvre
   `https://cisspbootcamp.online/rdv`.
2. Les créneaux doivent s'afficher, dans ton fuseau ou celui de l'appareil.
3. Réserve un créneau avec une adresse e-mail à toi.
4. Dans Google Agenda, l'événement « Appel découverte CISSP — … » doit
   apparaître avec un lien Google Meet, et l'adresse utilisée doit avoir reçu
   l'invitation et l'e-mail de confirmation.
5. Supprime l'événement de test depuis le lien « Déplacer ou annuler » de
   l'e-mail, pas depuis Google Agenda, pour que la base reste cohérente.

---

## Récapitulatif des variables Google

| Variable | Origine |
|---|---|
| `AUTH_GOOGLE_ID` | étape 4, ID client |
| `AUTH_GOOGLE_SECRET` | étape 4, code secret |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `ADMIN_EMAIL` | `cisspbootcamp08@gmail.com` |
| `AUTH_TRUST_HOST` | `true` en local ; inutile sur Vercel |

## Si ça casse plus tard

- **« L'agenda est momentanément fermé » sur `/rdv`** : l'autorisation a été
  révoquée ou a expiré (voir étape 3 bis). Refaire l'étape 6.
- **Tu changes de compte Google** : mets à jour `ADMIN_EMAIL`, ajoute le
  nouveau compte en utilisateur test (étape 3.5), refais les étapes 5 et 6.
- **Tu changes de domaine** : refaire l'étape 4.4 et 4.5 avec le nouveau
  domaine, et l'étape 3.3 (domaines autorisés).
