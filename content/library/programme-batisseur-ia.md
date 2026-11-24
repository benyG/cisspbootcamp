---
title: Programme révisé — formation Bâtisseur IA
category: ia-formateur
audience: internal
updated: 2026-11-24
summary: Les six journées en détail, avec le fil rouge « bien travailler avec Claude » et le livrable de chaque soir.
---

## En bref

Les six journées, leurs titres et le projet construit restent les mêmes ; chaque journée gagne un **fil rouge « bien travailler avec Claude »** de 30 à 45 minutes, pris sur la pratique guidée, pas sur la démonstration.

- **Ce qui reste :** 6 journées de 5 h le week-end, le format « on vous montre, vous construisez, on vérifie », l’encaissement par carte et mobile money en J4, le pilotage autonome en J6.
- **Ce qui s’ajoute :** Claude Desktop au quotidien, la mémoire du projet (CLAUDE.md), le plan avant d’agir, les secrets et permissions, le retour arrière, la manière de décrire une demande, le fonctionnement et le test d’un agent, le diagnostic d’une erreur, les coûts.
- **La promesse qui en découle :** à la fin, le participant sait faire évoluer et réparer son système seul, pas seulement l’avoir construit avec nous.

## Vue d’ensemble

Chaque journée livre une pièce du système et ajoute un réflexe de travail avec Claude, qui sert ensuite tous les jours suivants.

| Journée | Ce que l’on construit | Fil rouge « bien travailler avec Claude » | Livrable du soir |
| --- | --- | --- | --- |
| J1 · Composantes d’une IA | Un assistant sur ses propres documents | Claude Desktop au quotidien : projets, connecteurs, skills, artefacts ; écrire une bonne demande | Un projet Claude Desktop avec ses documents et une première skill |
| J2 · Processus et fondations | La carte des processus, la vitrine en ligne | Claude Code : la mémoire du projet (CLAUDE.md), le plan avant d’agir, les secrets et les permissions | Une vitrine en ligne et un CLAUDE.md à son nom |
| J3 · Activité et données | Base, écrans, tableau de bord testé | Petites étapes, relire ce qui change, revenir en arrière (historique Git) | Un tableau de bord sur ses vraies données, avec ses tests |
| J4 · Système d’agents | Agents qui traitent, devisent, encaissent (carte et mobile money), relancent | Comment fonctionne un agent (outils, boucle, arrêt) et comment le tester sur des cas réels | Un agent qui encaisse, avec sa fiche de règles et ses cas de test |
| J5 · Agents spécialisés et interfaces | Un agent par métier, admin, e-mail, assistant du site | Diagnostiquer une erreur : lire le message, les journaux, faire analyser par Claude | Deux agents métier en service et une vraie erreur réparée seul |
| J6 · Pilotage autonome | Objectifs, routines, rapport, analyste (MCP lecture seule), agent administratif | Faire tourner un agent seul (planifié, en arrière-plan), maîtriser les coûts, aperçu des fonctions avancées | La carte complète de ses agents et de leurs garde-fous |

Les 30 jours de suivi après la formation servent à vérifier ces réflexes sur le projet réel du participant.

## J1 à J3 en détail

### J1 · Introduction aux composantes d’une IA

**Objectif :** comprendre chaque brique d’une IA en l’essayant sur son entreprise, et savoir s’en servir dès le lundi.

- **Les briques :** modèle, prompt, contexte, RAG (répondre à partir de ses documents), skills, agents, outils, MCP.
- **Fil rouge, Claude Desktop au quotidien :**
  - un projet par sujet, avec ses documents et ses instructions ;
  - les connecteurs (agenda, e-mail, Drive), et ce qu’ils donnent à lire ;
  - les skills : écrire une fois une manière de faire, la réutiliser ;
  - les artefacts : un document, une page ou un tableau produit par Claude ;
  - écrire une bonne demande : le contexte, le résultat attendu, un exemple, ce qu’il ne faut pas faire.
- **Livrable :** un projet Claude Desktop qui répond depuis ses propres documents, et une première skill à son nom.

### J2 · Identification des processus métiers et fondations architecturales

**Objectif :** savoir ce qui s’automatise d’abord, et poser des fondations solides avec Claude Code.

