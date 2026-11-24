---
title: Bâtisseur IA · J3 · Structuration de l'activité et de ses données
category: ia-formateur
audience: internal
updated: 2026-11-24
deck: Batisseur-IA-J3.pptx
summary: Le support du formateur pour la J3 : fiche de la journée, cours sur les données, démonstration Kofi Traiteur, réflexe « avancer sans peur », labo pas à pas avec les textes à copier, dépannage, lexique, quiz et préparation de la J4.
---

## Fiche de la journée

À la fin de la J3, vos données ont une structure : elles entrent dans une base de données, se gèrent depuis vos écrans d'administration et alimentent un tableau de bord avec vos trois chiffres du lundi. Chaque fonctionnalité arrive avec son test, et vous savez revenir en arrière si quelque chose casse. Avant la J4, vous branchez la vitrine sur la base, vous faites tourner vos tests sur GitHub et vous créez vos clés : les demandes ne dorment plus dans une boîte mail.

| | |
| --- | --- |
| Public | Dirigeants, indépendants, porteurs de projet. Aucune compétence en programmation. |
| Durée | 5 heures de travail (plus une heure de pause) : cours, démonstration, réflexe du jour, labo, revue |
| Prérequis | La vitrine de la J2 en ligne ; la liste de ce que vous suivez aujourd'hui et vos trois chiffres du lundi (travail « avant la J3 ») |
| Résultat | Votre schéma de données, une base avec vos tables et des données de test, un espace d'administration protégé, un tableau de bord avec ses tests, et un retour arrière réussi en exercice. Avant la J4 : la vitrine reliée à la base, les tests lancés par GitHub Actions, et les clés de l'API du modèle et de Stripe (mode test) rangées dans Vercel |
| Lien avec la suite | Tous les agents de l'entreprise autonome travaillent sur cette base : vente et encaissement en J4, service client et opérations en J5, analyste (en lecture seule) et administratif en J6 |

Kofi Traiteur, l'entreprise de la démonstration, est un exemple fictif.

**Objectifs.** À la fin de la J3, vous savez :

1. décrire votre activité en entités, champs et liens ;
2. expliquer ce que fait une base de données et pourquoi un tableur ne suffit plus ;
3. faire construire et protéger un espace d'administration ;
4. choisir les chiffres d'un tableau de bord utile ;
5. exiger des tests et lire leur résultat ;
6. avancer sans peur : une petite étape à la fois, relire ce que Claude a changé, revenir à une version qui marchait.

