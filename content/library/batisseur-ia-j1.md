---
title: Bâtisseur IA · J1 · Introduction aux composantes d'une IA
category: ia-formateur
audience: internal
updated: 2026-11-24
deck: Batisseur-IA-J1.pptx
summary: Le support du formateur pour la J1 : fiche de la journée, cours sur les composantes d'une IA, démonstration Kofi Traiteur, réflexe Claude Desktop au quotidien, labo pas à pas, dépannage, lexique, quiz et préparation de la J2.
---

## Fiche de la journée

À la fin de la journée, chaque participant explique avec ses mots les composantes d'une IA et fait répondre un premier assistant à partir de ses propres documents, en citant la source.

| | |
| --- | --- |
| Public | Dirigeants, indépendants, porteurs de projet. Aucune compétence en programmation. |
| Durée | 5 heures de travail : cours, démonstration, réflexe Claude Desktop, labo, revue |
| Prérequis | Un ordinateur, l'application Claude Desktop installée, un compte Claude (l'offre gratuite permet de commencer ; certaines fonctions comme les projets et les connecteurs peuvent demander une offre payante : vérifiez sur la page de tarifs officielle), 3 à 5 documents de votre activité |
| Résultat | Un projet Claude Desktop qui répond à partir de vos documents, une première skill à votre nom, un connecteur, votre fiche lexique |
| Lien avec la suite | J2 à J6 assemblent ces composantes : site, données, agents, pilotage |

**Objectifs.** À la fin de la J1, vous savez :

1. expliquer modèle, token, contexte, prompt et hallucination, et pourquoi l'IA se trompe avec assurance ;
2. écrire un prompt en six éléments qui obtient une réponse utile du premier coup ;
3. dire ce qu'est le RAG et quand le préférer à l'entraînement d'un modèle ;
4. distinguer skill, outil, agent et MCP, et dire à quoi chacun servira dans votre entreprise ;
5. appliquer quatre règles de protection des données avant tout usage ;
6. utiliser Claude Desktop au quotidien (projets, connecteurs, skills, artefacts) et écrire une bonne demande avec les six rubriques de la fiche 2.

