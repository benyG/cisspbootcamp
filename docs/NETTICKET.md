# Netticket — notes d'intégration (étape 4)

Source : https://netticket.net/developers, transmise par Ben le 19/09/2026.
Ce fichier est la référence de travail pour l'étape 4 ; il note aussi les
décisions et les angles morts repérés à la lecture.

## Authentification

En-tête `x-api-key: <token>` sur toutes les routes.
Base : `https://netticket.net/api/`

## Endpoints utilisés

| Route | Usage chez nous |
|---|---|
| `POST /payment/mobile` | création du paiement mobile money |
| `GET /payment/{transaction_id}/check` | vérification de statut (polling, et contre-vérification du webhook) |
| `GET /get/{event_reference}/tickets` | lecture des tickets et de leur prix |

### `POST /payment/mobile`

Champs : `email`*, `phone`* (format `6xxxxxxxx`), `ticket_code`*,
`modality`* (1 gratuit, **3 MTN Mobile Money**, **4 Orange Money**),
`quantity` (défaut 1), `name`, `notification` (défaut true), `promo_code`.

Réponses : `200` succès — `210` transaction déjà en attente, passer au polling —
`400` fonds insuffisants ou échec — `500` transaction impossible.

Données renvoyées : `transaction_id`, `reference` (`n_123456789`), `amount`,
`email`, `phone`, `name`, `owner`, `owner_email`.

### `GET /payment/{transaction_id}/check`

`200 { "success": "Transaction successful" }` / `400 { "error": "Transaction failed" }`.
Ne renvoie **pas** le montant : le contrôle du montant se fait en comparant le
webhook à la valeur attendue stockée dans `registrations.amount_*`.

## Webhook

Configuré dans le profil développeur Netticket : `webhook_url` et `webhook_hash`.
Le hash est renvoyé tel quel dans l'en-tête `verif-hash`.

```json
{
  "event": "charge.completed",
  "data": {
    "id": "123456",
    "status": "successful",
    "tx_ref": "n_123456789",
    "created_at": "2024-06-01 2:00:00",
    "amount": 100,
    "charged_amount": 100,
    "currency": "xaf"
  }
}
```

Statuts : `successful`, `failed`, `cancelled`, `abandoned`.

## Constats et décisions

**1. `verif-hash` est un secret partagé statique, pas une signature.**
Le corps du webhook n'est pas signé : quiconque connaît le hash peut forger une
notification, et rien ne lie le hash au contenu. La comparaison se fera en temps
constant, mais elle ne suffit pas à elle seule.

→ **Décision** : un webhook `successful` ne fait jamais passer une inscription en
`paid` à lui seul. Il déclenche un `GET /payment/{id}/check` côté serveur, et
c'est cette réponse qui fait foi. Le montant attendu est recoupé avec
`registrations.amount_local`. Conforme à la règle « paiement » de CLAUDE.md.

**2. `POST /payment/card` ne sera pas implémenté.**
L'endpoint attend le numéro de carte, le CVV et l'expiration en clair. Les faire
transiter par notre serveur nous placerait dans le périmètre PCI DSS, pour un
besoin déjà couvert par Stripe Checkout. Les cartes restent chez Stripe.

**3. Netticket est une billetterie, pas une passerelle de paiement générique.**
Un paiement est rattaché à un `ticket_code` d'un événement, dont le prix et le
stock sont définis **dans Netticket**, pas par nous. Nos paliers sont en cents
USD ; Netticket facture en XAF.

→ **Action requise de Ben avant l'étape 4** : créer l'événement « CISSP Bootcamp »
dans Netticket, avec un ticket par palier tarifaire, et fournir
`event_reference` et les `ticket_code`. Il faudra aussi décider qui fait
autorité sur le prix en XAF — le plus sain est que Netticket fasse foi et que
nous lisions le prix via `GET /get/{event_reference}/tickets`, quitte à afficher
l'équivalent USD à titre indicatif.

**4. Couverture géographique plus étroite que le palier « Afrique ».**
Les modalités sont MTN MoMo et Orange Money, la devise `xaf`. Cela couvre la
zone CEMAC (Cameroun en tête), pas l'UEMOA en XOF (Sénégal, Côte d'Ivoire,
Bénin…), ni Wave.

→ **À vérifier avec Netticket** : XOF et Wave sont-ils supportés ? Sinon une
partie du marché francophone visé n'aura que la carte bancaire ou le mode de
secours manuel.

**5. Pas d'environnement de test documenté.**
Aucun sandbox mentionné. À confirmer, sinon la recette de l'étape 4 se fera sur
des transactions réelles de faible montant, et les tests automatisés se feront
sur client HTTP simulé.

**6. `stock` par ticket.** Peut servir de garde-fou secondaire sur la capacité
d'une cohorte, mais la source de vérité reste `cohorts.capacity` chez nous.

## Variables d'environnement

`NETTICKET_API_KEY`, `NETTICKET_WEBHOOK_SECRET` (le `webhook_hash`),
`NETTICKET_EVENT_REFERENCE`, `NETTICKET_FALLBACK_URL`.
