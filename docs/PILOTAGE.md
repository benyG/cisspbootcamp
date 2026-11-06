# Pilotage automatique des cohortes

Plan validé par Ben le 06/11/2026, sur le prototype des écrans « Pilotage » et
« Lancer une cohorte ». Un seul système : un **objectif** par cohorte, une
**courbe cible**, des **playbooks** qui font avancer la courbe, une **mesure**
qui dit s'il faut accélérer, et une seule **file « à valider »** pour Ben.

## Principes

- Un playbook = déclencheur, action, condition d'arrêt, mesure.
- Automatique : seulement les e-mails attendus par la personne (lien,
  rappel, échéance), à une personne qui a donné son accord.
- À valider par Ben : tout ce qui est public ou personnel (publications,
  relances WhatsApp, prix, promos).
- Garde-fous : consentement vérifié à chaque envoi ; plafond d'un message
  automatique par personne tous les 4 jours ; aucun import de contacts ;
  aucun chiffre, témoignage ou urgence inventés ; jamais d'heure dans les
  e-mails ; `paid` uniquement par paiement vérifié ; interrupteur et mode
  essai par playbook ; chaque action tracée. Voix : Ben (CISSP, CC), l'équipe
  ExamBoot (Bâtisseur IA).

## Courbe cible

0 à J-60 (ouverture de la campagne), 20 % à J-45, 50 % à J-21, 100 % à la
fermeture des admissions : J-7 pour les certifications, J-1 pour le
Bâtisseur IA. Constantes dans `lib/pilotage.ts`. Objectif = `targetSeats`
de la cohorte, ou sa capacité.

Prévision : le rythme des 21 derniers jours prolongé jusqu'à la fermeture
des admissions (jamais sous les places déjà payées).

## Lots

| Lot | Contenu | État |
|---|---|---|
| 0 | Prérequis de Ben : agenda Google, prix 30 h, dates avec J6, validation Meta, clé images | En cours (Ben) |
| 1 | Prototype des deux écrans | Validé le 06/11 |
| 2 | Mesure : objectif par cohorte, courbe, prévision, page Pilotage, rapport du lundi | Livré |
| 3 | Moteur de playbooks et garde-fous ; Santé technique, Inscription non finalisée, En retard sur la courbe | Livré |
| 4 | Playbooks du cycle : Ouverture, Prospect chaud, Suivi d'appel, Dernier appel, Cohorte pleine, Fin de cohorte | Livré |
| 5 | Lancer une cohorte : assistant et plan de campagne J-60 → J0 | Livré |
| 6 | Promo : tarif de lancement, codes partenaires, parrainage | À faire |
| 7 | Communication automatisée : rythme de contenu, publication programmée, séquences e-mail, WhatsApp préparé | À faire |
| 8 | Ajustement et pub : rattrapage, suivi des campagnes payantes, coût par inscrit | À faire |

## Lot 2 (livré)

- `lib/pilotage.ts` (pur, testé) : courbe, état de la cohorte, prévision.
- `lib/pilotage-server.ts` : cohortes à venir, tunnel par programme,
  publications qui amènent des visites, envoi du rapport du lundi.
- `lib/pilotage-report.ts` (pur, testé) : le texte du rapport.
- `/admin/pilotage` : cartes des cohortes, courbe, prévision, tunnel,
  origine des inscrits, aperçu du rapport.
- Rapport du lundi : par la tâche quotidienne, le lundi, une fois par
  semaine, à `ADMIN_EMAIL`.

## Lot 3 (livré)

- `lib/playbooks/rules.ts` (pur, testé) : modes (Actif, Essai, Arrêté),
  plafond de pression, consentement, fenêtres et seuils de chaque playbook.
- `lib/playbooks/server.ts` : chaque playbook planifie ses étapes sans rien
  écrire ; la tâche quotidienne exécute celles des playbooks actifs et les
  trace dans `actions_log` (`playbook_<id>`), ce qui les empêche de se répéter.
- Santé technique : alerte par e-mail (agenda, envoi d'e-mails, LinkedIn),
  une fois par jour tant que le problème dure.
- Inscription non finalisée : e-mail « finalisez votre place » entre 24 h et
  7 jours après le paiement commencé ; à J+3 sans paiement, un appel dans la
  file d'actions. Par défaut en Essai : Ben lit l'e-mail, puis l'active.
- En retard sur la courbe : alerte avec pack de rattrapage, une fois par
  semaine par cohorte, ou plus tôt si le retard grandit.
- `/admin/playbooks` : mode de chaque playbook, ce qu'il ferait maintenant,
  les 7 derniers jours, le journal.

## Lot 4 (livré)

`lib/playbooks/cycle.ts`, même contrat que le lot 3 (planifier sans écrire,
exécuter et tracer). Les e-mails aux prospects : personnes consentantes
seulement, plafond de pression, une fois par personne et par cohorte, au plus
25 par playbook et 50 au total par passage.

- Ouverture (Essai) : à J-60, rappel à Ben si les inscriptions ne sont pas
  ouvertes ; sinon « les inscriptions sont ouvertes » aux prospects
  consentants du programme (6 derniers mois). Fenêtre J-60 à J-50.
- Prospect chaud, Bâtisseur IA (Essai) : diagnostic de 2 à 7 jours sans
  inscription, e-mail avec la première automatisation conseillée et la
  prochaine entrée. Côté CISSP, la relance après l'analyse de profil existe
  déjà (`result_reminder`).
- Suivi d'appel : déjà couvert par l'e-mail après appel et la file de
  relances (`nextFollowupAt`) ; pas de playbook en double.
- Dernier appel (Essai) : de 4 jours avant la fermeture des admissions à la
  veille, s'il reste des places, aux prospects engagés (3 derniers mois).
- Cohorte pleine (Actif) : Ben est prévenu une fois, avec la cohorte suivante ;
  les autres playbooks n'écrivent plus pour une cohorte sans place.
- Fin de cohorte (Actif) : 7 jours après le dernier jour, la liste des
  participants avec un message WhatsApp prêt (témoignage avec accord écrit,
  recommandation).

## Lot 5 (livré)

- `Cohort.campaign` (JSON) : canaux, budget pub, promo (tarif de lancement,
  codes partenaires, parrainage). Les promos sont appliquées au paiement au
  lot 6 ; d'ici là, le plan rappelle de les régler dans Tarifs.
- `lib/campaign.ts` (pur, testé) : le plan daté de J-60 à une semaine après le
  dernier jour. Chaque action est automatique (un playbook, le rapport du
  lundi, les rappels de solde), à valider (avec l'endroit où la faire), une
  mesure ou un jalon.
- `/admin/cohortes/nouvelle` : l'assistant, avec le plan calculé pendant la
  saisie (CISSP et CC ; les entrées du Bâtisseur IA s'ouvrent depuis leur J1
  et règlent leur campagne sur leur fiche).
- Fiche de cohorte : le plan avec ce qui est fait, et le réglage de la campagne.
- File d'actions : les actions « à valider » arrivées à leur date, avec
  « Ouvrir » et « Fait » (`campaign_done`), pendant deux semaines.
