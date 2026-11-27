---
title: Programme révisé — formation Bâtisseur IA
category: ia-formateur
audience: internal
updated: 2026-11-27
summary: Les six journées en détail : chaque participant bâtit son propre projet, avec le fil rouge « bien travailler avec Claude » et le livrable de chaque soir.
---

## En bref

Les six journées, leurs titres et le projet construit restent les mêmes ; chaque journée gagne un **fil rouge « bien travailler avec Claude »** de 30 à 45 minutes, pris sur la pratique guidée, pas sur la démonstration.

- **Ce qui reste :** 6 journées de 5 h le week-end, le format « on vous montre, vous construisez, on vérifie », l’encaissement par carte et mobile money en J4, le pilotage autonome en J6.
- **Ce qui s’ajoute :** Claude Desktop au quotidien, la mémoire du projet (CLAUDE.md), le plan avant d’agir, les secrets et permissions, le retour arrière, la manière de décrire une demande, le fonctionnement et le test d’un agent, le diagnostic d’une erreur, les coûts.
- **La promesse qui en découle :** à la fin, le participant sait faire évoluer et réparer son système seul, pas seulement l’avoir construit avec nous.

## Le projet du participant au centre (27/11)

Le participant ne reproduit pas un modèle : il vient avec un projet qu’il a choisi et repart avec une réalisation qui a du sens, même si elle n’est pas mûre à 100 %. C’est en le construisant qu’il apprend. Les compétences de chaque journée restent les mêmes ; ce qu’il en fait dépend de son projet.

- **Avant la J1 :** le participant remplit sa **fiche projet** (fiche 0 des [fiches réflexes](/admin/bibliotheque/fiches-reflexes-batisseur-ia), 30 minutes) : ce qu’il veut bâtir, pour qui, le problème réglé, ce qu’il veut montrer à la fin de la J6, ses contraintes. Elle est relue en groupe au début de la J1 et devient la première section de son CLAUDE.md en J2.
- **Chaque journée = une compétence fixe + un choix appliqué à son projet.** Les labos donnent des textes à copier génériques (« [mon projet] ») et une courte liste de choix ; les revues vérifient des critères communs (ça marche, c’est testé, il y a une règle et un interrupteur), pas la conformité à un modèle.
- **Les démonstrations** gardent Kofi Traiteur (entreprise fictive) comme fil rouge, mais elles sont plus courtes, et une diapositive « Selon votre projet » montre la même étape pour quatre profils : une activité de service sur devis ou rendez-vous, une boutique ou des produits, une association, une école ou une communauté, un outil interne ou un projet sans activité encore. Quand un participant se porte volontaire, le formateur peut faire une partie de la démonstration sur son projet.
- **Pas encore d’activité ?** Le kit de départ de la fiche 0 fait générer par Claude des documents et des données de test réalistes à partir de la fiche projet. Ils servent jusqu’à ce que les vraies données arrivent.
- **La J6 se termine par la démonstration de chaque projet** (5 minutes : ce que j’ai bâti, ce qui marche, ce qui reste) et par la feuille de route des 30 jours de suivi.

Les huit agents de « l’entreprise autonome » restent la carte de référence : chacun y choisit ceux dont son projet a besoin, dans l’ordre qui lui sert.

## Vue d’ensemble

Chaque journée livre une pièce du système et ajoute un réflexe de travail avec Claude, qui sert ensuite tous les jours suivants.