**Déroulé** (heures de Montréal ; Afrique de l'Ouest : + 5 h en hiver, + 4 h en été)

| Heure | Bloc | Contenu |
| --- | --- | --- |
| 10 h 00 | Cours et atelier | Penser ses données : votre schéma sur papier |
| 10 h 45 | Cours | Base, écrans, tableau de bord, tests |
| 11 h 30 | Démonstration | Les données de Kofi Traiteur, du formulaire au tableau de bord |
| 12 h 30 | Pause | 1 heure |
| 13 h 30 | Labo | Réflexe retour arrière (30 min), puis quatre étapes : votre base, vos tables, votre administration, votre tableau de bord |
| 15 h 15 | Revue en groupe | Chacun montre son tableau de bord et un test qui passe |

## Cours 1 : penser ses données

Avant de construire quoi que ce soit, on décrit sur papier ce que l'entreprise doit retenir : des **entités** (les choses qu'on suit), leurs **champs** (ce qu'on note sur chacune) et leurs **liens** (qui dépend de qui). C'est le plan de la maison ; la base de données n'est que la construction.

### Trois mots suffisent

- **Entité** : une chose que vous suivez, une fiche par exemplaire. Client, demande, devis, commande, paiement.
- **Champ** : une information sur cette fiche, avec un type : texte, nombre, date, oui ou non, liste de choix. Le montant est un nombre, jamais un texte.
- **Lien** : une fiche pointe vers une autre. Un devis appartient à une demande, qui appartient à un client.

Un champ **statut** (nouvelle, envoyé, accepté, reçu…) dit où en est chaque fiche. C'est lui que les agents de la J4 feront avancer.

Pensez dès maintenant aux agents qui viendront. Si vous produisez ou livrez, prévoyez le stock et les livraisons (agent opérations, J5). Pour tous, les paiements et les factures doivent être des fiches à part entière : l'agent administratif de la J6 s'en servira pour ranger les pièces comptables.

**Le schéma de données de Kofi Traiteur (exemple fictif) · 5 entités**

| Entité | Champs | Statut |
| --- | --- | --- |
| Client | nom, téléphone, e-mail, consentement daté | — |
| Demande | besoin, date, nombre de personnes | nouvelle ou traitée |
| Devis | montant, validité | envoyé ou accepté |
| Commande | livraison | prévue ou livrée |
| Paiement | montant, moyen (carte, mobile money…) | attendu ou reçu |

Chaque lien se lit « a plusieurs » : un client a plusieurs demandes, une demande plusieurs devis, une commande plusieurs paiements (un acompte puis le solde, par exemple). Aucune information n'est recopiée : la commande pointe vers le devis, qui pointe vers la demande, qui pointe vers le client.

### Pourquoi le tableur ne suffit plus

| Avec un tableur | Avec une base de données |
| --- | --- |
| Le client est recopié à chaque commande, avec des fautes | Le client existe une fois ; les commandes pointent vers lui |
| Tout le monde peut tout effacer | Chaque écran donne des droits précis |
| Un agent IA ne peut pas y travailler en sûreté | Un agent lit et écrit par des actions contrôlées (J4) |
| Les chiffres se recalculent à la main | Le tableau de bord se calcule seul, à chaque visite |

Le tableur reste utile pour explorer. La base sert à faire tourner l'entreprise.

### Cinq règles pour un bon schéma

1. Une entité par chose réelle : ne mélangez pas client et commande sur la même fiche.
2. Les montants en nombres, avec la devise ; les dates en dates.
3. Un statut pour chaque fiche qui avance.
4. Le consentement du client est un champ daté, jamais une case cochée d'avance.
5. Ne gardez que ce dont vous avez besoin : chaque donnée personnelle est une responsabilité.

### Le prompt pour dessiner votre schéma

```
Je dirige [mon entreprise]. Voici ce que je suis aujourd'hui et où : [ma liste].
Voici les trois chiffres que je veux voir chaque lundi : [mes chiffres].

Propose le schéma de données minimal : les entités, leurs champs avec leur type, les liens entre elles, et un statut pour chaque entité qui avance.

Vérifie que mes trois chiffres peuvent être calculés avec ce schéma. N'ajoute aucune donnée personnelle inutile. Présente une entité par tableau.
```

L'IA propose, le dirigeant tranche : chacun corrige ensuite son schéma sur papier.

## Cours 2 : base, écrans, tableau de bord, tests

Le schéma devient une application en quatre couches : la base qui retient, les écrans qui permettent d'agir, le tableau de bord qui résume, et les tests qui vérifient que rien ne casse.

### 1. La base de données

Une base de données range vos fiches dans des **tables** (une par entité), une **ligne** par fiche, une **colonne** par champ. Chaque ligne a un **identifiant** unique ; un lien est simplement l'identifiant de l'autre fiche.

En atelier, on crée une base **Postgres** depuis Vercel (onglet Storage). Vercel ajoute seul la variable **DATABASE_URL** au projet : l'adresse et le mot de passe de la base ne passent jamais par le code, ni par une conversation avec Claude.

Une **migration** est un changement de structure (ajouter un champ, une table), enregistré et daté comme un changement de code. On ne modifie jamais la structure à la main.

### 2. Les écrans d'administration

L'espace d'administration est la partie privée de votre site : la liste des demandes, une fiche par client, les boutons pour faire avancer un statut. Trois exigences :

1. **Protégé** : il demande une connexion ; sans elle, il renvoie vers la page de connexion. Le mot de passe est une variable d'environnement.
2. **Compris en 10 secondes** : une liste, un filtre par statut, un bouton par action.
3. **Pensé pour le téléphone** : c'est là que vous le consulterez le plus.

La J5 ajoutera d'autres interfaces : l'e-mail et un assistant sur le site.

### 3. Le tableau de bord

Un bon tableau de bord tient en trois chiffres, ceux qui vous font décider le lundi matin. Pour chacun : la valeur de la semaine, celle de la semaine précédente, et l'écart.

| Bon chiffre | Mauvais chiffre |
| --- | --- |
| Demandes reçues cette semaine | Nombre total de visiteurs depuis le début |
| Taux de devis acceptés | Nombre de champs remplis |
| Montant encaissé, et montant attendu | Graphique de tout, sans décision à prendre |

### 4. Les tests

Un **test** est un petit programme qui vérifie une règle : « un formulaire sans consentement est refusé », « le taux d'acceptation de 3 devis sur 4 vaut 75 % ». Claude Code les écrit ; vous les exigez et vous lisez le résultat.

Avec l'**intégration continue** (GitHub Actions), les tests tournent à chaque demande de fusion. Un test rouge bloque la fusion : on ne publie pas une version qui casse une règle.

Trois règles d'or :

- un test pour chaque règle qui touche l'argent, le consentement ou un chiffre du tableau de bord ;
- un test rouge se corrige, il ne se supprime pas ;
- « tous les tests passent » se vérifie sur GitHub, pas sur parole.

### 5. Protéger les données

- Les données des clients ne servent qu'à ce pour quoi ils les ont données.
- Un client peut demander la suppression de sa fiche : prévoyez le bouton dès aujourd'hui.
- Pas de vraies données clients pour les essais : on travaille avec des **données de test** inventées.
- Aucun secret dans le code : DATABASE_URL et ADMIN_PASSWORD vivent dans les variables d'environnement de Vercel, jamais dans le code ni dans une conversation.
- La base est sauvegardée par l'hébergeur ; vérifiez la durée de conservation des sauvegardes de votre offre sur sa page officielle.

## Démonstration : les données de Kofi Traiteur

En 50 minutes, le formateur fait passer une demande de la vitrine de Kofi (exemple fictif) jusqu'au tableau de bord : elle entre dans la base, se traite dans l'administration et fait bouger un chiffre du lundi.

| Minutes | Ce qui est montré | Phrase à retenir |
| --- | --- | --- |
| 0 – 10 | Le schéma de Kofi sur papier, puis validé avec l'IA | « Le plan avant la maison. » |
| 10 – 20 | La base Postgres créée depuis Vercel, la première migration | « Aucun mot de passe dans le code. » |
| 20 – 30 | Le formulaire de la vitrine enregistre maintenant chaque demande | « L'e-mail prévient, la base retient. » |
| 30 – 40 | L'administration protégée : liste des demandes, statut, fiche client | « Compris en 10 secondes. » |
| 40 – 50 | Le tableau de bord et un test qui devient rouge, puis vert | « Un test rouge se corrige. » |

Le test rouge est volontaire : le formateur demande à Claude Code de calculer le taux d'acceptation en oubliant les devis refusés dans le total ; le test le détecte, la fusion est bloquée.

À chaque étape, le formateur fait résumer en français par Claude Code ce qui a changé avant d'accepter : c'est l'annonce du réflexe de l'après-midi.

Plan B : la branche « j3-donnees » du dépôt « kofi-traiteur-demo » contient chaque étape terminée.

## Bien travailler avec Claude : avancer sans peur

Le labo s'ouvre par le réflexe du jour, en 30 minutes, de 13 h 30 à 14 h 00 (heure de Montréal). Pour un non-développeur, la peur de casser ce qui marche est le premier frein : on n'ose plus rien changer, ou l'on accepte des modifications sans les comprendre. Ce bloc montre que rien n'est perdu tant qu'on avance par petites étapes, et il le prouve par un exercice de retour arrière.

### Quatre habitudes

- **Une petite étape** : une demande, une vérification, puis la suivante. Jamais dix choses à la fois.
- **Relire ce qui change** : Claude résume en français ce qu'il a modifié, avant que vous acceptiez.
- **Revenir en arrière** : l'historique Git garde chaque version ; on retrouve celle d'hier en une demande.
- **Les tests avec la fonctionnalité** : on les demande en même temps que la fonctionnalité, pas après.

### La fiche : quand quelque chose casse

À écrire à Claude Code :

```
Résume en français, en 5 lignes au plus, ce que tu as changé depuis la dernière version qui marchait.

Si la cause est ce changement, annule-le : reviens à la version précédente dans l'historique Git, sans rien supprimer d'autre.

Dis-moi ensuite comment vérifier que tout remarche.
```

### L'exercice du jour

1. Casser volontairement une page (par exemple : « Supprime le titre de la page d'accueil et mets le texte en blanc sur blanc. »).
2. Revenir à la version d'hier avec le texte ci-dessus.
3. Vérifier sur l'aperçu (le lien Preview) que la page est revenue.

- [ ] La page cassée est visible sur l'aperçu
- [ ] Le retour à la version précédente est fait par Claude Code, sans rien supprimer d'autre
- [ ] L'aperçu est redevenu normal

### Comment l'animer (30 min)

- 9 min : l'intercalaire (1 min) et les quatre habitudes (8 min) ; demander qui a déjà accepté un changement de Claude sans savoir ce qu'il faisait.
- 3 min : la fiche « Quand quelque chose casse », lue à voix haute.
- 18 min : l'exercice, chacun sur son dépôt « ma-vitrine », sur une branche et une demande de fusion, jamais sur la version en ligne. Le formateur passe vérifier les trois cases.
- Plan B si la branche est trop abîmée : fermer la demande de fusion sans la fusionner ; la version en ligne n'a pas bougé. En dernier recours, redéployer la version précédente sur Vercel (fiche 6, « Si c'est déjà en ligne »).
- À 14 h 00, passer aux étapes du labo même si quelques-uns n'ont pas fini : ils refont l'exercice avant la J4.
- Rappel : ne jamais coller un mot de passe ou une clé dans la conversation pour « aider » Claude.

Fiche réflexe correspondante : la fiche 6, « Revenir en arrière sans peur » (les quatre habitudes, le texte « Quand quelque chose casse », la marche à suivre si c'est déjà en ligne, et l'exercice). La fiche formule la troisième habitude ainsi : travailler sur une branche, chaque changement passant par une demande de fusion vérifiée sur le lien Preview. Elle est remplie quand le retour arrière de l'exercice est réussi et vérifié sur l'aperçu. Voir les [fiches réflexes](/admin/bibliotheque/fiches-reflexes-batisseur-ia) ; lien à donner aux participants : /ia/fiches.

## Atelier et labo

Le matin, chacun dessine son schéma. L'après-midi, après l'exercice « avancer sans peur », chacun le transforme en base, en administration et en tableau de bord, en quatre étapes (75 minutes), sur le dépôt « ma-vitrine » de la J2. On ne passe pas à l'étape suivante sans avoir coché la vérification.

Chaque demande à Claude Code passe par une demande de fusion, vérifiée sur le lien Preview avant d'être fusionnée, comme en J2.

Réflexe du jour appliqué au labo : à chaque étape, demandez le test de la règle en même temps que la fonctionnalité (ajoutez à la fin de la demande : « Écris aussi le test de cette règle. »). Claude Code les fait tourner à chaque étape ; leur lancement automatique par GitHub Actions se branche avant la J4.

| Étape | Ce que vous faites | Temps |
| --- | --- | --- |
| 1 | La base Postgres créée depuis Vercel, reliée au projet | 10 min |
| 2 | Les tables de votre schéma et des données de test | 20 min |
| 3 | L'administration protégée : liste, statut, fiche, suppression | 25 min |
| 4 | Le tableau de bord : vos trois chiffres, avec leurs tests | 20 min |

Total : 75 minutes, de 14 h 00 à 15 h 15 (heure de Montréal), après les 30 minutes du réflexe. Deux étapes de l'ancien labo se font chez soi avant la J4, parce que la J4 en a besoin : la vitrine qui enregistre chaque demande et les tests lancés par GitHub Actions (voir « Avant la J4 »). Le parcours complet sur téléphone passe en « Pour aller plus loin ».

### Atelier du matin · Votre schéma (30 min)

Avec la liste préparée avant la J3 et le prompt du Cours 1, faites proposer votre schéma, puis corrigez-le sur papier.

- [ ] 3 à 6 entités, chacune avec ses champs typés et un statut si elle avance
- [ ] Mes trois chiffres du lundi se calculent avec ce schéma
- [ ] Aucune donnée personnelle inutile

### Étape 1 · La base (10 min)

Dans Vercel, onglet Storage, créez une base Postgres et reliez-la au projet « ma-vitrine ».

- [ ] La variable DATABASE_URL apparaît dans les variables d'environnement du projet

### Étape 2 · Les tables et les données de test (20 min)

```
Voici mon schéma de données : [collez vos tableaux].

Crée les tables correspondantes dans la base Postgres dont l'adresse est dans la variable DATABASE_URL, avec une migration versionnée. Les montants en nombres entiers dans la plus petite unité de leur devise (centimes pour le dollar ou l'euro, francs pour le FCFA), avec leur devise ; les dates en dates ; les statuts en liste de choix.

Ajoute un script de données de test avec 10 fiches inventées par entité, sans aucune vraie personne.

N'écris aucun mot de passe dans le code.
```

- [ ] La migration est dans la demande de fusion
- [ ] Les données de test sont visibles dans l'onglet de la base sur Vercel

### Étape 3 · L'administration protégée (25 min)

Ajoutez d'abord dans Vercel la variable **ADMIN_PASSWORD** (un mot de passe long, que vous seul connaissez). Il va dans Vercel, jamais dans le code ni dans la conversation avec Claude. Puis :

```
Crée un espace /admin protégé par une connexion avec le mot de passe de la variable ADMIN_PASSWORD. Sans connexion, toute page /admin renvoie vers la page de connexion.

Pages : la liste des demandes, filtrable par statut, la plus récente en haut ; la fiche d'un client avec ses demandes ; un bouton pour changer le statut ; un bouton pour supprimer un client et toutes ses données, avec confirmation.

Conçu d'abord pour téléphone, compréhensible en 10 secondes.

Écris aussi le test de cette règle : sans connexion, /admin renvoie vers la page de connexion.
```

- [ ] En navigation privée, sur le lien Preview, /admin demande la connexion
- [ ] Je change le statut d'une demande depuis mon téléphone

### Étape 4 · Le tableau de bord et ses tests (20 min)

```
Ajoute en haut de /admin un tableau de bord avec trois chiffres : [vos trois chiffres]. Pour chacun : la valeur de la semaine en cours, celle de la semaine précédente et l'écart. Calculés depuis la base à chaque visite, aucun chiffre en dur.

Écris aussi les tests du calcul de chacun de mes trois chiffres sur des données connues, et fais-les tourner.
```

- [ ] Les trois chiffres correspondent à un calcul fait à la main sur les données de test
- [ ] Claude Code montre les tests en vert ; j'ai lu le nom de chaque test et je comprends ce qu'il vérifie

### Pour aller plus loin · Le parcours complet sur téléphone

Une fois la vitrine branchée sur la base (avant la J4) : un proche envoie une demande depuis la vitrine en ligne. Vous la retrouvez dans l'administration, vous changez son statut, le tableau de bord bouge.

- [ ] Le parcours fonctionne de bout en bout, sur téléphone

## Ça tourne ? La revue de 15 h 15

Chacun montre en une minute son tableau de bord sur téléphone et le nom d'un test qui passe.

- [ ] Mon schéma tient sur une page et calcule mes trois chiffres
- [ ] Mes tables et mes fiches de test sont dans la base
- [ ] /admin demande une connexion
- [ ] Je change un statut et je supprime un client de test depuis mon téléphone
- [ ] Mes trois chiffres s'affichent avec la semaine précédente et l'écart
- [ ] Chaque étape a son test, et il passe
- [ ] Aucun mot de passe ni adresse de base dans le code
- [ ] Réflexe du jour : j'ai réussi un retour arrière en exercice

Le formateur note les chiffres choisis par chacun : ils reviendront en J6 comme objectifs. Il note aussi, pour ceux qui n'ont pas fini, l'étape atteinte : elle passe avant le travail « avant la J4 », car la J4 a besoin de l'administration et du tableau de bord.

## Dépannage

| Symptôme | Quoi faire |
| --- | --- |
| « Can't reach database » ou erreur de connexion | Vérifiez que la base est reliée au projet dans Vercel, puis relancez le déploiement |
| La demande n'apparaît pas dans la base | Testez sur le lien Preview le plus récent ; donnez à Claude Code le message d'erreur du journal Vercel |
| /admin s'ouvre sans connexion | « /admin doit renvoyer vers la connexion sans session valide : corrige et ajoute un test » |
| Un chiffre du tableau de bord est faux | Calculez-le à la main sur les données de test et donnez le bon résultat à Claude Code, avec un test |
| Un test est rouge | Ouvrez le détail sur GitHub, copiez l'erreur à Claude Code ; ne supprimez jamais le test |
| La migration échoue | « La migration échoue avec ceci : [erreur]. Corrige sans perdre les données existantes. » |
| Tout est cassé après un changement | Envoyez le texte « Quand quelque chose casse » : revenez à la version qui marchait, puis cherchez la cause au calme |

Bloqué plus de 10 minutes : levez la main.

## Lexique

| Mot | En une phrase |
| --- | --- |
| Entité | Une chose que vous suivez : client, demande, devis |
| Champ | Une information sur une fiche, avec un type |
| Lien | Une fiche qui pointe vers une autre |
| Statut | Où en est une fiche : nouvelle, envoyé, reçu |
| Table | L'ensemble des fiches d'une entité, dans la base |
| Identifiant | Le numéro unique d'une fiche |
| Migration | Un changement de structure de la base, enregistré et daté |
| Données de test | Des fiches inventées pour essayer sans risque |
| Test | Un petit programme qui vérifie une règle |
| Intégration continue | Les tests lancés seuls à chaque demande de fusion |
| Historique Git | La liste de toutes les versions du projet, qui permet de retrouver celle d'hier |
| Retour arrière | Revenir à une version précédente qui marchait, sans rien supprimer d'autre |

## Quiz

1. Kofi note le nom du client sur chaque commande. Quel problème, et quelle solution ?
   - Le client est recopié avec des fautes ; il devient une entité, et la commande pointe vers lui.
2. Pourquoi un montant en nombre entier, dans la plus petite unité de sa devise (les centimes pour le dollar) ?
   - Pour calculer juste : un texte ne s'additionne pas, et les nombres à virgule créent des arrondis.
3. Un test est rouge juste avant une démonstration. Que faites-vous ?
   - On corrige la cause ou on ne fusionne pas. On ne supprime jamais le test.
4. Où est le mot de passe de la base ?
   - Dans la variable DATABASE_URL, créée par Vercel. Jamais dans le code, ni dans une conversation.
5. Un client demande que vous effaciez ses données. Où cliquez-vous ?
   - Sur sa fiche dans /admin, bouton de suppression, avec confirmation.
6. Après une modification, votre page d'accueil est cassée. Que demandez-vous à Claude Code ?
   - De résumer en français ce qui a changé depuis la dernière version qui marchait, puis, si c'est la cause, de revenir à la version précédente dans l'historique Git sans rien supprimer d'autre, et de dire comment vérifier.

## Avant la J4 · 1 heure

La J4 a besoin de deux morceaux de l'ancien labo : l'agent devis se déclenche quand une nouvelle demande arrive dans la base, et chaque étape de la J4 exige des tests verts sur GitHub. Elle a aussi besoin de vos clés : son labo commence directement par la grille de prix. Faites les deux premiers points dans cet ordre, chacun sur une branche et une demande de fusion vérifiée sur le lien Preview, comme au labo. Si quelque chose casse : fiche 6.

### 1 · La vitrine enregistre chaque demande (15 min)

```
Quand le formulaire de la vitrine est envoyé avec le consentement, enregistre le client (ou retrouve-le par son e-mail) et crée une demande au statut « nouvelle », avec la date et l'heure du consentement. Garde l'e-mail de notification de la J2.

Écris aussi le test de cette règle : un formulaire sans consentement est refusé.
```

- [ ] Une demande envoyée depuis le lien Preview apparaît dans la base et dans /admin
- [ ] L'e-mail de notification arrive toujours

### 2 · Les tests tournent sur GitHub (15 min)

```
Fais tourner tous les tests du projet sur GitHub Actions à chaque demande de fusion : le refus d'un formulaire sans consentement, le calcul de chacun de mes trois chiffres sur des données connues, et l'interdiction d'accès à /admin sans connexion. Ajoute ceux qui manquent.
```

- [ ] Sur GitHub, la demande de fusion affiche les tests en vert
- [ ] J'ai lu le nom de chaque test et je comprends ce qu'il vérifie

### 3 · Vos clés, rangées dans Vercel (15 min)

Les agents de la J4 appellent le modèle par son API, et l'encaissement passe par Stripe en mode test. Ces deux clés se créent maintenant, chacune dans son tableau de bord, et vont **uniquement** dans les variables d'environnement de Vercel. Une clé ne va jamais dans le code, ni dans une conversation, même avec Claude, ni dans un message à l'équipe.

1. Sur la console du fournisseur du modèle, créez une clé d'API. Fixez tout de suite une limite de dépense mensuelle, avec le montant que vous acceptez de dépenser. On paie aux tokens : les tarifs à jour sont sur la page de tarifs officielle du fournisseur.
2. Dans Vercel, projet « ma-vitrine », Settings, Environment Variables : ajoutez **ANTHROPIC_API_KEY** et collez la clé directement depuis la console.
3. Sur Stripe, passez et restez en **mode test**. Dans la partie développeurs du tableau de bord, page des clés d'API, copiez la clé secrète de test et ajoutez-la dans Vercel : **STRIPE_SECRET_KEY**. La clé du webhook viendra pendant le labo de la J4. Les frais de Stripe sont sur sa page de tarifs officielle.
4. Relancez le déploiement pour que les variables soient prises en compte.

- [ ] Une limite de dépense est fixée sur la console du fournisseur du modèle
- [ ] ANTHROPIC_API_KEY et STRIPE_SECRET_KEY sont dans Vercel, et Stripe est en mode test
- [ ] Aucune clé n'apparaît dans le code, dans le dépôt GitHub ni dans une conversation

Stripe n'ouvre pas de compte marchand dans tous les pays. Si le vôtre n'est pas couvert, signalez-le avant la J4 : un agrégateur local suit le même principe. Bloqué ? Venez à la pause de midi de la J4 : on termine les clés ensemble avant le labo, sans jamais afficher leur valeur.

### 4 · Vos règles (15 min)

- [ ] Écrivez vos règles de devis et de paiement : prix par produit ou service, remises, durée de validité, comment vos clients paient (carte, mobile money, virement) et ce qui se passe en cas de retard
- [ ] Listez ce qu'un agent ne doit jamais faire sans vous (exemple : accorder une remise, rembourser)

Si le retour arrière de l'exercice n'a pas été réussi en séance, refaites-le avec la fiche 6 ([fiches réflexes](/ia/fiches)). Les fiches 3 et 4 (règles d'un agent, 10 cas de test) seront parcourues en séance à la J4.
