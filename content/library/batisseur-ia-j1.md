---
title: Bâtisseur IA · J1 · Introduction aux composantes d'une IA
category: ia-formateur
audience: internal
updated: 2026-11-27
deck: Batisseur-IA-J1.pptx
summary: Le support du formateur pour la J1 : fiche de la journée, présentation des fiches projet, cours sur les composantes d'une IA, démonstration (Kofi Traiteur comme exemple, et la même étape selon quatre profils de projet), réflexe Claude Desktop au quotidien, labo pas à pas sur le projet de chacun, dépannage, lexique, quiz et préparation de la J2.
---

## Fiche de la journée

À la fin de la journée, chaque participant explique avec ses mots les composantes d'une IA et fait répondre un premier assistant à partir des documents de son propre projet, en citant la source. Chacun construit le projet qu'il a choisi (fiche 0), pas un modèle à recopier.

| | |
| --- | --- |
| Public | Dirigeants, indépendants, porteurs de projet, responsables d'association ou d'équipe. Aucune compétence en programmation. |
| Durée | 5 heures de travail : fiches projet et cours, démonstration, réflexe Claude Desktop, labo, revue |
| Prérequis | Un ordinateur, l'application Claude Desktop installée, un compte Claude (l'offre gratuite permet de commencer ; certaines fonctions comme les projets et les connecteurs peuvent demander une offre payante : vérifiez sur la page de tarifs officielle) ; sa **fiche projet** remplie (fiche 0, 30 minutes) ; 3 à 5 documents de son projet, rassemblés avant la journée et apportés le jour même : offres, tarifs, conditions, règlement, programme, questions fréquentes, en PDF texte ou Word, sans données personnelles. Un projet sans activité encore apporte les documents d'exemple du **kit de départ** (fiche 0), générés par Claude et marqués « Exemple ». |
| Résultat | Un projet Claude Desktop qui répond à partir des documents de votre projet (ou du kit de départ), une première skill à votre nom pour une tâche qui revient dans votre projet, un connecteur |
| Lien avec la suite | J2 à J6 assemblent ces composantes autour de votre projet : première page publique, données, agents, pilotage, et sa démonstration en J6 |

**Objectifs.** À la fin de la J1, vous savez :

1. expliquer modèle, token, contexte, prompt et hallucination, et pourquoi l'IA se trompe avec assurance ;
2. écrire un prompt en six éléments qui obtient une réponse utile du premier coup ;
3. dire ce qu'est le RAG et quand le préférer à l'entraînement d'un modèle ;
4. distinguer skill, outil, agent et MCP, et dire à quoi chacun servira dans votre projet ;
5. appliquer quatre règles de protection des données avant tout usage ;
6. utiliser Claude Desktop au quotidien (projets, connecteurs, skills, artefacts) et écrire une bonne demande avec les six rubriques de la fiche 2 ;
7. présenter votre projet en une minute et dire quels agents de la carte de référence il lui faut.