| Journée | Ce que l’on construit | Fil rouge « bien travailler avec Claude » | Livrable du soir |
| --- | --- | --- | --- |
| J1 · Composantes d’une IA | Un assistant sur les documents de son projet | Claude Desktop au quotidien : projets, connecteurs, skills, artefacts ; écrire une bonne demande | Un projet Claude Desktop avec ses documents et une première skill |
| J2 · Processus et fondations | La carte des processus de son projet, sa première page en ligne | Claude Code : la mémoire du projet (CLAUDE.md), le plan avant d’agir, les secrets et les permissions | La première page publique de son projet en ligne, et un CLAUDE.md qui commence par sa fiche projet |
| J3 · Activité et données | Les données de son projet : base, écrans, tableau de bord testé | Petites étapes, relire ce qui change, revenir en arrière (historique Git) | Un tableau de bord sur les données de son projet (réelles ou de test), avec ses tests |
| J4 · Système d’agents | L’agent qui fait l’action clé de son projet : devis, réservation, inscription ou commande ; l’encaissement (carte et mobile money) si le projet vend | Comment fonctionne un agent (outils, boucle, arrêt) et comment le tester sur des cas réels | Un agent qui fait l’action clé de son projet (et encaisse s’il vend), avec sa fiche de règles et ses cas de test |
| J5 · Agents spécialisés et interfaces | Deux agents choisis pour son projet, l’administration, l’e-mail, l’assistant du site | Diagnostiquer une erreur : lire le message, les journaux, faire analyser par Claude | Deux agents utiles à son projet en service, et une vraie erreur réparée seul |
| J6 · Pilotage autonome | Objectifs, routines, rapport, analyste (MCP lecture seule), agent administratif | Faire tourner un agent seul (planifié, en arrière-plan), maîtriser les coûts, aperçu des fonctions avancées | La démonstration de son projet, la carte de ses agents et de leurs garde-fous, sa feuille de route des 30 jours |

Les 30 jours de suivi après la formation servent à faire mûrir le projet et à vérifier ces réflexes, sur la feuille de route écrite en J6.

## J1 à J3 en détail

### J1 · Introduction aux composantes d’une IA

**Objectif :** comprendre chaque brique d’une IA en l’essayant sur son projet, et savoir s’en servir dès le lundi.

- **Pour commencer :** chacun présente sa fiche projet en une minute ; le groupe repère les projets voisins.

- **Les briques :** modèle, prompt, contexte, RAG (répondre à partir de ses documents), skills, agents, outils, MCP.
- **Fil rouge, Claude Desktop au quotidien :**
  - un projet par sujet, avec ses documents et ses instructions ;
  - les connecteurs (agenda, e-mail, Drive), et ce qu’ils donnent à lire ;
  - les skills : écrire une fois une manière de faire, la réutiliser ;
  - les artefacts : un document, une page ou un tableau produit par Claude ;
  - écrire une bonne demande : le contexte, le résultat attendu, un exemple, ce qu’il ne faut pas faire.
- **Livrable :** un projet Claude Desktop qui répond depuis les documents de son projet (ou ceux du kit de départ), et une première skill à son nom.

### J2 · Identification des processus métiers et fondations architecturales

**Objectif :** savoir ce qui s’automatise d’abord, et poser des fondations solides avec Claude Code.

- **La carte :** les processus de son projet (pour une entreprise : attirer, vendre, encaisser, servir, livrer, administrer, piloter ; pour une association ou un outil interne : informer, inscrire, traiter les demandes, suivre) ; pour chacun, manuel, assisté ou autonome.
- **Les fondations :** Claude Code, GitHub, Vercel ; la première page publique de son projet en ligne (vitrine, page d’inscription, page de présentation d’un outil).
- **Ce qui se passe en coulisses** (8 minutes, fiche 8) : API (le guichet), clé d’API (le badge), variables d’environnement (le coffre), OAuth 2.0 (la procuration), webhook (le SMS de confirmation), MCP (la prise universelle). Le participant n’écrit pas ces mécanismes : il sait ce qu’ils font, ce qu’ils demandent, et il se fait guider par Claude pour les configurer, sans jamais lui donner un secret. Chaque notion est reprise en deux minutes au moment où elle sert : OAuth au connecteur de la J1, clés et coffre au devoir d’avant la J4, webhook au paiement de la J4, MCP à l’analyste de la J6.
- **Fil rouge, travailler avec Claude Code :**
  - le fichier **CLAUDE.md** : la mémoire du projet (langue, règles, interdits), que Claude relit à chaque séance ;
  - **le plan avant d’agir** : demander un plan, le corriger, puis seulement laisser faire ;
  - **les secrets** : une clé API ne va jamais dans le code ni dans la conversation, seulement dans les variables d’environnement ;
  - **les permissions** : ce que Claude fait seul, ce qu’il doit demander.