**Déroulé** (heures de Montréal ; Afrique de l'Ouest : + 5 h en hiver, + 4 h en été ; Afrique centrale : + 6 h en hiver, + 5 h en été)

| Heure | Bloc | Contenu |
| --- | --- | --- |
| 10 h 00 | Cours | Les composantes d'une IA, avec démonstrations courtes |
| 11 h 15 | Démonstration | L'assistant de Kofi Traiteur (entreprise fictive), de zéro à utile |
| 12 h 30 | Pause | 1 heure |
| 13 h 30 | Labo | Réflexe Claude Desktop, puis votre assistant, votre skill, votre connecteur |
| 15 h 15 | Revue en groupe | Chacun pose une question piège à son assistant |

## Cours : les composantes d'une IA

Une IA générative, c'est un modèle qui produit du texte plausible à partir de ce qu'on lui donne à lire ; tout le reste (RAG, skills, outils, agents, MCP) sert à lui donner la bonne information et la bonne capacité d'agir, dans vos limites.

### 0. La destination : votre entreprise autonome

Une entreprise est autonome quand son cycle complet tourne sans votre intervention quotidienne : attirer, vendre, encaisser, servir, mesurer. Vous n'intervenez que sur les exceptions et les décisions qui engagent l'entreprise. Il faut pour cela cinq agents au minimum, plus trois selon l'activité, tous tenus par des garde-fous.

| Rôle d'entreprise | Agent | Ce qu'il fait seul | Ce qui reste à vous | Journée |
| --- | --- | --- | --- | --- |
| Marketing et acquisition | Communication | Publications, référencement, lettre aux inscrits ; il mesure ce qui attire | Ligne éditoriale, budget publicitaire | J5 |
| Commercial | Vente | Qualifie les demandes, prépare les devis, propose les rendez-vous, relance | Remises, gros contrats | J4 |
| Finance opérationnelle | Encaissement | Liens de paiement, confirmations, reçus, factures, impayés | Remboursements, litiges | J4 |
| Service client | Support | Répond depuis vos documents, suit les commandes | Réclamations sensibles, qu'il vous transmet | J5 |
| Direction et pilotage | Analyste | Lit les chiffres, compare aux objectifs, signale les écarts, propose | La décision | J6 |
| Stratégie | Veille | Suit concurrents, prix, réglementation | Ce que vous en faites | J5 |
| Opérations (selon l'activité) | Opérations | Planning, stock, livraisons, fournisseurs | Choix des fournisseurs, priorités | J5 |
| Administration | Administratif | Range les pièces comptables, rappelle les échéances, suit les demandes sur les données personnelles | Déclarations signées, avec votre comptable | J6 |

Les cinq premières lignes forment le socle : avec elles, l'argent rentre et circule sans vous au quotidien, et vous savez où vous en êtes. Les **garde-fous** (règles écrites, journal, interrupteurs, validation humaine) ne sont pas un agent, mais sans eux rien n'est autonome : on les pose dès la J4 et on les révise en J6.

Votre rôle devient celui de **dirigeant d'agents** : la stratégie, l'offre et les prix, les relations clés, les décisions qui engagent, et chaque semaine l'ajustement des règles à partir du rapport de l'analyste.

Un agent attire le client (contenu, référencement, réponse immédiate) ; il n'envoie pas de messages non sollicités en masse. Une prospection ciblée se prépare avec l'IA et s'envoie par un humain.

### 1. Le modèle, et ce qu'il lit

**Le modèle** est le moteur. Il a lu une immense quantité de textes et a appris à prédire la suite la plus probable d'un texte. Il ne consulte pas une base de faits : il produit une réponse plausible. Image à retenir : un rédacteur très cultivé qui arrive le premier jour dans votre entreprise. Il écrit très bien, mais ne connaît ni vos prix ni vos clients.

**Le prompt** est votre demande. **Le contexte** est tout ce que le modèle voit au moment de répondre : le prompt, la conversation précédente, les documents joints, les instructions du projet. C'est le dossier posé sur le bureau du rédacteur. Sa taille est limitée : au-delà, les éléments les plus anciens sortent ou sont résumés.

**Les tokens** sont les morceaux de mots que le modèle lit et écrit. Ils mesurent deux choses qui vous concernent : la taille du contexte et le coût d'usage par API.

### 2. Pourquoi l'IA se trompe avec assurance

- **L'hallucination** : quand l'information manque, le modèle complète avec du plausible. Un prix, une date, une référence peuvent être inventés, sur un ton tout aussi sûr.
- **La date de connaissance** : le modèle a appris jusqu'à une certaine date et ignore ce qui a changé depuis, dont vos chiffres d'aujourd'hui.
- **La variabilité** : la même question peut donner deux réponses différentes. On la réduit avec des règles et des exemples.

Le remède tient en trois gestes : donner la source, exiger qu'elle soit citée, autoriser la réponse « je ne sais pas ».

### 3. Un bon prompt en six éléments

| Élément | Exemple Kofi Traiteur |
| --- | --- |
| Rôle | Tu es l'assistant commercial de Kofi Traiteur, traiteur pour entreprises à Abidjan. |
| Situation | Une assistante RH demande un déjeuner pour 25 personnes vendredi. |
| Tâche | Rédige ma réponse. |
| Source | Utilise uniquement les menus et les prix du document joint. |
| Limites | Si une information manque, dis-le au lieu de l'inventer. |
| Format et ton | Réponse courte, chaleureuse, qui se termine par une question pour fixer le menu. |

Kofi Traiteur est une entreprise fictive qui sert d'exemple pendant les six journées.

### 4. Le RAG : donner vos connaissances à l'IA

**RAG** signifie *Retrieval-Augmented Generation* : génération appuyée sur une recherche. À chaque question, on cherche d'abord dans vos documents les passages utiles, on les ajoute au contexte avec leur source, puis le modèle répond à partir d'eux. Le modèle ne change pas : c'est son dossier qui change.

Le RAG en quatre étapes :

1. **La question** : « Combien coûte le menu séminaire pour 40 personnes ? »
2. **La recherche** : on retrouve dans vos documents les passages qui parlent du menu séminaire.
3. **Le contexte** : ces passages sont ajoutés au prompt, avec leur source.
4. **La réponse** : le modèle répond à partir de ces passages et cite le document.

Mots associés :

- **Base de connaissances** : l'ensemble de vos documents mis à disposition de l'assistant.
- **Découpage (chunks)** : les documents sont coupés en passages pour ne donner au modèle que ce qui sert.
- **Embeddings** : une représentation du sens d'un passage. Elle permet de retrouver « menu séminaire » même si la question dit « formule pour une journée d'équipe ».

| Méthode | Ce que c'est | Quand l'utiliser |
| --- | --- | --- |
| Le prompt | Vous écrivez l'information dans la demande | Une information ponctuelle |
| Le RAG | L'IA cherche dans vos documents à chaque question | Vos tarifs, offres, procédures : ce qui change |
| L'entraînement (fine-tuning) | On modifie le modèle avec des exemples | Rarement pour une PME : coûteux, à refaire à chaque changement |

Pour une petite entreprise, le RAG couvre presque tous les besoins : vos prix changent, vous remplacez le document.

### 5. Skills, outils, agents, MCP

- **La skill** : une compétence emballée, faite d'instructions, d'exemples et parfois de fichiers modèles. L'IA l'utilise quand la tâche s'y prête. Exemple : « rédiger un devis Kofi », toujours avec la même structure.
- **L'outil** : une action que l'IA peut demander (chercher sur le web, lire un agenda, créer un brouillon d'e-mail). Le logiciel l'exécute, pas le modèle.
- **L'agent** : un modèle qui enchaîne seul plusieurs étapes et outils vers un objectif, puis rend compte. Vous fixez le but et les limites.
- **MCP** (*Model Context Protocol*) : une prise standard pour brancher une IA sur vos outils (agenda, fichiers, base clients). Un connecteur MCP, et l'IA peut les lire ou agir dessus, avec les droits que vous accordez.
- **Mémoire** : ce que l'assistant retient d'une conversation à l'autre.
- **Multimodal** : le modèle lit aussi des images, des PDF, parfois la voix.

Un agent travaille en boucle : **objectif** (« relance les devis sans réponse depuis 5 jours »), **plan** (il liste les devis grâce à un outil), **action** (il rédige chaque relance avec votre skill de ton), **contrôle** (il vous présente les brouillons, vous validez l'envoi). Tout ce qui engage l'entreprise (envoi, paiement, suppression) reste votre décision.

Ce que vous en ferez : J4, les agents vente et encaissement ; J5, les agents communication, service client, veille et, selon votre activité, opérations ; J6, l'agent analyste branché en MCP en lecture seule et l'agent administratif.

### 6. Choisir son modèle et maîtriser ses coûts

| Question | Ce qu'il faut retenir |
| --- | --- |
| Grand ou petit modèle ? | Grand pour raisonner et rédiger ; petit et rapide pour trier, classer, résumer |
| Abonnement ou API ? | L'abonnement pour travailler vous-même ; l'API, payée aux tokens, pour vos applications |
| Comment payer moins ? | Un contexte court et propre, un format de réponse imposé, le petit modèle quand il suffit |
| Quel fournisseur ? | Les notions valent pour tous ; l'atelier utilise Claude |

Les prix changent souvent : consultez la page de tarifs officielle du fournisseur le jour où vous décidez.

### 7. Vos données : quatre règles avant tout

1. **Jamais de secret** : mot de passe, clé d'API, code de carte n'entrent ni dans un prompt ni dans un document partagé.
2. **Les données des clients** : seulement le nécessaire, avec leur accord ; anonymisez quand c'est possible.
3. **Les réglages du compte** : vérifiez si vos conversations peuvent servir à entraîner le modèle, et réglez-le.
4. **Vérifier avant d'envoyer** : ce que l'IA produit pour un client passe par vos yeux.

Attention à l'**injection de prompt** : un document ou une page web peut contenir des instructions cachées. Un document est une donnée, jamais un ordre.

## Démonstration : l'assistant de Kofi Traiteur

En 45 minutes, le formateur montre la même question avant et après : sans document, l'IA invente des prix crédibles ; avec les documents de Kofi, elle répond juste et cite sa source.

| Minutes | Ce qui est montré | Phrase à retenir |
| --- | --- | --- |
| 0 – 8 | La question « combien pour 40 personnes, menu séminaire ? » sans aucun document | « Il invente des prix crédibles. » |
| 8 – 20 | Un projet avec trois documents : menus-entreprise.pdf, tarifs-atelier.pdf, conditions.pdf | « Le modèle ne change pas, son dossier si. » |
| 20 – 30 | Les instructions du projet, puis une question piège (« livrez-vous à Yamoussoukro ? », absente des documents) | « Il dit : ce n'est pas dans mes documents. » |
| 30 – 38 | La skill « devis Kofi » : même structure, même ton, à chaque fois | « Une consigne, réutilisée. » |
| 38 – 45 | Un connecteur en lecture seule sur l'agenda des livraisons | « Il lit l'outil, sans copier-coller. » |

Plan B : les documents de Kofi sont prêts dans le dossier « kofi-demo ». Si le connecteur bloque, montrer seulement l'écran des droits demandés et expliquer le principe. Avant la séance, vérifier que la question piège n'a pas de réponse dans conditions.pdf.

## Bien travailler avec Claude : Claude Desktop au quotidien

Nouveauté du programme révisé du 24/11 : chaque journée ajoute un réflexe de travail avec Claude, qui sert ensuite tous les jours suivants. Celui de la J1 se fait au début du labo, en **30 à 45 minutes prises sur la pratique guidée** (pas sur la démonstration). Pour un non-développeur, Claude Desktop devient le poste de travail de tous les jours : c'est là qu'il range ses documents, ses consignes et ses demandes.

**Claude Desktop : quatre outils pour chaque jour**

- **Un projet par sujet** : vos documents et vos consignes au même endroit. Chaque conversation du projet les connaît.
- **Les connecteurs** : agenda, e-mail, Drive : Claude lit vos outils. Donnez-lui les droits minimum.
- **Les skills** : une manière de faire écrite une fois, réutilisée à chaque fois.
- **Les artefacts** : un document, une page ou un tableau produit par Claude, à relire avant usage.

**Une bonne demande, en six rubriques** (fiche 2 · le modèle de demande) :

```
Contexte : [qui je suis, mon activité, mes clients]
Ce que je veux : [le résultat, en une phrase]
C'est réussi quand : [ce que je dois voir]
Exemple : [capture, document, message joint]
Ne fais pas : [les limites]
Méthode : propose d'abord un plan court et attends mon accord.
```

Trois réflexes : une seule chose par demande ; dire précisément ce qui ne va pas ; une règle qui revient : dans une skill.

**Exercice** : chacun réécrit une demande récente avec les six rubriques, la soumet dans Claude Desktop et compare avec le résultat de la demande d'origine. Aucune donnée client réelle ni aucun secret dans la demande.

**Comment l'animer (30 à 45 min)**

| Temps | Ce que fait le formateur |
| --- | --- |
| 2 min | Intercalaire : le réflexe du jour et pourquoi il compte pour un non-développeur |
| 8 à 10 min | Les quatre outils, montrés à l'écran dans Claude Desktop : un projet avec ses documents et ses instructions, les connecteurs, les skills, un artefact de la démonstration. Les noms de menus peuvent évoluer : montrer l'écran du jour |
| 5 à 10 min | La fiche 2 : lire les six rubriques, faire le lien avec la grille du prompt du matin |
| 10 à 15 min | L'exercice, puis la lecture de deux ou trois demandes réécrites ; renforcer « C'est réussi quand », souvent oublié |

Les étapes 3, 6 et 7 du labo mettent ensuite en pratique le projet, la skill et le connecteur ; chaque demande du labo suit les six rubriques. Ce réflexe est vérifié à la revue.

Fiche réflexe correspondante : [fiche 2, le modèle de demande](/admin/bibliotheque/fiches-reflexes-batisseur-ia) ; lien à donner aux participants : `/ia/fiches`. Les exemples des fiches suivent l'Atelier Adjoa, un atelier de couture fictif.

## Labo : votre premier assistant

Vous construisez un assistant qui répond à partir de vos documents, puis vous lui ajoutez une skill et un connecteur. Chaque étape se termine par une vérification ; on ne passe pas à la suivante sans l'avoir cochée.

Les noms de menus de l'interface peuvent évoluer : le formateur montre l'écran du jour.

**Le temps.** Le labo dure de 13 h 30 à 15 h 15 (1 h 45), dont 30 à 45 minutes pour le réflexe Claude Desktop. Les durées indiquées ci-dessous (2 h 10 au total) sont celles d'un travail complet : en séance, l'étape 1 se réduit à 5 minutes (documents préparés avant la journée), l'étape 2 à 5 minutes, les étapes 3 à 6 sont faites par tous (le livrable du soir est le projet et une première skill), l'étape 7 par ceux qui avancent (sinon montrée en démonstration rapide), et l'étape 8 se termine avant la J2.

### Étape 1 · Rassembler vos documents (15 min)

Choisissez 3 à 5 documents : offres, tarifs, conditions de vente, questions fréquentes, procédure interne. Pas de document contenant des données personnelles de clients.

- [ ] Mes documents sont en PDF texte, Word ou texte simple (pas des photos scannées)

### Étape 2 · Le test sans document (10 min)

Ouvrez une conversation vide et posez une question précise sur votre activité, par exemple :

```
Quels sont les tarifs de [mon entreprise] pour [mon offre principale] ?
```

- [ ] J'ai noté ce que l'IA a inventé ou laissé dans le vague

### Étape 3 · Créer le projet (15 min)

Dans Claude Desktop, créez un projet nommé « Assistant [mon entreprise] » et déposez vos documents dans ses connaissances. C'est votre base pour le RAG.

- [ ] Mes documents apparaissent dans le projet

### Étape 4 · Écrire les instructions (20 min)

Collez ce texte dans les instructions du projet, puis complétez les crochets :

```
Tu es l'assistant de [mon entreprise], qui [ce que je vends] à [mes clients].

Tu réponds aux questions des clients en t'appuyant uniquement sur les documents du projet. Cite le document utilisé à la fin de chaque réponse.

Si la réponse n'est pas dans les documents, dis-le simplement et propose de me transmettre la question. N'invente jamais un prix, un délai ou une promesse.

Réponses courtes, en français, ton [chaleureux / sobre].
```

- [ ] Les six éléments y sont : rôle, situation, tâche, source, limites, format
- [ ] Il cite le bon document, refuse les pièges, ne promet rien d'absent, et le ton me ressemble

### Étape 5 · Dix questions, dont trois pièges (20 min)

Écrivez sept questions que vos clients posent vraiment, et trois dont la réponse n'est pas dans vos documents. Posez-les une par une dans le projet.

- [ ] Les sept réponses citent le bon document
- [ ] Les trois pièges sont refusés sans invention
- [ ] La question de l'étape 2 a maintenant une réponse juste

### Étape 6 · Votre première skill (25 min)

Choisissez une tâche qui revient chaque semaine : un devis, une réponse type, un compte rendu. Demandez à l'IA de vous aider à l'écrire, en suivant les six rubriques de la fiche 2 :

```
Aide-moi à créer une skill nommée « [nom] ».

Elle sert à [tâche], quand [situation].

Voici un exemple réussi : [collez un exemple].

Règles : [ton, longueur, mentions obligatoires, ce qu'il ne faut jamais écrire].
```

Enregistrez-la dans les réglages de votre compte (section des skills), puis testez-la dans une nouvelle conversation.

- [ ] La skill se déclenche seule quand je décris la tâche
- [ ] Deux essais donnent la même structure

### Étape 7 · Un connecteur (15 min)

Dans les réglages, section des connecteurs, branchez un outil que vous utilisez déjà : agenda, stockage de fichiers ou messagerie. Lisez les droits demandés avant d'accepter. Ne collez jamais de mot de passe ni de clé dans une conversation.

```
Quels sont mes rendez-vous de la semaine prochaine, et lequel concerne un client ?
```

- [ ] Le connecteur est branché avec les droits minimum (lecture seule si possible)
- [ ] L'assistant a lu l'outil sans copier-coller

### Étape 8 · Votre fiche lexique (10 min)

Pour chaque mot du lexique ci-dessous, écrivez un exemple tiré de votre activité (« le contexte, chez moi, ce sont… »).

- [ ] J'ai un exemple à moi pour les douze mots

## Ça tourne ? La revue de 15 h 15

Chacun montre en une minute la question piège que son assistant a bien refusée.

- [ ] Je sais expliquer modèle, contexte et token avec mes mots
- [ ] Mon assistant répond à partir de mes documents et cite sa source
- [ ] Il refuse les questions hors de mes documents
- [ ] J'ai une skill qui fait une tâche répétitive
- [ ] Un connecteur est branché, avec les droits minimum
- [ ] Aucun secret ni donnée client sensible dans le projet
- [ ] Réflexe du jour : chaque demande suit les six rubriques de la fiche 2

Les meilleures instructions rejoignent la bibliothèque de prompts du groupe.

## Dépannage

| Symptôme | Quoi faire |
| --- | --- |
| Il invente encore | Ajoutez : « Si ce n'est pas dans les documents, réponds : je ne sais pas » |
| Il ne trouve pas une information présente | Le document est peut-être une image : utilisez un PDF texte ou un fichier Word |
| Il mélange deux offres | Séparez-les en deux documents aux titres clairs |
| Réponses trop longues | Précisez le format : « 3 phrases maximum » |
| La skill ne se déclenche pas | Rendez sa description plus précise : quand l'utiliser, pour quoi faire |
| Le connecteur demande des droits larges | Refusez ; choisissez la lecture seule ou un autre outil |

Bloqué plus de 10 minutes : levez la main.

## Lexique : douze mots

| Mot | En une phrase |
| --- | --- |
| Modèle | Le moteur qui produit le texte le plus plausible à partir de ce qu'il lit |
| Token | Un morceau de mot ; l'unité de taille du contexte et de coût |
| Contexte | Tout ce que le modèle voit au moment de répondre |
| Prompt | Votre demande : rôle, situation, tâche, source, limites, format |
| Hallucination | Une information inventée mais plausible, dite avec assurance |
| RAG | Chercher d'abord dans vos documents, répondre ensuite en citant la source |
| Embedding | La représentation du sens d'un passage, qui permet de le retrouver |
| Skill | Une compétence emballée : instructions et exemples réutilisables |
| Outil | Une action que l'IA demande et que le logiciel exécute |
| Agent | Un modèle qui enchaîne étapes et outils vers un objectif, dans vos limites |
| MCP | Une prise standard qui branche l'IA sur vos outils |
| Injection de prompt | Des instructions cachées dans un document ou une page, à traiter comme des données |

## Quiz

1. Kofi change ses prix demain. Faut-il réentraîner le modèle ?
   - Non : il remplace le document dans le projet. C'est l'intérêt du RAG.
2. L'assistant donne un délai de livraison absent des documents. Quel mot décrit ce phénomène, et quelle règle ajouter ?
   - Une hallucination. Règle : « Si ce n'est pas dans les documents, dis-le. »
3. Quelle différence entre une skill et un outil ?
   - La skill dit comment faire une tâche ; l'outil permet une action, exécutée par le logiciel.
4. Un connecteur demande le droit d'envoyer des e-mails en votre nom pour lire votre agenda. Que faites-vous ?
   - Vous refusez : on accorde les droits minimum nécessaires.
5. Pourquoi un agent vous présente-t-il ses brouillons avant l'envoi ?
   - Parce que tout ce qui engage l'entreprise reste votre décision.
6. Qu'est-ce qui fait grossir la facture d'une application qui utilise l'API ?
   - Le nombre de tokens : un contexte long, des réponses longues, un grand modèle là où un petit suffit.
7. Quelles sont les six rubriques d'une bonne demande (fiche 2) ?
   - Contexte, ce que je veux, c'est réussi quand, exemple, ne fais pas, méthode (un plan court d'abord, puis mon accord).

## Avant la J2 · 30 minutes

- [ ] Listez vos tâches de la semaine et le temps que chacune vous prend
- [ ] Entourez les trois qui reviennent le plus et vous plaisent le moins
- [ ] Créez vos comptes GitHub et Vercel (gratuits) : on les utilise dès la J2
- [ ] Lisez la fiche 1, le CLAUDE.md type : on l'écrit ensemble en J2 (fiches réflexes : `/ia/fiches`)
