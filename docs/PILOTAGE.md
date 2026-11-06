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
| 4 | Playbooks du cycle : Ouverture, Prospect chaud, Suivi d'appel, Dernier appel, Cohorte pleine, Fin de cohorte | À faire |
| 5 | Lancer une cohorte : assistant et plan de campagne J-60 → J0 | À faire |
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