- **Livrable :** la carte des processus de son projet, sa première page en ligne, un CLAUDE.md qui commence par sa fiche projet.

### J3 · Structuration de l’activité et de ses données

**Objectif :** donner une structure à ses données et construire sans casser.

- **La construction :** les entités de son projet (clients et commandes, membres et événements, produits et stocks, demandes internes…) ; une base, des écrans, un tableau de bord de ses trois chiffres ; chaque changement testé.
- **Fil rouge, avancer sans peur :**
  - une petite étape à la fois, vérifiée avant la suivante ;
  - relire ce que Claude a changé, en français, avant de l’accepter ;
  - revenir en arrière : l’historique Git, annuler une modification, retrouver la version d’hier ;
  - demander les tests avec la fonctionnalité, pas après.
- **Livrable :** un tableau de bord sur les données de son projet (réelles ou de test), avec ses tests, et un retour arrière réussi en exercice.

## J4 à J6 en détail

### J4 · Construction du système d’agents IA

**Objectif :** construire des agents qui agissent, et savoir pourquoi ils se comportent comme ils le font.

- **La construction :** l’agent qui fait l’action clé de son projet, choisie sur sa carte (préparer un devis, confirmer une réservation, traiter une inscription, prendre une commande) ; encaisser par carte et mobile money si le projet vend ; fixer les règles et ce que l’agent ne fait jamais sans validation.
- **Fil rouge, comprendre et tester un agent :**
  - le principe : un modèle, des outils qu’il peut appeler, une boucle, une condition d’arrêt ;
  - la fiche de règles de l’agent, écrite en français avant le code ;
  - tester un agent sur 10 cas réels (dont des cas pièges : client agressif, montant faux, demande hors sujet) et corriger jusqu’à ce qu’ils passent ;
  - le paiement ne se valide que sur la confirmation du prestataire, jamais sur le retour du navigateur.
- **Livrable :** un agent qui fait l’action clé de son projet, et qui encaisse si le projet vend, avec sa fiche de règles et ses cas de test.

### J5 · Spécialisation des agents IA et interfaces

**Objectif :** un agent par métier, et des interfaces pour travailler avec eux.

- **La construction :** deux agents choisis pour son projet parmi communication (publications et images à valider), service client ou réponse aux membres, veille, opérations ; l’espace d’administration, l’e-mail, l’assistant du site.
- **Fil rouge, diagnostiquer une erreur :**
  - lire un message d’erreur sans paniquer : où, quand, quoi ;
  - trouver les journaux (Vercel) et les donner à Claude ;
  - demander un diagnostic avant une correction ;
  - vérifier que la correction tient : refaire le test qui échouait.
- **Livrable :** deux agents utiles à son projet en service, et une vraie erreur du labo diagnostiquée et réparée seul.

### J6 · Pilotage autonome de l’entreprise

**Objectif :** que le projet tourne et alerte sans qu’on le surveille, dans un budget connu, et savoir où il va ensuite.

- **La construction :** objectifs et courbe, routines qui relancent et alertent, rapport hebdomadaire, agent analyste (MCP, lecture seule), agent administratif (pièces comptables, échéances, données personnelles), garde-fous.
- **Fil rouge, laisser tourner en confiance :**
  - faire tourner un agent seul : tâches planifiées, travail en arrière-plan, notification à la fin ;
  - les coûts : choisir le modèle selon la tâche, fixer un plafond, lire sa consommation ;
  - un aperçu des fonctions avancées de Claude Code (sous-agents, hooks, commandes, plugins) : savoir qu’elles existent et quand y revenir ;
  - le plan des 30 jours de suivi.