**Déroulé** (heures de Montréal ; Afrique de l'Ouest : + 5 h en hiver, + 4 h en été ; Afrique centrale : + 6 h en hiver, + 5 h en été)

| Heure | Bloc | Contenu |
| --- | --- | --- |
| 10 h 00 | Cours | Vos fiches projet (une minute chacun), puis les composantes d'une IA, avec démonstrations courtes |
| 11 h 15 | Démonstration | Un exemple : l'assistant de Kofi Traiteur (entreprise fictive), de zéro à utile, puis la même étape selon votre projet |
| 12 h 30 | Pause | 1 heure |
| 13 h 30 | Labo | Réflexe Claude Desktop (30 min), puis l'assistant de votre projet, sa skill, son connecteur (75 min) |
| 15 h 15 | Revue en groupe | Chacun pose une question piège à son assistant |

## Pour commencer : vos fiches projet

Le cours s'ouvre sur la présentation des fiches projet (fiche 0 des [fiches réflexes](/admin/bibliotheque/fiches-reflexes-batisseur-ia), lien participants `/ia/fiches`). Le temps est pris sur le cours, sans changer les horaires : la démonstration commence toujours à 11 h 15.

- **Une minute chacun** (30 secondes si le groupe est nombreux) : ce que je bâtis, pour qui, le problème réglé, ce que je montrerai en J6.
- **Le formateur note** chaque projet et son profil : service sur devis ou rendez-vous, boutique ou produits, association ou communauté, outil interne ou projet sans activité encore. Le groupe repère les projets voisins. Ces projets servent d'exemples toute la journée.
- **Un volontaire** pour la démonstration : un projet avec deux ou trois documents sans données personnelles (voir « Démonstration »).
- **Pas de fiche ?** La remplir pendant la pause de midi avec le modèle de la fiche 0 ; en attendant, dire en une phrase ce que l'on veut bâtir.
- **Pas encore d'activité ?** Les documents d'exemple du kit de départ (fiche 0) remplacent les documents réels jusqu'à ce qu'ils arrivent.

## Cours : les composantes d'une IA

Une IA générative, c'est un modèle qui produit du texte plausible à partir de ce qu'on lui donne à lire ; tout le reste (RAG, skills, outils, agents, MCP) sert à lui donner la bonne information et la bonne capacité d'agir, dans vos limites.

### 0. La destination : une carte de référence

Une entreprise est autonome quand son cycle complet tourne sans votre intervention quotidienne : attirer, vendre, encaisser, servir, mesurer. Vous n'intervenez que sur les exceptions et les décisions qui engagent l'entreprise. Il faut pour cela cinq agents au minimum, plus trois selon l'activité, tous tenus par des garde-fous.

Cette carte des huit agents est une **carte de référence**, pas un cahier des charges : personne ne les construit tous en six journées. Chacun y choisit ceux dont son projet a besoin, dans l'ordre qui lui sert. Une association choisira peut-être la communication et le support ; une boutique, la vente, l'encaissement et les opérations ; un outil interne, le support et l'analyste.

| Rôle d'entreprise | Agent | Ce qu'il fait seul | Ce qui reste à vous | Journée |
| --- | --- | --- | --- | --- |
| Marketing et acquisition | Communication | Publications, référencement, lettre aux inscrits ; il mesure ce qui attire | Ligne éditoriale, budget publicitaire | J5 |
| Commercial | Vente | Qualifie les demandes, prépare les devis, réservations ou inscriptions, propose les rendez-vous, relance | Remises, gros contrats | J4 |
| Finance opérationnelle | Encaissement | Liens de paiement, confirmations, reçus, factures, impayés | Remboursements, litiges | J4 |
| Service client | Support | Répond depuis vos documents, suit les demandes et les commandes | Réclamations sensibles, qu'il vous transmet | J5 |
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

**Les tokens** sont les morceaux de mots que le modèle lit et écrit. Ils mesurent deux choses qui vous concernent : la taille du contexte et le coût d'usage par API. À ne pas confondre avec le jeton d'accès (« access token ») que vous verrez en J2 : un badge temporaire, donc un secret.

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

Pour une petite entreprise, une association ou un outil interne, le RAG couvre presque tous les besoins : vos prix ou votre programme changent, vous remplacez le document.

### 5. Skills, outils, agents, MCP

- **La skill** : une compétence emballée, faite d'instructions, d'exemples et parfois de fichiers modèles. L'IA l'utilise quand la tâche s'y prête. Exemple : « rédiger un devis Kofi », toujours avec la même structure.
- **L'outil** : une action que l'IA peut demander (chercher sur le web, lire un agenda, créer un brouillon d'e-mail). Le logiciel l'exécute, pas le modèle.
- **L'agent** : un modèle qui enchaîne seul plusieurs étapes et outils vers un objectif, puis rend compte. Vous fixez le but et les limites.
- **MCP** (*Model Context Protocol*) : une prise standard pour brancher une IA sur vos outils (agenda, fichiers, base clients). Un connecteur MCP, et l'IA peut les lire ou agir dessus, avec les droits que vous accordez.
- **Mémoire** : ce que l'assistant retient d'une conversation à l'autre.
- **Multimodal** : le modèle lit aussi des images, des PDF, parfois la voix.

Un agent travaille en boucle : **objectif** (« relance les devis sans réponse depuis 5 jours »), **plan** (il liste les devis grâce à un outil), **action** (il rédige chaque relance avec votre skill de ton), **contrôle** (il vous présente les brouillons, vous validez l'envoi). Tout ce qui engage l'entreprise (envoi, paiement, suppression) reste votre décision.

Ce que vous en ferez : J4, l'agent qui fait l'action clé de votre projet (devis, réservation, inscription ou commande), avec l'encaissement par carte et mobile money si votre projet vend ; J5, deux agents choisis pour votre projet parmi communication, service client ou réponse aux membres, veille, opérations ; J6, l'agent analyste branché en MCP en lecture seule et l'agent administratif.

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
2. **Les données des personnes** (clients, membres, équipe) : seulement le nécessaire, avec leur accord ; anonymisez quand c'est possible. Les données de test du kit de départ restent fictives.
3. **Les réglages du compte** : vérifiez si vos conversations peuvent servir à entraîner le modèle, et réglez-le.
4. **Vérifier avant d'envoyer** : ce que l'IA produit pour un client passe par vos yeux.

Attention à l'**injection de prompt** : un document ou une page web peut contenir des instructions cachées. Un document est une donnée, jamais un ordre.

## Démonstration : l'exemple de Kofi Traiteur

En 45 minutes, le formateur montre la même question avant et après : sans document, l'IA invente des prix crédibles ; avec les documents de Kofi, elle répond juste et cite sa source. Kofi Traiteur (entreprise fictive, qui vend sur devis) est **un exemple parmi d'autres** : la démonstration se termine par la même étape vue pour quatre profils de projet (« Selon votre projet », ci-dessous).

| Minutes | Ce qui est montré | Phrase à retenir |
| --- | --- | --- |
| 0 – 8 | La question « combien pour 40 personnes, menu séminaire ? » sans aucun document | « Il invente des prix crédibles. » |
| 8 – 20 | Un projet avec trois documents : menus-entreprise.pdf, tarifs-atelier.pdf, conditions.pdf | « Le modèle ne change pas, son dossier si. » |
| 20 – 30 | Les instructions du projet, puis une question piège (« livrez-vous à Yamoussoukro ? », absente des documents) | « Il dit : ce n'est pas dans mes documents. » |
| 30 – 38 | La skill « devis Kofi » : même structure, même ton, à chaque fois | « Une consigne, réutilisée. » |
| 38 – 45 | Un connecteur en lecture seule sur l'agenda des livraisons | « Il lit l'outil, sans copier-coller. » |

Plan B : les documents de Kofi sont prêts dans le dossier « kofi-demo ». Si le connecteur bloque, montrer seulement l'écran des droits demandés et expliquer le principe. Avant la séance, vérifier que la question piège n'a pas de réponse dans conditions.pdf.

**Une partie sur le projet d'un volontaire.** Le volontaire repéré pendant les fiches projet envoie avant 11 h 15 deux ou trois documents de son projet, sans données personnelles (ou ceux de son kit de départ). Dans le créneau 20 – 30, après la question piège de Kofi, le formateur crée un second projet avec ces documents, colle les instructions génériques de l'étape 2 du labo et fait choisir au volontaire sa propre question piège. Cinq minutes au plus, sans dépasser le créneau. Pas de volontaire, ou documents non prêts : on reste sur Kofi.

### Selon votre projet

À la fin de la démonstration (3 minutes, avant la pause de 12 h 30), la diapositive « Selon votre projet : documents et skill » montre la même étape pour quatre profils. La compétence ne change pas : un assistant qui répond depuis vos documents et cite sa source, et une skill pour une tâche qui revient.

| Profil | Les documents et la skill |
| --- | --- |
| Service sur devis | Offres, tarifs, conditions. L'assistant répond aux demandes ; la skill rédige le devis. |
| Boutique, produits | Catalogue, prix, livraison, retours. L'assistant renseigne ; la skill écrit la fiche produit. |
| Association, communauté | Statuts, activités, adhésion. L'assistant répond aux membres ; la skill rédige l'annonce. |
| Outil interne, sans activité | Le kit de départ fournit des documents d'exemple. L'assistant répond ; la skill fait le compte rendu. |

Le formateur fait dire à deux participants de profils différents ce que donne l'étape pour leur projet. Un projet qui ne rentre dans aucune carte prend la plus proche.

## Bien travailler avec Claude : Claude Desktop au quotidien

Nouveauté du programme révisé du 24/11 : chaque journée ajoute un réflexe de travail avec Claude, qui sert ensuite tous les jours suivants. Celui de la J1 se fait au début du labo, en **30 minutes** (de 13 h 30 à 14 h 00, heure de Montréal ; pas sur la démonstration). Pour un non-développeur, Claude Desktop devient le poste de travail de tous les jours : c'est là qu'il range ses documents, ses consignes et ses demandes.

**Claude Desktop : quatre outils pour chaque jour**

- **Un projet par sujet** : vos documents et vos consignes au même endroit. Chaque conversation du projet les connaît.
- **Les connecteurs** : agenda, e-mail, Drive : Claude lit vos outils. Donnez-lui les droits minimum.
- **Les skills** : une manière de faire écrite une fois, réutilisée à chaque fois.
- **Les artefacts** : un document, une page ou un tableau produit par Claude, à relire avant usage.

**Une bonne demande, en six rubriques** (fiche 2 · le modèle de demande) :

```
Contexte : [qui je suis, mon projet, pour qui]
Ce que je veux : [le résultat, en une phrase]
C'est réussi quand : [ce que je dois voir]
Exemple : [capture, document, message joint]
Ne fais pas : [les limites]
Méthode : propose d'abord un plan court et attends mon accord.
```

Trois réflexes : une seule chose par demande ; dire précisément ce qui ne va pas ; une règle qui revient : dans une skill.

**Exercice** : chacun réécrit une demande récente avec les six rubriques, la soumet dans Claude Desktop et compare avec le résultat de la demande d'origine. Aucune donnée client réelle ni aucun secret dans la demande.

**Comment l'animer (30 min)**

| Temps | Ce que fait le formateur |
| --- | --- |
| 2 min | Intercalaire : le réflexe du jour et pourquoi il compte pour un non-développeur |
| 8 min | Les quatre outils, montrés à l'écran dans Claude Desktop : un projet avec ses documents et ses instructions, les connecteurs, les skills, un artefact de la démonstration. Les noms de menus peuvent évoluer : montrer l'écran du jour |
| 5 min | La fiche 2 : lire les six rubriques, faire le lien avec la grille du prompt du matin |
| 15 min | L'exercice (10 min), puis la lecture de deux ou trois demandes réécrites (5 min) ; renforcer « C'est réussi quand », souvent oublié |

À 14 h 00, on passe aux étapes du labo. Les étapes 1, 3 et 4 du labo mettent ensuite en pratique le projet, la skill et le connecteur ; chaque demande du labo suit les six rubriques. Ce réflexe est vérifié à la revue.

Fiche réflexe correspondante : [fiche 2, le modèle de demande](/admin/bibliotheque/fiches-reflexes-batisseur-ia) ; lien à donner aux participants : `/ia/fiches`. Les exemples des fiches suivent l'Atelier Adjoa, un atelier de couture fictif.

## Labo : l'assistant de votre projet

Vous construisez un assistant qui répond à partir des documents de votre projet, puis vous lui ajoutez une skill et un connecteur. La compétence est la même pour tous ; ce que vous construisez dépend de votre fiche projet. Chaque étape se termine par une vérification ; on ne passe pas à la suivante sans l'avoir cochée.

**Vos choix, selon votre projet.**

- **Les documents** : ceux de votre projet (offres, tarifs, conditions, catalogue, statuts, programme, procédures, questions fréquentes) ou, sans activité encore, ceux du kit de départ.
- **Le public de l'assistant** : des clients, des membres, des élèves ou votre équipe, comme dans votre fiche projet.
- **La skill** : la tâche qui revient le plus dans votre projet, par exemple un devis, une fiche produit, une annonce aux membres, un compte rendu.

**Pas encore d'activité ? Le kit de départ.** Si vous n'avez pas apporté de documents, collez votre fiche projet dans une conversation de Claude Desktop avec ce texte (fiche 0), relisez le résultat, puis déposez les documents obtenus à l'étape 1 :

```
Voici ma fiche projet : [coller la fiche].
Rédige trois documents d'exemple réalistes pour ce projet : une présentation de l'offre, les conditions (prix ou gratuité, délais, ce qui est inclus), et les dix questions qu'on me posera le plus, avec leurs réponses.
Puis propose un jeu de 20 lignes de données de test (personnes et demandes fictives, sans données réelles).
Marque chaque document « Exemple » en haut. N'invente aucun chiffre présenté comme réel.
```

Les noms de menus de l'interface peuvent évoluer : le formateur montre l'écran du jour.

**Le temps.** Le labo dure de 13 h 30 à 15 h 15 (1 h 45) : 30 minutes pour le réflexe Claude Desktop, puis 75 minutes pour les quatre étapes ci-dessous (de 14 h 00 à 15 h 15). Les documents ne se rassemblent pas pendant le labo : ils sont un prérequis, apportés le jour même (ceux du kit de départ sont acceptés ; qui n'a rien les génère en 5 minutes avec le texte ci-dessus). Priorité aux étapes 1 à 3, qui font le livrable du soir (le projet et une première skill) ; si l'heure tourne, le formateur montre l'étape 4 en démonstration rapide.

| Étape | Ce que vous faites | Temps |
| --- | --- | --- |
| 1 | Créer le projet, y déposer vos 3 à 5 documents (ou ceux du kit de départ) | 15 min |
| 2 | Écrire les instructions avec la grille en six éléments, tester un piège | 20 min |
| 3 | Créer une skill pour une tâche qui revient dans votre projet | 25 min |
| 4 | Brancher un connecteur sur un outil que vous utilisez | 15 min |

Les dix questions de votre public, dont trois pièges, se font avant la J2 (voir « Avant la J2 ») ; le test sans document et la fiche lexique sont dans « Pour aller plus loin ».

### Étape 1 · Créer le projet (15 min)

Dans Claude Desktop, créez un projet nommé « Assistant [mon projet] » et déposez dans ses connaissances les 3 à 5 documents que vous avez apportés : offres, tarifs, conditions, catalogue, statuts, programme, questions fréquentes, procédure interne ; ou les documents « Exemple » du kit de départ. C'est votre base pour le RAG. Pas de document contenant des données personnelles (clients, membres, équipe).

- [ ] Mes documents sont en PDF texte, Word ou texte simple (pas des photos scannées)
- [ ] Mes documents apparaissent dans le projet

### Étape 2 · Écrire les instructions et tester un piège (20 min)

Collez ce texte dans les instructions du projet, puis complétez les crochets à partir de votre fiche projet :

```
Tu es l'assistant de [mon projet], qui [ce qu'il apporte] à [pour qui].

Tu réponds aux questions de [pour qui] en t'appuyant uniquement sur les documents du projet. Cite le document utilisé à la fin de chaque réponse.

Si la réponse n'est pas dans les documents, dis-le simplement et propose de me transmettre la question. N'invente jamais un prix, un délai ou une promesse.

Réponses courtes, en français, ton [chaleureux ou sobre].
```

« Pour qui » : vos clients, vos membres, vos élèves ou votre équipe. Posez ensuite une question à laquelle vos documents répondent, puis une question piège dont la réponse n'y est pas : une zone de livraison, un délai, une remise que vous n'avez jamais écrits ; pour une association, une date ou une cotisation non écrites ; pour un outil interne, une procédure absente.

- [ ] Les six éléments y sont : rôle, situation, tâche, source, limites, format
- [ ] Il cite le bon document, refuse la question piège, ne promet rien d'absent, et le ton me ressemble

### Étape 3 · Votre première skill (25 min)

Choisissez une tâche qui revient chaque semaine dans votre projet : un devis (service), une fiche produit (boutique), une annonce aux membres (association), un compte rendu ou une réponse type (outil interne). Demandez à l'IA de vous aider à l'écrire, en suivant les six rubriques de la fiche 2 :

```
Aide-moi à créer une skill nommée « [nom] ».

Elle sert à [tâche], quand [situation].

Voici un exemple réussi : [collez un exemple].

Règles : [ton, longueur, mentions obligatoires, ce qu'il ne faut jamais écrire].
```

Enregistrez-la dans les réglages de votre compte (section des skills), puis testez-la dans une nouvelle conversation.

- [ ] La skill se déclenche seule quand je décris la tâche
- [ ] Deux essais donnent la même structure

### Étape 4 · Un connecteur (15 min)

Dans les réglages, section des connecteurs, branchez un outil que vous utilisez déjà : agenda, stockage de fichiers ou messagerie. Lisez les droits demandés avant d'accepter. Ne collez jamais de mot de passe ni de clé dans une conversation.

**En coulisses.** L'écran « Autoriser l'accès » que vous voyez, c'est OAuth : une procuration limitée et révocable, sans votre mot de passe. Accordez le minimum (la lecture si elle suffit) et repérez où retirer l'accès. Le mot est expliqué en J2 (fiche 8).

```
Quels sont mes rendez-vous de la semaine prochaine, et lesquels concernent [mon projet] ?
```

- [ ] Le connecteur est branché avec les droits minimum (lecture seule si possible)
- [ ] L'assistant a lu l'outil sans copier-coller

## Ça tourne ? La revue de 15 h 15

Chacun montre en une minute la question piège que son assistant a bien refusée. Les points sont les mêmes pour tous les projets : on vérifie que ça marche sur le projet de chacun et que c'est testé, pas la ressemblance avec Kofi.

- [ ] Je sais expliquer modèle, contexte et token avec mes mots
- [ ] Mon assistant répond depuis les documents de mon projet et cite sa source
- [ ] Il refuse les questions hors de mes documents
- [ ] J'ai une skill qui fait une tâche répétitive
- [ ] Un connecteur est branché, avec les droits minimum
- [ ] Aucun secret ni donnée personnelle sensible dans le projet
- [ ] Réflexe du jour : chaque demande suit les six rubriques de la fiche 2

Pour un projet sur le kit de départ, une source citée marquée « Exemple » est valable. Les meilleures instructions rejoignent la bibliothèque de prompts du groupe. Si le connecteur n'a été vu qu'en démonstration, la case reste ouverte, sans travail supplémentaire.

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

1. Kofi change ses prix demain, ou votre association change son programme. Faut-il réentraîner le modèle ?
   - Non : on remplace le document dans le projet. C'est l'intérêt du RAG.
2. L'assistant donne un délai de livraison absent des documents. Quel mot décrit ce phénomène, et quelle règle ajouter ?
   - Une hallucination. Règle : « Si ce n'est pas dans les documents, dis-le. »
3. Quelle différence entre une skill et un outil ?
   - La skill dit comment faire une tâche ; l'outil permet une action, exécutée par le logiciel.
4. Un connecteur demande le droit d'envoyer des e-mails en votre nom pour lire votre agenda. Que faites-vous ?
   - Vous refusez : on accorde les droits minimum nécessaires.
5. Pourquoi un agent vous présente-t-il ses brouillons avant l'envoi ?
   - Parce que tout ce qui engage votre projet ou votre entreprise reste votre décision.
6. Qu'est-ce qui fait grossir la facture d'une application qui utilise l'API ?
   - Le nombre de tokens : un contexte long, des réponses longues, un grand modèle là où un petit suffit.
7. Quelles sont les six rubriques d'une bonne demande (fiche 2) ?
   - Contexte, ce que je veux, c'est réussi quand, exemple, ne fais pas, méthode (un plan court d'abord, puis mon accord).

## Avant la J2 · 45 minutes

- [ ] Listez les tâches de votre projet et le temps que chacune prend ; si le projet n'existe pas encore, celles qu'il demandera (10 min)
- [ ] Entourez les trois qui reviennent le plus et vous plaisent le moins (5 min)
- [ ] Créez vos comptes GitHub et Vercel (gratuits) : on les utilise dès la J2 (10 min)
- [ ] Testez votre assistant : 10 questions de votre public, dont 3 pièges (20 min)

Gardez votre fiche projet à portée : elle devient la première section de votre CLAUDE.md en J2, et vos tâches entourées font la carte de votre projet.

**Les dix questions, dont trois pièges.** Écrivez sept questions que votre public (clients, membres, élèves ou équipe) pose vraiment, ou posera, et trois dont la réponse n'est pas dans vos documents. Posez-les une par une dans le projet « Assistant [mon projet] ». Si une réponse invente, corrigez les instructions (voir « Dépannage ») et reposez la question. La J2 commence par la question piège que votre assistant a bien refusée.

- [ ] Les sept réponses citent le bon document
- [ ] Les trois pièges sont refusés sans invention

Les fiches réflexes sont sur `/ia/fiches`.

## Pour aller plus loin

Sans durée, pour ceux qui veulent approfondir ; rien dans la suite n'en dépend.

**Le test sans document.** Ouvrez une conversation vide, hors de tout projet, et posez une question précise sur votre projet. Comparez avec la réponse de votre assistant.

```
Quelles sont les conditions de [mon projet] pour [mon offre ou mon activité principale] ?
```

- [ ] J'ai noté ce que l'IA a inventé ou laissé dans le vague, et la question a maintenant une réponse juste dans le projet

**Votre fiche lexique.** Pour chaque mot du lexique ci-dessus, écrivez un exemple tiré de votre projet (« le contexte, chez moi, ce sont… »).

- [ ] J'ai un exemple à moi pour les douze mots

**La fiche 1, le CLAUDE.md type.** Lisez-la : on l'écrit ensemble en J2.
