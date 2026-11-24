---
title: Bâtisseur IA · J2 · Identification des processus métiers et fondations architecturales
category: ia-formateur
audience: internal
updated: 2026-11-24
deck: Batisseur-IA-J2.pptx
summary: Le support complet de la J2 : la carte des processus et les priorités, les fondations Claude Code, GitHub et Vercel, la démonstration Kofi Traiteur, le réflexe « cadrer Claude Code » (CLAUDE.md), le labo de la vitrine en ligne, le dépannage, le lexique et le quiz.
---

## Fiche de la journée

À la fin de la J2, chaque participant a la carte de ses processus, sait lequel automatiser en premier, a écrit le CLAUDE.md de son projet, et sa vitrine est en ligne à son nom de domaine : première brique de son système.

| | |
| --- | --- |
| Public | Dirigeants, indépendants, porteurs de projet. Aucune compétence en programmation. |
| Durée | 5 heures de travail : cours, démonstration, réflexe du jour, labo, revue |
| Prérequis | La J1 ; la liste de vos tâches de la semaine (travail « avant la J2 ») ; comptes GitHub et Vercel créés ; un accès à Claude Code ; un nom de domaine (ou l'achat prévu) ; les fiches réflexes reçues avant la J1 |
| Résultat | Votre carte de processus, vos trois priorités d'automatisation, votre CLAUDE.md, votre vitrine en ligne avec un formulaire qui vous prévient |
| Lien avec la suite | J3 structure les données derrière la vitrine ; J4 à J6 automatisent les priorités choisies aujourd'hui ; le CLAUDE.md vous suit jusqu'à la J6 |

**Objectifs.** À la fin de la J2, vous savez :

1. décrire votre activité en processus : déclencheur, étapes, outil, résultat ;
2. choisir quoi automatiser d'abord avec une grille simple ;
3. expliquer le rôle de Claude Code, GitHub, Vercel et du nom de domaine ;
4. diriger Claude Code avec la boucle décrire, vérifier, corriger, sauvegarder ;
5. cadrer Claude Code : sa mémoire du projet (CLAUDE.md), un plan avant d'agir, ses permissions ;
6. garder les secrets hors du code et hors des conversations.

**Déroulé** (heures de Montréal ; Afrique de l'Ouest : + 5 h en hiver, + 4 h en été ; Afrique centrale : + 6 h en hiver, + 5 h en été)

| Heure | Bloc | Contenu |
| --- | --- | --- |
| 10 h 00 | Cours et atelier | Cartographier vos processus, choisir vos priorités |
| 11 h 00 | Cours | Les fondations : Claude Code, GitHub, Vercel, domaine |
| 11 h 30 | Démonstration | La vitrine de Kofi Traiteur, de zéro à en ligne |
| 12 h 30 | Pause | 1 heure |
| 13 h 30 | Labo | Réflexe CLAUDE.md, puis votre vitrine, votre formulaire, votre domaine |
| 15 h 15 | Revue en groupe | Carte et vitrine sur téléphone |

## Cours 1 : cartographier vos processus

On n'automatise pas une entreprise : on automatise des processus, un par un, en commençant par celui qui revient le plus souvent, prend le plus de temps et peut le moins mal tourner.

### Qu'est-ce qu'un processus ?

Un processus est une suite d'étapes qui part d'un **déclencheur** et aboutit à un **résultat** pour un client ou pour vous. Chaque étape a un **responsable** et un **outil** (téléphone, cahier, tableur, WhatsApp, e-mail).

| Processus | Déclencheur | Étapes | Outil aujourd'hui | Résultat |
| --- | --- | --- | --- | --- |
| Demande de devis | Un client appelle ou écrit | Noter le besoin, calculer, envoyer, relancer | WhatsApp, calculatrice | Un devis accepté ou refusé |
| Encaissement | Le devis est accepté | Envoyer les moyens de paiement, vérifier, confirmer | Mobile money, cahier | Commande payée |
| Suivi des chiffres | Fin de semaine | Additionner les ventes, comparer | Tableur | Je sais où j'en suis |

Exemple : Kofi Traiteur, un traiteur pour entreprises à Abidjan. C'est un exemple fictif, qui sert de fil conducteur à toute la formation.

### Les sept familles de processus, et l'agent qui les prendra en charge

| Famille | Exemples | Agent | Journée |
| --- | --- | --- | --- |
| **Attirer** | Vitrine, réseaux, référencement | Communication | J2 vitrine, J5 agent |
| **Vendre** | Demandes, devis, rendez-vous, relances | Vente | J4 |
| **Encaisser** | Paiements, factures, reçus, impayés | Encaissement | J4 |
| **Servir** | Questions des clients, suivi des commandes, réclamations | Service client | J5 |
| **Livrer** | Production, stock, planning, livraisons, fournisseurs | Opérations, selon l'activité | J5 |
| **Administrer** | Pièces comptables, échéances, données personnelles | Administratif | J6 |
| **Piloter** | Chiffres, décisions, priorités, veille du marché | Analyste et veille | J3, J5, J6 |

C'est la carte de l'entreprise autonome vue en J1 : chaque famille aura son agent. Une activité de service n'a parfois rien à « livrer » au sens logistique ; une activité qui produit ou livre en a besoin dès le départ.

### Choisir quoi automatiser d'abord

Notez chaque processus de 1 à 3 sur trois critères, puis multipliez fréquence par temps et divisez par le risque.

| Critère | 1 | 2 | 3 |
| --- | --- | --- | --- |
| Fréquence | Chaque mois | Chaque semaine | Chaque jour |
| Temps passé | Moins de 15 min | 15 min à 1 h | Plus d'1 h |
| Risque si l'IA se trompe | Faible : brouillon relu | Moyen : client gêné | Élevé : argent ou données |

Les trois scores les plus hauts sont vos priorités. Règle : un processus à risque élevé est automatisé avec une validation humaine, jamais seul.

### Le prompt pour cartographier avec l'IA

```
Je dirige [mon entreprise], qui [ce que je vends] à [mes clients].

Voici mes tâches de la semaine avec le temps passé : [collez votre liste].

Regroupe-les en processus. Pour chacun : déclencheur, étapes, outil utilisé, résultat. Puis note fréquence, temps et risque de 1 à 3 avec la grille suivante : [collez la grille].

Présente le résultat en tableau, du score le plus haut au plus bas. N'ajoute aucune tâche que je n'ai pas citée.
```

L'IA propose, vous décidez : c'est vous qui connaissez votre activité.

## Cours 2 : les fondations architecturales

Quatre outils forment la base sur laquelle les six journées construisent. Vous décrivez en français, Claude Code écrit, GitHub garde chaque version, Vercel publie, votre domaine donne l'adresse.

**Les fondations, quatre outils, un parcours :**

1. **Claude Code**, l'artisan : il écrit le code à partir de votre description.
2. **GitHub**, le classeur : chaque version datée, retour arrière possible.
3. **Vercel**, l'hébergeur : chaque sauvegarde se publie en une minute environ.
4. **Votre domaine**, l'adresse : relié une fois pour toutes, en HTTPS.

Rien ne part en ligne sans votre regard : chaque changement a d'abord un lien **Preview**, puis vous le fusionnez.

### Les mots de la journée

- **Claude Code** : l'agent de la J1 appliqué au code. Il lit votre projet, propose des changements, les exécute avec votre accord.
- **Dépôt (repository)** : le dossier de votre application sur GitHub, avec tout son historique. Toujours privé.
- **Branche et demande de fusion (pull request)** : un brouillon de changement, relu puis fusionné. Analogie : le brouillon, la relecture, l'impression.
- **Déploiement** : la publication d'une version. Vercel en fait un à chaque fusion, en une minute environ.
- **DNS** : l'annuaire d'Internet. On y indique que votre nom de domaine pointe vers Vercel.
- **Variables d'environnement** : les clés et réglages secrets, stockés dans Vercel, lus par l'application. Jamais dans le code.
- **CLAUDE.md** : le fichier, à la racine du projet, où vous écrivez les règles de votre projet ; Claude Code le relit au début de chaque séance.

### La méthode : décrire, vérifier, corriger, sauvegarder

1. **Décrire** : le client, ce qu'il voit, ce qu'il peut faire. 3 à 6 phrases.
2. **Vérifier** : ouvrir la page et la tester comme un client. On juge le résultat, pas le code.
3. **Corriger** : une demande à la fois, précise (« le bouton est caché sur téléphone »).
4. **Sauvegarder** : quand c'est bon, le changement part sur GitHub, puis en ligne.

L'erreur classique : demander dix choses à la fois. Une phrase, une correction.

Une bonne description tient en cinq phrases : le but de la page, le client visé, les sections dans l'ordre, l'action attendue (le bouton), le ton, et une contrainte (le téléphone). Exemple pour Kofi Traiteur :

```
Crée un site d'une page pour Kofi Traiteur, un service de traiteur pour entreprises à Abidjan.

Le client est une assistante ou un responsable RH qui organise un déjeuner d'équipe ou un séminaire.

Sections dans l'ordre : une accroche avec un bouton « Demander un devis », trois menus types avec leur prix, comment ça marche en 3 étapes, les questions fréquentes, puis le formulaire de devis.

Ton chaleureux et professionnel. Lisible d'abord sur téléphone.
```

Aucun mot technique n'est nécessaire, sauf la dernière ligne du vrai message (Next.js, Vercel), donnée telle quelle dans le labo.

### Quatre règles de sécurité dès aujourd'hui

1. Aucune clé dans le code ni dans un message : les secrets vont dans les variables d'environnement de Vercel. Jamais dans GitHub, jamais dans une conversation, même avec Claude.
2. Un dépôt privé : vous choisissez qui voit votre code.
3. Un consentement explicite : la case « J'accepte d'être recontacté » n'est jamais cochée d'avance.
4. Rien ne va en ligne sans que vous l'ayez vu.

Ces quatre règles reviendront chaque journée. À la J6, elles deviennent les garde-fous du pilote automatique.

## Démonstration : de la carte de Kofi à sa vitrine en ligne

Le formateur montre d'abord la carte de Kofi Traiteur (exemple fictif) et sa première priorité (les demandes de devis), puis construit en 45 minutes la vitrine qui recueille ces demandes.

**La carte de Kofi** (score = fréquence × temps ÷ risque)

| Processus | Fréquence | Temps | Risque | Score | Agent et journée |
| --- | --- | --- | --- | --- | --- |
| Demandes de devis | 3 | 3 | 1 | 9 | Vitrine J2, agent vente J4 |
| Planning des livraisons | 3 | 2 | 1 | 6 | Agent opérations J5 |
| Relances des devis | 2 | 2 | 1 | 4 | Agent vente J4 |
| Publications sur les réseaux | 2 | 2 | 1 | 4 | Agent communication J5 |
| Suivi des chiffres | 2 | 3 | 2 | 3 | Tableau de bord J3, analyste J6 |
| Encaissement | 3 | 2 | 3 | 2 | Agent encaissement J4, avec validation |
| Pièces comptables | 1 | 2 | 2 | 1 | Agent administratif J6 |

Kofi livre des repas : il a besoin d'un agent opérations ; un consultant n'en aurait pas besoin.

**La vitrine en 45 minutes**

| Minutes | Ce qui est montré | Phrase à retenir |
| --- | --- | --- |
| 0 – 10 | Fiche projet et dépôt GitHub privé | « Tout part de vos mots. » |
| 10 – 25 | Premier message à Claude Code, aperçu, deux corrections | « Une correction à la fois. » |
| 25 – 32 | Vercel : premier lien en ligne | « Chaque sauvegarde se publie seule. » |
| 32 – 40 | Formulaire de devis avec consentement | « La vitrine travaille la nuit. » |
| 40 – 45 | Nom de domaine, puis une vraie demande | « Elle arrive chez Kofi. » |

Plan B : si le réseau ou un compte bloque, basculer sur le dépôt de secours « kofi-traiteur-demo », déjà prêt.

## Bien travailler avec Claude : cadrer Claude Code

Le réflexe du jour se fait en 30 à 45 minutes au début du labo, pris sur la pratique guidée (pas sur la démonstration). Il prépare le dépôt avant que Claude Code y écrive une ligne, et il sert ensuite à chaque journée.

**Pourquoi c'est important pour un non-développeur.** Claude Code va vite. Sans règles écrites, il oublie d'une séance à l'autre ce que vous lui avez dit, et il peut agir avant que vous ayez compris ce qu'il fait. Le cadrer, c'est passer de « subir l'outil » à « le diriger ».

### Cadrer Claude Code avant qu'il écrive une ligne

- **La mémoire du projet** : le fichier CLAUDE.md : langue, règles, interdits. Claude le relit à chaque séance.
- **Le plan avant d'agir** : demander un plan, le corriger, puis seulement laisser faire.
- **Les secrets** : une clé ne va jamais dans le code ni dans la conversation : seulement dans Vercel.
- **Les permissions** : ce que Claude fait seul, ce qu'il doit vous demander avant.

### Votre CLAUDE.md, en une page

C'est la fiche réflexe 1, le CLAUDE.md type. L'extrait de la diapositive :

```markdown
# CLAUDE.md — [Nom de l'entreprise]
## Le projet : [ce que fait l'entreprise, pour qui]
## Comment travailler avec moi
- Explique en français simple ce que tu vas faire.
- Propose un plan court et attends mon accord.
- Une petite étape à la fois, avec ses tests.
## Ne jamais
- Une clé ou un mot de passe dans le code.
```

La version complète (le projet, langue et ton, comment travailler avec moi, règles de l'entreprise, ne jamais, outils) est dans les fiches réflexes : [fiches réflexes Bâtisseur IA](/admin/bibliotheque/fiches-reflexes-batisseur-ia) ; lien à donner aux participants : `/ia/fiches`. Ses exemples suivent l'Atelier Adjoa, un atelier de couture fictif.

### L'exercice : vérifier que Claude a bien la mémoire du projet

1. Ouvrir une nouvelle séance de Claude Code sur le dépôt.
2. Demander : « Quelles sont les règles de ce projet ? »
3. Claude les cite sans aide. Sinon : vérifier que le fichier s'appelle exactement `CLAUDE.md`, qu'il est à la racine du dépôt et qu'il a été fusionné.

### Comment l'animer (30 à 45 min)

| Temps | Ce que fait le formateur | Ce que font les participants |
| --- | --- | --- |
| 5 à 10 min | Présente les quatre points, avec un exemple pour chacun tiré de la journée (le plan avant l'étape 3, les secrets de l'étape 6) | Proposent la première règle qu'ils donneraient à Claude |
| 15 à 20 min | Passe d'écran en écran | Remplissent la fiche 1 à partir de leur fiche projet du matin |
| 10 à 15 min | Vérifie l'exercice chez chacun | Ajoutent le CLAUDE.md à la racine du dépôt « ma-vitrine » dès que Claude Code y est ouvert (après les étapes 1 et 2), puis font l'exercice de vérification |

Points de vigilance : aucune clé, même d'exemple, dans le CLAUDE.md (on écrit le nom d'une variable, jamais sa valeur) ; à l'étape 3, Claude Code doit d'abord proposer un plan, que le participant lit et valide.

## Atelier et labo

Le matin, chacun dresse sa carte de processus. L'après-midi, après le réflexe du jour, chacun met en ligne la vitrine qui sert sa première priorité, en huit étapes (1 h 50 au total). On ne passe pas à l'étape suivante sans avoir coché la vérification.

Les noms de menus des outils peuvent évoluer : le formateur montre l'écran du jour.

### Atelier du matin · Votre carte (40 min)

Avec votre liste de tâches et le prompt du Cours 1, faites produire le tableau de vos processus, puis corrigez-le à la main : c'est vous qui connaissez votre activité.

- [ ] Ma carte contient au moins 5 processus, avec déclencheur et résultat
- [ ] J'ai mes trois priorités, et je sais lesquelles demandent une validation humaine
- [ ] J'ai écrit ma fiche projet en 6 lignes : offre, client visé, prix ou fourchette, action attendue (devis, rendez-vous, commande), contact, ton

### Étape 1 · Le dépôt GitHub (10 min)

Créez un dépôt **privé** nommé « ma-vitrine », avec un fichier README.

- [ ] Le dépôt existe et il est privé

### Étape 2 · Claude Code sur le dépôt (10 min)

Ouvrez Claude Code dans votre navigateur, reliez-le à GitHub et choisissez le dépôt « ma-vitrine ». Ajoutez ensuite votre CLAUDE.md (réflexe du jour) à la racine du dépôt.

- [ ] Claude Code voit le dépôt et son README
- [ ] Mon CLAUDE.md est dans le dépôt et Claude le cite

### Étape 3 · La page d'accueil (25 min)

Adaptez puis envoyez :

```
Crée un site d'une page pour [mon entreprise], qui [ce que je vends] à [mes clients] à [ville ou en ligne].

Le client visé est [qui il est et ce qu'il cherche].

Sections dans l'ordre : une accroche avec un bouton « [action attendue] », mes offres avec leur prix, comment ça marche en 3 étapes, les questions fréquentes, puis un formulaire de contact.

Ton [chaleureux / sobre]. Lisible d'abord sur téléphone. N'invente aucun chiffre, aucun témoignage, aucune référence client.

Utilise Next.js, pour un déploiement sur Vercel. Propose les changements dans une demande de fusion.
```

Avec votre CLAUDE.md, Claude Code propose d'abord un plan court : lisez-le, corrigez-le si besoin, puis donnez votre accord.

- [ ] Une demande de fusion est ouverte sur GitHub
- [ ] Aucun chiffre ni témoignage que je n'ai pas donné

### Étape 4 · Mise en ligne avec Vercel (15 min)

Sur Vercel, importez le dépôt « ma-vitrine ». Vercel crée un lien **Preview** pour la demande de fusion. Ouvrez-le sur votre téléphone.

- [ ] Je vois ma page sur mon téléphone, via le lien Preview

### Étape 5 · Deux corrections, puis la fusion (15 min)

Une demande à la fois, par exemple : « Le bouton est caché sous l'image sur téléphone : remonte-le. » Vérifiez chaque fois sur le lien Preview, puis fusionnez sur GitHub.

- [ ] Mes deux corrections sont visibles
- [ ] La demande est fusionnée et le site est à jour à l'adresse Vercel principale

### Étape 6 · Le formulaire qui vous prévient (20 min)

Créez une clé sur resend.com. Ajoutez dans Vercel (Settings, Environment Variables) **RESEND_API_KEY** et **NOTIFY_EMAIL** (votre adresse). Ne collez jamais la clé dans la conversation avec Claude Code. Puis envoyez, en remplaçant [action] par l'action de votre fiche projet (devis, rendez-vous, commande) :

```
Branche le formulaire de [action] : à l'envoi, envoie-moi un e-mail avec Resend, à l'adresse de la variable NOTIFY_EMAIL, avec la clé de la variable RESEND_API_KEY.

Champs : nom, entreprise, téléphone, e-mail, besoin, et une case non cochée « J'accepte d'être recontacté », obligatoire.

Vérifie chaque champ côté serveur. Ne mets aucune clé dans le code.
```

Après la fusion, relancez le déploiement (Redeploy) pour que Vercel lise les variables. Sans domaine vérifié chez Resend, l'e-mail ne part que vers l'adresse de votre compte Resend : c'est voulu pour aujourd'hui.

- [ ] Une demande envoyée arrive dans ma boîte
- [ ] Le formulaire refuse l'envoi sans la case cochée

### Étape 7 · Votre nom de domaine (10 min, puis attente)

Dans Vercel (Settings, Domains), ajoutez votre domaine. Recopiez exactement chez votre registraire les valeurs DNS affichées. La propagation peut prendre de quelques minutes à quelques heures.

- [ ] Le domaine est ajouté et les valeurs DNS sont saisies

### Étape 8 · Le test du client (5 min)

Un proche ouvre votre vitrine sur son téléphone et envoie une vraie demande.

- [ ] Elle arrive chez moi, avec le consentement coché par la personne

## Ça tourne ? La revue de 15 h 15

Chacun, en une minute : sa première priorité, sa vitrine sur téléphone, la phrase qui a le mieux marché avec Claude Code. Les meilleures phrases rejoignent la bibliothèque de prompts du groupe.

- [ ] Ma carte de processus et mes trois priorités sont écrites
- [ ] Mon offre est en ligne et lisible sur téléphone
- [ ] Une demande envoyée arrive dans ma boîte
- [ ] Le formulaire refuse l'envoi sans consentement
- [ ] Mon code est sur GitHub, dépôt privé, avec au moins 3 changements fusionnés
- [ ] Aucune clé ni mot de passe dans le code
- [ ] Mon domaine pointe vers le site, ou c'est lancé
- [ ] Réflexe du jour : mon CLAUDE.md est dans le dépôt et Claude le cite

## Dépannage

| Symptôme | Quoi faire |
| --- | --- |
| Vercel affiche « Build failed » | Copiez les lignes rouges du journal à Claude Code : « le déploiement échoue avec ceci, corrige » |
| La page en ligne n'a pas changé | Fusionnez sur GitHub, attendez une minute, rechargez en navigation privée |
| Aucun e-mail ne part | Vérifiez les deux variables dans Vercel, relancez le déploiement (Redeploy), regardez les indésirables |
| Le domaine reste invalide | Recopiez exactement les valeurs DNS affichées par Vercel, puis patientez |
| Claude Code invente des chiffres | « Retire tout chiffre et tout témoignage que je ne t'ai pas donnés » |
| La carte mélange tout | Un processus = un déclencheur et un résultat ; coupez en deux s'il y en a deux |
| Claude ne cite pas les règles du CLAUDE.md | Vérifiez le nom exact `CLAUDE.md`, sa place à la racine du dépôt et sa fusion, puis ouvrez une nouvelle séance |
| Une clé a été collée dans le code ou dans une conversation | Supprimez-la, révoquez-la chez le fournisseur (resend.com), créez-en une nouvelle et mettez-la seulement dans Vercel |

Bloqué plus de 10 minutes : levez la main.

## Lexique

| Mot | En une phrase |
| --- | --- |
| Processus | Une suite d'étapes, d'un déclencheur à un résultat |
| Déclencheur | L'événement qui lance le processus : un appel, une date, un paiement |
| Claude Code | L'agent qui écrit et modifie le code de votre application d'après vos phrases |
| CLAUDE.md | Le fichier des règles de votre projet, que Claude Code relit à chaque séance |
| Dépôt | Le dossier de votre application sur GitHub, avec son historique |
| Demande de fusion | Un changement proposé, relu puis intégré |
| Preview | Le lien qui montre un changement avant sa publication |
| Déploiement | La publication d'une version sur Vercel |
| DNS | L'annuaire qui relie votre nom de domaine à Vercel |
| Variable d'environnement | Un réglage secret, stocké dans Vercel, jamais dans le code |

## Quiz

1. Kofi passe 2 heures par jour sur les devis, et 1 heure par mois sur ses comptes. Lequel automatiser d'abord, et pourquoi ?
   - Les devis : fréquence et temps plus élevés, risque faible si Kofi relit.
2. L'encaissement a un score bas mais il est vital. Que faire ?
   - L'automatiser plus tard, avec une validation humaine : risque élevé.
3. Où mettre la clé Resend ?
   - Dans les variables d'environnement de Vercel, jamais dans le code ni dans un message.
4. Votre changement est fusionné mais la page n'a pas changé. Deux vérifications ?
   - Le déploiement Vercel est terminé ; la page est rechargée en navigation privée.
5. Pourquoi une seule correction par message ?
   - Pour vérifier chaque changement et savoir lequel a cassé quelque chose.
6. Comment savoir que Claude Code a bien la mémoire de votre projet ?
   - Dans une nouvelle séance, il cite les règles du CLAUDE.md quand on lui demande « Quelles sont les règles de ce projet ? ».

## Avant la J3 · 30 minutes

Préparez les données de votre activité.

- [ ] Listez ce que vous suivez aujourd'hui : clients, commandes, rendez-vous, paiements, et où (cahier, tableur, téléphone)
- [ ] Notez les trois chiffres que vous voudriez voir chaque lundi
- [ ] Faites lire votre vitrine à deux personnes de votre cible et notez leurs remarques
- [ ] Ajoutez à votre CLAUDE.md chaque règle décidée cette semaine