- **Pour finir :** chacun montre son projet en 5 minutes (ce que j’ai bâti, ce qui marche, ce qui reste) ; le groupe pose une question.
- **Livrable :** la démonstration de son projet, la carte de ses agents, de leurs interrupteurs et de leur budget, et sa feuille de route des 30 jours.

## Textes publiés sur le site

Ces textes sont en ligne depuis le 24/11 (description des journées et trois compétences par journée de la page Formation). Les titres n’ont pas changé.

| Journée | Description (page Formation) | Trois compétences (cartes du programme) |
| --- | --- | --- |
| J1 | Modèle, prompt, contexte, RAG, skills, agents, outils, MCP : vous comprenez chaque brique et vous l’essayez sur votre entreprise. Vous prenez en main Claude Desktop : projets, connecteurs, skills. Le soir, votre premier assistant répond à partir de vos propres documents. | Comprendre les briques d’une IA · Travailler chaque jour avec Claude Desktop · Un assistant sur vos documents |
| J2 | Vous cartographiez vos processus, vous choisissez ce qui s’automatise, et vous posez les fondations avec Claude Code, GitHub et Vercel. Vous apprenez à cadrer Claude : sa mémoire du projet, un plan avant d’agir, vos clés toujours protégées. Votre vitrine est en ligne à votre nom. | Cartographier vos processus métiers · Cadrer Claude Code (mémoire, plan, secrets) · Mettre en ligne avec GitHub et Vercel |
| J3 | Clients, commandes, factures : vos données prennent une structure, une base, des écrans et un tableau de bord. Vous avancez par petites étapes testées, et vous savez revenir en arrière si quelque chose casse. | Structurer clients, commandes et factures · Votre base, vos écrans, votre tableau de bord · Avancer sans peur : tests et retour arrière |
| J4 | Des agents qui agissent : ils traitent une demande, préparent un devis, encaissent par carte ou mobile money et relancent. Vous comprenez comment un agent raisonne, vous fixez ses règles et vous le testez sur des cas réels avant de lui faire confiance. | Construire des agents qui agissent · Encaisser par carte et mobile money · Fixer les règles d’un agent et le tester |
| J5 | Un agent par métier : communication, service client, veille du marché, et selon votre activité un agent opérations. Les interfaces pour travailler avec eux : votre administration, l’e-mail, un assistant sur votre site. Et quand quelque chose ne marche pas, vous savez trouver pourquoi. | Des agents communication et service client · Les interfaces pour travailler avec eux · Diagnostiquer et réparer une erreur |
| J6 | Vos objectifs et leur courbe, des routines qui relancent et alertent, un rapport chaque semaine, un agent analyste sur vos données (MCP, lecture seule), un agent administratif et vos garde-fous. Vos agents tournent seuls, dans un budget que vous fixez. | Objectifs, routines et rapport · Des agents qui tournent seuls, dans votre budget · Vos garde-fous et la carte de vos agents |

Phrase sous le programme : « À la fin, vous ne dépendez de personne : vous savez faire évoluer votre système et le réparer. »

## Supports

- Les [fiches réflexes](/admin/bibliotheque/fiches-reflexes-batisseur-ia) (fiche projet et kit de départ, CLAUDE.md type, modèle de demande, règles d’un agent, 10 cas de test, diagnostic, retour arrière, routine qui tourne seule, les coulisses), à envoyer aux participants avant la J1 avec la consigne de remplir la fiche projet ; leur lien public est /ia/fiches.
- Les fichiers PowerPoint et les fichiers du formateur : à déposer dans la Bibliothèque, section Bâtisseur IA.