- **La carte :** attirer, vendre, encaisser, servir, livrer, administrer, piloter ; pour chacun, manuel, assisté ou autonome.
- **Les fondations :** Claude Code, GitHub, Vercel ; la vitrine en ligne à son nom.
- **Fil rouge, travailler avec Claude Code :**
  - le fichier **CLAUDE.md** : la mémoire du projet (langue, règles, interdits), que Claude relit à chaque séance ;
  - **le plan avant d’agir** : demander un plan, le corriger, puis seulement laisser faire ;
  - **les secrets** : une clé API ne va jamais dans le code ni dans la conversation, seulement dans les variables d’environnement ;
  - **les permissions** : ce que Claude fait seul, ce qu’il doit demander.
- **Livrable :** la carte des processus, une vitrine en ligne, un CLAUDE.md écrit par le participant.

### J3 · Structuration de l’activité et de ses données

**Objectif :** donner une structure à ses données et construire sans casser.

- **La construction :** clients, commandes, factures ; une base, des écrans, un tableau de bord ; chaque changement testé.
- **Fil rouge, avancer sans peur :**
  - une petite étape à la fois, vérifiée avant la suivante ;
  - relire ce que Claude a changé, en français, avant de l’accepter ;
  - revenir en arrière : l’historique Git, annuler une modification, retrouver la version d’hier ;
  - demander les tests avec la fonctionnalité, pas après.
- **Livrable :** un tableau de bord sur ses vraies données, avec ses tests, et un retour arrière réussi en exercice.

## J4 à J6 en détail

### J4 · Construction du système d’agents IA

**Objectif :** construire des agents qui agissent, et savoir pourquoi ils se comportent comme ils le font.

- **La construction :** traiter une demande, préparer un devis, encaisser par carte et mobile money, relancer ; fixer les règles et ce que l’agent ne fait jamais sans validation.
- **Fil rouge, comprendre et tester un agent :**
  - le principe : un modèle, des outils qu’il peut appeler, une boucle, une condition d’arrêt ;
  - la fiche de règles de l’agent, écrite en français avant le code ;
  - tester un agent sur 10 cas réels (dont des cas pièges : client agressif, montant faux, demande hors sujet) et corriger jusqu’à ce qu’ils passent ;
  - le paiement ne se valide que sur la confirmation du prestataire, jamais sur le retour du navigateur.
- **Livrable :** un agent qui encaisse, avec sa fiche de règles et ses cas de test.

### J5 · Spécialisation des agents IA et interfaces

**Objectif :** un agent par métier, et des interfaces pour travailler avec eux.

- **La construction :** agents communication (publications et images à valider), service client, veille, et selon l’activité opérations ; l’espace d’administration, l’e-mail, l’assistant du site.
- **Fil rouge, diagnostiquer une erreur :**
  - lire un message d’erreur sans paniquer : où, quand, quoi ;
  - trouver les journaux (Vercel) et les donner à Claude ;
  - demander un diagnostic avant une correction ;
  - vérifier que la correction tient : refaire le test qui échouait.
- **Livrable :** deux agents métier en service, et une vraie erreur du labo diagnostiquée et réparée seul.

### J6 · Pilotage autonome de l’entreprise

**Objectif :** que l’entreprise tourne et alerte sans qu’on la surveille, dans un budget connu.

- **La construction :** objectifs et courbe, routines qui relancent et alertent, rapport hebdomadaire, agent analyste (MCP, lecture seule), agent administratif (pièces comptables, échéances, données personnelles), garde-fous.
- **Fil rouge, laisser tourner en confiance :**
  - faire tourner un agent seul : tâches planifiées, travail en arrière-plan, notification à la fin ;
  - les coûts : choisir le modèle selon la tâche, fixer un plafond, lire sa consommation ;
  - un aperçu des fonctions avancées de Claude Code (sous-agents, hooks, commandes, plugins) : savoir qu’elles existent et quand y revenir ;
  - le plan des 30 jours de suivi.
- **Livrable :** la carte complète de ses agents, de leurs interrupteurs et de leur budget.

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

- Les [fiches réflexes](/admin/bibliotheque/fiches-reflexes-batisseur-ia) (CLAUDE.md type, modèle de demande, règles d’un agent, 10 cas de test, diagnostic, retour arrière, routine qui tourne seule), à envoyer aux participants avant la J1 ; leur lien public est /ia/fiches.
- Les fichiers PowerPoint et les fichiers du formateur : à déposer dans la Bibliothèque, section Bâtisseur IA.
