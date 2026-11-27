---
title: Bâtisseur IA · J3 · Structuration de l'activité et de ses données
category: ia-formateur
audience: internal
updated: 2026-11-27
deck: Batisseur-IA-J3.pptx
summary: Le support du formateur pour la J3 : fiche de la journée, cours sur les données, démonstration Kofi Traiteur (un exemple parmi d'autres) et « Selon votre projet », réflexe « avancer sans peur », labo pas à pas sur le projet de chacun avec les textes à copier, dépannage, lexique, quiz et préparation de la J4.
---

## Fiche de la journée

À la fin de la J3, les données de votre projet ont une structure : elles entrent dans une base de données, se gèrent depuis vos écrans d'administration et alimentent un tableau de bord avec les trois chiffres de votre fiche projet. Les entités sont celles de votre projet : clients et commandes, membres et événements, produits et stocks, ou demandes internes. Chaque fonctionnalité arrive avec son test, et vous savez revenir en arrière si quelque chose casse. Avant la J4, vous branchez votre page publique sur la base, vous faites tourner vos tests sur GitHub et vous créez vos clés : les demandes ne dorment plus dans une boîte mail.

| | |
| --- | --- |
| Public | Dirigeants, indépendants, porteurs de projet. Aucune compétence en programmation. |
| Durée | 5 heures de travail (plus une heure de pause) : cours, démonstration, réflexe du jour, labo, revue |
| Prérequis | La première page publique de votre projet (J2) en ligne ; votre fiche projet (fiche 0), avec ses trois chiffres ; la liste de ce que vous suivez aujourd'hui (travail « avant la J3 »). Sans activité encore : les documents et données de test du kit de départ de la fiche 0 |
| Résultat | Le schéma de données de votre projet, une base avec vos tables et des données de test (réelles ou du kit de départ), un espace d'administration protégé, un tableau de bord de vos trois chiffres avec ses tests, et un retour arrière réussi en exercice. Avant la J4 : votre page publique reliée à la base, les tests lancés par GitHub Actions, la clé de l'API du modèle et, si votre projet vend, la clé Stripe (mode test), rangées dans Vercel |
| Lien avec la suite | Les agents que vous choisirez pour votre projet travaillent sur cette base : l'agent de l'action clé (et l'encaissement si le projet vend) en J4, deux agents choisis pour votre projet en J5 (communication, service client ou réponse aux membres, veille, opérations), analyste (en lecture seule) et administratif en J6 |

Kofi Traiteur, l'entreprise de la démonstration, est un exemple fictif, et un exemple parmi d'autres : chacun construit sur son propre projet, celui de sa fiche projet.

**Objectifs.** À la fin de la J3, vous savez :

1. décrire votre projet en entités, champs et liens ;
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
| 11 h 30 | Démonstration | Les données de Kofi Traiteur, du formulaire au tableau de bord ; puis « Selon votre projet » (3 min, sur les questions) |
| 12 h 30 | Pause | 1 heure |
| 13 h 30 | Labo | Réflexe retour arrière (30 min), puis quatre étapes sur votre projet : votre base, vos tables, votre administration, votre tableau de bord |
| 15 h 15 | Revue en groupe | Chacun montre son tableau de bord et un test qui passe |

## Cours 1 : penser ses données

Avant de construire quoi que ce soit, on décrit sur papier ce que votre projet doit retenir : des **entités** (les choses qu'on suit), leurs **champs** (ce qu'on note sur chacune) et leurs **liens** (qui dépend de qui). C'est le plan de la maison ; la base de données n'est que la construction.

### Trois mots suffisent

- **Entité** : une chose que vous suivez, une fiche par exemplaire. Client, commande, membre, événement, demande : cela dépend de votre projet.
- **Champ** : une information sur cette fiche, avec un type : texte, nombre, date, oui ou non, liste de choix. Le montant est un nombre, jamais un texte.
- **Lien** : une fiche pointe vers une autre. Une commande appartient à un client ; une inscription appartient à un membre et à un événement.

Un champ **statut** (nouvelle, envoyé, accepté, reçu, confirmée…) dit où en est chaque fiche. C'est lui que les agents de la J4 feront avancer.

Pensez dès maintenant aux agents qui viendront. Si vous produisez ou livrez, prévoyez le stock et les livraisons (agent opérations, J5). Si votre projet vend, les paiements et les factures doivent être des fiches à part entière : ils serviront à l'encaissement (J4) et au rangement des pièces comptables. Si votre projet ne vend pas (association gratuite, outil interne), pas besoin d'entité paiement : l'action clé se confirme par un statut.

**Le schéma de données de Kofi Traiteur (exemple fictif) · 5 entités**

| Entité | Champs | Statut |
| --- | --- | --- |
| Client | nom, téléphone, e-mail, consentement daté | — |
| Demande | besoin, date, nombre de personnes | nouvelle ou traitée |
| Devis | montant, validité | envoyé ou accepté |
| Commande | livraison | prévue ou livrée |
| Paiement | montant, moyen (carte, mobile money…) | attendu ou reçu |

Chaque lien se lit « a plusieurs » : un client a plusieurs demandes, une demande plusieurs devis, une commande plusieurs paiements (un acompte puis le solde, par exemple). Aucune information n'est recopiée : la commande pointe vers le devis, qui pointe vers la demande, qui pointe vers le client.

C'est le schéma d'un service sur devis. Pour les autres profils de projet, voir « Selon votre projet », après la démonstration : une boutique suit des produits et des stocks, une association des membres, des événements et des inscriptions, un outil interne des demandes et leurs suivis.

### Pourquoi le tableur ne suffit plus

| Avec un tableur | Avec une base de données |
| --- | --- |
| Le client est recopié à chaque commande, avec des fautes | Le client existe une fois ; les commandes pointent vers lui |
| Tout le monde peut tout effacer | Chaque écran donne des droits précis |
| Un agent IA ne peut pas y travailler en sûreté | Un agent lit et écrit par des actions contrôlées (J4) |
| Les chiffres se recalculent à la main | Le tableau de bord se calcule seul, à chaque visite |

Le tableur reste utile pour explorer. La base sert à faire tourner le projet, quel qu'il soit.

### Cinq règles pour un bon schéma

1. Une entité par chose réelle : ne mélangez pas client et commande sur la même fiche.
2. Les montants en nombres, avec la devise ; les dates en dates.
3. Un statut pour chaque fiche qui avance.
4. Le consentement de la personne est un champ daté, jamais une case cochée d'avance.
5. Ne gardez que ce dont vous avez besoin : chaque donnée personnelle est une responsabilité.

### Le prompt pour dessiner votre schéma

```
Voici ma fiche projet : [ma fiche]. Ce que je suis aujourd'hui et où : [ma liste, ou « rien encore »].
Mes trois chiffres, à voir chaque semaine : [mes trois chiffres].

Propose le schéma de données minimal : les entités, leurs champs avec leur type, les liens entre elles, et un statut pour chaque entité qui avance.

Vérifie que mes trois chiffres peuvent être calculés avec ce schéma. N'ajoute aucune donnée personnelle inutile. Présente une entité par tableau.
```

Si votre projet n'a pas encore d'activité, écrivez « rien encore » : Claude part de votre fiche projet, et les données de test du kit de départ (fiche 0) serviront au labo.

L'IA propose, le porteur du projet tranche : chacun corrige ensuite son schéma sur papier.

## Cours 2 : base, écrans, tableau de bord, tests

Le schéma devient une application en quatre couches : la base qui retient, les écrans qui permettent d'agir, le tableau de bord qui résume, et les tests qui vérifient que rien ne casse.

### 1. La base de données

Une base de données range vos fiches dans des **tables** (une par entité), une **ligne** par fiche, une **colonne** par champ. Chaque ligne a un **identifiant** unique ; un lien est simplement l'identifiant de l'autre fiche.

En atelier, on crée une base **Postgres** depuis Vercel (onglet Storage). Vercel ajoute seul la variable **DATABASE_URL** au projet : l'adresse et le mot de passe de la base ne passent jamais par le code, ni par une conversation avec Claude.

Une **migration** est un changement de structure (ajouter un champ, une table), enregistré et daté comme un changement de code. On ne modifie jamais la structure à la main.

### 2. Les écrans d'administration

L'espace d'administration est la partie privée de votre site : la liste de votre entité principale (demandes, commandes, inscriptions…), une fiche par personne, les boutons pour faire avancer un statut. Trois exigences :

1. **Protégé** : il demande une connexion ; sans elle, il renvoie vers la page de connexion. Le mot de passe est une variable d'environnement.
2. **Compris en 10 secondes** : une liste, un filtre par statut, un bouton par action.
3. **Pensé pour le téléphone** : c'est là que vous le consulterez le plus.

La J5 ajoutera d'autres interfaces : l'e-mail et un assistant sur le site.

### 3. Le tableau de bord

Un bon tableau de bord tient en trois chiffres, ceux qui vous font décider le lundi matin : ce sont les trois chiffres de votre fiche projet. Pour chacun : la valeur de la semaine, celle de la semaine précédente, et l'écart.

| Bon chiffre | Mauvais chiffre |
| --- | --- |
| Demandes, commandes ou inscriptions de la semaine | Nombre total de visiteurs depuis le début |
| Taux de devis acceptés, ou d'inscrits venus | Nombre de champs remplis |
| Montant encaissé et attendu, ou retards | Graphique de tout, sans décision à prendre |

### 4. Les tests

Un **test** est un petit programme qui vérifie une règle : « un formulaire sans consentement est refusé », « le taux d'acceptation de 3 devis sur 4 vaut 75 % ». Claude Code les écrit ; vous les exigez et vous lisez le résultat.

Avec l'**intégration continue** (GitHub Actions), les tests tournent à chaque demande de fusion. Un test rouge bloque la fusion : on ne publie pas une version qui casse une règle.

Trois règles d'or :

- un test pour chaque règle qui touche l'argent, le consentement ou un chiffre du tableau de bord ;
- un test rouge se corrige, il ne se supprime pas ;
- « tous les tests passent » se vérifie sur GitHub, pas sur parole.

### 5. Protéger les données

- Les données des personnes (clients, membres, collègues) ne servent qu'à ce pour quoi elles les ont données.
- Chacun peut demander la suppression de sa fiche : prévoyez le bouton dès aujourd'hui.
- Pas de vraies données personnelles pour les essais : on travaille avec des **données de test** inventées (celles du kit de départ, pour les projets sans activité).
- Aucun secret dans le code : DATABASE_URL et ADMIN_PASSWORD vivent dans les variables d'environnement de Vercel, jamais dans le code ni dans une conversation.
- La base est sauvegardée par l'hébergeur ; vérifiez la durée de conservation des sauvegardes de votre offre sur sa page officielle.

## Démonstration : les données de Kofi Traiteur

En 50 minutes, le formateur fait passer une demande de la vitrine de Kofi (exemple fictif) jusqu'au tableau de bord : elle entre dans la base, se traite dans l'administration et fait bouger un chiffre du lundi. Kofi est un exemple parmi d'autres : les participants retiennent les gestes, pas les entités de Kofi.

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

**Avec un volontaire.** Avant la démonstration, le formateur demande un volontaire. Pendant les minutes 0 – 10, il fait le schéma de ce participant en direct dans Claude Desktop, avec le prompt du Cours 1 et sa fiche projet (seulement la liste de ce qu'il suit, aucune vraie donnée personnelle à l'écran), puis vérifie avec le groupe que ses trois chiffres se calculent. Dix minutes au plus ; les minutes 10 – 50 reprennent Kofi, car elles demandent un dépôt préparé. Sans volontaire, le schéma de Kofi est fait comme prévu.

### Selon votre projet

À la fin de la démonstration, sur les 10 minutes de questions (3 minutes, avant la pause), une diapositive montre la même étape pour quatre profils de projet : les entités et les trois chiffres.

| Profil | Entités et chiffres |
| --- | --- |
| Service sur devis | Clients, demandes, devis, paiements. Chiffres : demandes reçues, devis acceptés, montant encaissé. |
| Boutique, produits | Clients, produits, stocks, commandes. Chiffres : commandes, ruptures de stock, montant encaissé. |
| Association, communauté | Membres, événements, inscriptions. Chiffres : nouveaux membres, inscrits, présents à l'événement. |
| Outil interne, projet à lancer | Demandes internes, personnes, suivis. Pas encore de données : celles du kit de départ (fiche 0). |

Le formateur fait dire à deux participants, de profils différents si possible, ce que donne l'étape pour leur projet : leurs entités principales et leurs trois chiffres. Il les note dans la conversation : ils serviront au labo. Ceux qui n'ont pas encore d'activité vérifient qu'ils ont généré les données de test du kit de départ.

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

Le matin, chacun dessine le schéma de son projet. L'après-midi, après l'exercice « avancer sans peur », chacun le transforme en base, en administration et en tableau de bord, en quatre étapes (75 minutes), sur le dépôt « ma-vitrine » de la J2. On ne passe pas à l'étape suivante sans avoir coché la vérification.

La compétence est la même pour tous ; la construction dépend du projet. Avant de commencer, chacun note à partir de sa fiche projet et de son schéma :

- **son entité principale**, celle que l'administration liste : demandes (service sur devis), commandes (boutique), inscriptions (association, communauté) ou demandes internes (outil interne) ;
- **ses trois chiffres**, ceux de sa fiche projet ;
- **ses données de test** : inventées à partir de son activité, ou celles du kit de départ de la fiche 0 s'il n'a pas encore d'activité.

Dans les textes à copier, remplacez les crochets par ce que dit votre fiche projet.

Chaque demande à Claude Code passe par une demande de fusion, vérifiée sur le lien Preview avant d'être fusionnée, comme en J2.

Réflexe du jour appliqué au labo : à chaque étape, demandez le test de la règle en même temps que la fonctionnalité (ajoutez à la fin de la demande : « Écris aussi le test de cette règle. »). Claude Code les fait tourner à chaque étape ; leur lancement automatique par GitHub Actions se branche avant la J4.

| Étape | Ce que vous faites | Temps |
| --- | --- | --- |
| 1 | La base Postgres créée depuis Vercel, reliée au projet | 10 min |
| 2 | Les tables de vos entités et des données de test | 20 min |
| 3 | L'administration protégée : liste, statut, fiche, suppression | 25 min |
| 4 | Le tableau de bord : les trois chiffres de votre fiche projet, testés | 20 min |

Total : 75 minutes, de 14 h 00 à 15 h 15 (heure de Montréal), après les 30 minutes du réflexe. Deux étapes de l'ancien labo se font chez soi avant la J4, parce que la J4 en a besoin : la page publique qui enregistre chaque demande et les tests lancés par GitHub Actions (voir « Avant la J4 »). Le parcours complet sur téléphone passe en « Pour aller plus loin ».

### Atelier du matin · Votre schéma (30 min)

Avec votre fiche projet, la liste préparée avant la J3 et le prompt du Cours 1, faites proposer votre schéma, puis corrigez-le sur papier. Sans activité encore : générez d'abord les documents et données de test du kit de départ (fiche 0), puis faites proposer le schéma.

- [ ] 3 à 6 entités, celles de mon projet, chacune avec ses champs typés et un statut si elle avance
- [ ] Les trois chiffres de ma fiche projet se calculent avec ce schéma
- [ ] Aucune donnée personnelle inutile

### Étape 1 · La base (10 min)

Dans Vercel, onglet Storage, créez une base Postgres et reliez-la au projet « ma-vitrine ».

- [ ] La variable DATABASE_URL apparaît dans les variables d'environnement du projet

### Étape 2 · Les tables et les données de test (20 min)

```
Voici le schéma de données de [mon projet] : [collez vos tableaux].

Crée les tables correspondantes dans la base Postgres dont l'adresse est dans la variable DATABASE_URL, avec une migration versionnée. Les montants en nombres entiers dans la plus petite unité de leur devise (centimes pour le dollar ou l'euro, francs pour le FCFA), avec leur devise ; les dates en dates ; les statuts en liste de choix.

Ajoute un script de données de test avec 10 fiches inventées par entité, sans aucune vraie personne. [Si j'ai le kit de départ : pars des données de test que voici : collez-les.]

N'écris aucun mot de passe dans le code.
```

Si votre projet ne vend pas, il n'y a pas de montant à stocker : supprimez simplement cette consigne.

- [ ] La migration est dans la demande de fusion
- [ ] Les données de test sont visibles dans l'onglet de la base sur Vercel

### Étape 3 · L'administration protégée (25 min)

Ajoutez d'abord dans Vercel la variable **ADMIN_PASSWORD** (un mot de passe long, que vous seul connaissez). Il va dans Vercel, jamais dans le code ni dans la conversation avec Claude. Puis :

```
Crée un espace /admin protégé par une connexion avec le mot de passe de la variable ADMIN_PASSWORD. Sans connexion, toute page /admin renvoie vers la page de connexion.

Pages : la liste des [mon entité principale : demandes, commandes, inscriptions…], filtrable par statut, la plus récente en haut ; la fiche d'une personne avec son historique ; un bouton pour changer le statut ; un bouton pour supprimer une personne et toutes ses données, avec confirmation.

Conçu d'abord pour téléphone, compréhensible en 10 secondes.

Écris aussi le test de cette règle : sans connexion, /admin renvoie vers la page de connexion.
```

- [ ] En navigation privée, sur le lien Preview, /admin demande la connexion
- [ ] Je change le statut d'une fiche de mon entité principale depuis mon téléphone

### Étape 4 · Le tableau de bord et ses tests (20 min)

```
Ajoute en haut de /admin un tableau de bord avec trois chiffres : [mes trois chiffres, ceux de ma fiche projet]. Pour chacun : la valeur de la semaine en cours, celle de la semaine précédente et l'écart. Calculés depuis la base à chaque visite, aucun chiffre en dur.

Écris aussi les tests du calcul de chacun de mes trois chiffres sur des données connues, et fais-les tourner.
```

- [ ] Les trois chiffres correspondent à un calcul fait à la main sur les données de test
- [ ] Claude Code montre les tests en vert ; j'ai lu le nom de chaque test et je comprends ce qu'il vérifie

### Pour aller plus loin · Le parcours complet sur téléphone

Une fois la page publique branchée sur la base (avant la J4) : un proche envoie une demande (ou une inscription, une commande) depuis la page en ligne. Vous la retrouvez dans l'administration, vous changez son statut, le tableau de bord bouge.

- [ ] Le parcours fonctionne de bout en bout, sur téléphone

## Ça tourne ? La revue de 15 h 15

Chacun montre en une minute son tableau de bord sur téléphone et le nom d'un test qui passe. La revue vérifie des critères communs à tous les projets (ça marche sur mon projet, c'est testé, c'est protégé, aucun secret dans le code), pas la ressemblance avec Kofi.

- [ ] Mon schéma tient sur une page et calcule mes trois chiffres
- [ ] Mes tables et mes fiches de test sont dans la base
- [ ] /admin demande une connexion
- [ ] Je change un statut et je supprime une fiche de test depuis mon téléphone
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
| Entité | Une chose que vous suivez : client, commande, membre, demande |
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

1. Kofi note le nom du client sur chaque commande ; une association note le nom du membre sur chaque inscription. Quel problème, et quelle solution ?
   - La personne est recopiée avec des fautes ; elle devient une entité, et la commande ou l'inscription pointe vers elle.
2. Pourquoi un montant en nombre entier, dans la plus petite unité de sa devise (les centimes pour le dollar) ?
   - Pour calculer juste : un texte ne s'additionne pas, et les nombres à virgule créent des arrondis.
3. Un test est rouge juste avant une démonstration. Que faites-vous ?
   - On corrige la cause ou on ne fusionne pas. On ne supprime jamais le test.
4. Où est le mot de passe de la base ?
   - Dans la variable DATABASE_URL, créée par Vercel. Jamais dans le code, ni dans une conversation.
5. Un client ou un membre demande que vous effaciez ses données. Où cliquez-vous ?
   - Sur sa fiche dans /admin, bouton de suppression, avec confirmation.
6. Après une modification, votre page d'accueil est cassée. Que demandez-vous à Claude Code ?
   - De résumer en français ce qui a changé depuis la dernière version qui marchait, puis, si c'est la cause, de revenir à la version précédente dans l'historique Git sans rien supprimer d'autre, et de dire comment vérifier.

## Avant la J4 · 1 heure

La J4 a besoin de deux morceaux de l'ancien labo : l'agent qui fait l'action clé de votre projet (devis, réservation, inscription ou commande) se déclenche quand une nouvelle demande arrive dans la base, et chaque étape de la J4 exige des tests verts sur GitHub. Elle a aussi besoin de vos clés et de vos règles : son labo commence directement par elles. Faites les deux premiers points dans cet ordre, chacun sur une branche et une demande de fusion vérifiée sur le lien Preview, comme au labo. Si quelque chose casse : fiche 6.

### 1 · La page publique enregistre chaque demande (15 min)

Votre page publique de la J2 (vitrine, page d'inscription, page de présentation d'un outil) enregistre désormais ce qu'elle reçoit :

```
Quand le formulaire de ma page publique est envoyé avec le consentement, enregistre la personne (ou retrouve-la par son e-mail) et crée [mon entité principale : demande, commande, inscription…] au statut « nouvelle », avec la date et l'heure du consentement. Garde l'e-mail de notification de la J2.

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

Les agents de la J4 appellent le modèle par son API, et, si votre projet vend, l'encaissement passe par Stripe en mode test. Ces clés se créent maintenant, chacune dans son tableau de bord, et vont **uniquement** dans les variables d'environnement de Vercel. Une clé ne va jamais dans le code, ni dans une conversation, même avec Claude, ni dans un message à l'équipe.

**En coulisses.** La clé d'API est le badge, les variables d'environnement de Vercel sont le coffre (J2, fiche 8). Pour vous faire guider, donnez à Claude la demande type de la fiche 8 : il vous dit où aller et quel nom donner à chaque variable, sans jamais vous demander la valeur.

1. Sur la console du fournisseur du modèle, créez une clé d'API. Fixez tout de suite une limite de dépense mensuelle, avec le montant que vous acceptez de dépenser. On paie aux tokens : les tarifs à jour sont sur la page de tarifs officielle du fournisseur.
2. Dans Vercel, projet « ma-vitrine », Settings, Environment Variables : ajoutez **ANTHROPIC_API_KEY** et collez la clé directement depuis la console.
3. Si votre projet vend : sur Stripe, passez et restez en **mode test**. Dans la partie développeurs du tableau de bord, page des clés d'API, copiez la clé secrète de test et ajoutez-la dans Vercel : **STRIPE_SECRET_KEY**. La clé du webhook viendra pendant le labo de la J4. Les frais de Stripe sont sur sa page de tarifs officielle.
4. Relancez le déploiement pour que les variables soient prises en compte.

- [ ] Une limite de dépense est fixée sur la console du fournisseur du modèle
- [ ] ANTHROPIC_API_KEY est dans Vercel ; si mon projet vend, STRIPE_SECRET_KEY aussi, et Stripe est en mode test
- [ ] Aucune clé n'apparaît dans le code, dans le dépôt GitHub ni dans une conversation

Si votre projet ne vend pas (association gratuite, outil interne), seule la clé d'API est nécessaire : en J4, votre agent confirme l'action clé au lieu d'encaisser. Stripe n'ouvre pas de compte marchand dans tous les pays. Si le vôtre n'est pas couvert, signalez-le avant la J4 : un agrégateur local suit le même principe. Bloqué ? Venez à la pause de midi de la J4 : on termine les clés ensemble avant le labo, sans jamais afficher leur valeur.

### 4 · Vos règles (15 min)

- [ ] Écrivez les règles de l'action clé de votre projet (ligne « L'action clé » de votre fiche projet) : pour un devis, les prix, remises et durée de validité ; pour une réservation ou une inscription, les places, délais et conditions ; pour une commande, les produits, stocks et délais
- [ ] Si votre projet vend : comment vos clients paient (carte, mobile money, virement) et ce qui se passe en cas de retard
- [ ] Listez ce qu'un agent ne doit jamais faire sans vous (exemple : accorder une remise, rembourser, refuser une inscription)

Si le retour arrière de l'exercice n'a pas été réussi en séance, refaites-le avec la fiche 6 ([fiches réflexes](/ia/fiches)). Les fiches 3 et 4 (règles d'un agent, 10 cas de test) seront parcourues en séance à la J4.
