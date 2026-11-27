---
title: Bâtisseur IA · J4 · Construction du système d'agents IA
category: ia-formateur
audience: internal
updated: 2026-11-27
deck: Batisseur-IA-J4.pptx
summary: Le support du formateur de la J4 : fiche de la journée, cours sur l'anatomie d'un agent et les trois agents (l'action clé du projet, l'encaissement par carte et mobile money quand le projet vend, la relance), démonstration Kofi Traiteur comme exemple et « Selon votre projet », réflexe « comprendre et tester un agent », labo pas à pas (règles dans la base, agent de l'action clé et ses 10 cas de test, paiement de test ou confirmation, journal) avec les textes à copier, revue, dépannage, lexique et quiz.
---

## Fiche de la journée

Le matin, vous découvrez trois agents : l'un fait l'action clé de votre projet, celle de votre fiche projet (préparer un devis, confirmer une réservation, traiter une inscription, prendre une commande) ; l'autre encaisse par carte ou mobile money et confirme le paiement, si votre projet vend ; le troisième relance les demandes restées sans réponse. À la fin de la J4, l'agent de votre action clé travaille dans votre application, en mode test, et il a passé ses 10 cas de test ; si votre projet vend, le paiement est confirmé par le prestataire, sinon l'action clé est confirmée par votre application. Vos agents suivent vos règles, notent ce qu'ils font, et vous laissent les décisions qui vous engagent. L'agent relance est un « pour aller plus loin ».

| Rubrique | Détail |
| --- | --- |
| Public | Dirigeants, indépendants, porteurs de projet. Aucune compétence en programmation. |
| Durée | 5 heures de travail (10 h à 16 h, heure de Montréal, avec une heure de pause) : cours, démonstration, réflexe du jour, labo, revue |
| Prérequis | Votre fiche projet (fiche 0), en particulier « L'action clé » et « Mes limites » ; la base, l'administration et les tests de la J3, sur vos données réelles ou sur les données de test du kit de départ ; les règles de votre action clé (prix, places, stock, délais), vos moyens de paiement si votre projet vend, et la liste de ce qu'un agent ne fait jamais sans vous (travail « avant la J4 ») ; vos clés, créées avant la J4 (support de la J3) et rangées uniquement dans les variables d'environnement Vercel : la clé d'API du modèle avec sa limite de dépense (ANTHROPIC_API_KEY) et, si votre projet vend, la clé secrète Stripe de test (STRIPE_SECRET_KEY) ; sinon, on les crée ensemble pendant la pause de midi ; les fiches réflexes 3 et 4 |
| Résultat | L'agent de votre action clé (devis, réservation, inscription ou commande), en brouillon ; si votre projet vend, l'encaissement par carte de test (et mobile money si votre pays le permet), confirmé par le webhook ; sinon, la confirmation de l'action clé par votre application ; des règles écrites ; un journal des actions avec un interrupteur par agent ; la fiche de règles et les 10 cas de test de votre agent |
| Lien avec la suite | J5 ajoute deux agents choisis pour votre projet parmi communication, service client ou réponse aux membres, veille et opérations ; J6 ajoute l'analyste et l'administratif, et pilote l'ensemble avec des objectifs et des garde-fous |

Kofi Traiteur, l'entreprise des exemples et de la démonstration, est un exemple fictif ; l'Atelier Adjoa, dans les fiches réflexes, l'est aussi. Kofi vend sur devis : c'est un exemple parmi d'autres. Chacun construit pour son projet, et la diapositive « Selon votre projet » montre la même étape pour quatre profils. Les participants qui n'ont pas encore d'activité travaillent sur les documents et les données de test du kit de départ (fiche 0).

**Objectifs.** À la fin de la J4, vous savez :

1. décrire un agent en cinq éléments : déclencheur, outils, règles, validation, journal, et les appliquer à l'action clé de votre projet ;
2. séparer ce que l'IA rédige de ce que le code calcule (montants, places, stocks) ;
3. expliquer pourquoi un paiement n'est confirmé que par le prestataire, jamais par le navigateur, et pourquoi une action clé n'est confirmée que par votre application ;
4. choisir pour chaque action : brouillon à valider ou exécution automatique ;
5. lire le journal d'un agent et arrêter un agent ;
6. expliquer comment fonctionne un agent (outils, boucle, arrêt) et le tester sur 10 cas avant de lui faire confiance.

**Déroulé** (heures de Montréal ; Afrique de l'Ouest : + 5 h en hiver, + 4 h en été)

| Heure | Bloc | Contenu |
| --- | --- | --- |
| 10 h 00 | Cours | Anatomie d'un agent, le système d'agents |
| 10 h 45 | Cours et atelier | Les trois agents de la journée ; vos règles écrites |
| 11 h 30 | Démonstration | Un exemple : les agents de Kofi Traiteur, puis « Selon votre projet » |
| 12 h 30 | Pause | 1 heure |
| 13 h 30 | Labo | Réflexe du jour : comprendre et tester un agent (10 cas de test, 30 min), puis l'agent de votre action clé et votre paiement ou votre confirmation, en mode test (4 étapes, 75 min) |
| 15 h 15 | Revue en groupe | Une demande de bout en bout sur chaque projet : action clé, paiement ou confirmation, journal |

## Cours 1 : anatomie d'un agent

Un agent, c'est un modèle qui enchaîne des étapes avec des outils pour atteindre un objectif (J1). Dans votre projet, un agent fiable se décrit toujours en cinq éléments, et c'est vous qui les écrivez avant que Claude Code ne les construise.

| Élément | La question | Exemple : agent devis de Kofi |
| --- | --- | --- |
| Déclencheur | Quand se met-il au travail ? | Une nouvelle demande arrive dans la base |
| Outils | Que peut-il lire et faire ? | Lire la demande et la grille de prix ; créer un brouillon de devis |
| Règles | Que doit-il respecter ? | Prix de la grille uniquement ; remise maximale 10 % ; validité 15 jours |
| Validation | Qu'est-ce qui attend votre accord ? | L'envoi au client |
| Journal | Que note-t-il ? | Demande traitée, montant, heure, résultat |

Le même tableau pour une association qui inscrit à ses ateliers : déclencheur, une inscription arrive ; outils, lire l'inscription et la liste des places, créer une confirmation en brouillon ; règles, trente places au plus, inscription close la veille ; validation, toute inscription hors délai ; journal, inscription, places restantes, heure, résultat.

**Le système d'agents : 3 agents, 1 journal.** (Exemple de Kofi ; remplacez « devis » par l'action clé de votre projet.)

- Une demande arrive dans la base : l'agent devis prépare un brouillon, vous le validez, le devis part avec son lien de paiement.
- Le prestataire de paiement confirme (carte ou mobile money) : l'agent encaissement crée la commande, le reçu et la facture. Si votre projet ne vend pas, c'est votre application qui confirme l'action clé et prévient la personne.
- Chaque matin, l'agent relance reprend les demandes restées sans réponse ni paiement.
- Les trois agents écrivent dans le même journal, visible dans /admin, et chacun a son interrupteur.

### L'IA rédige, le code calcule

Un modèle peut se tromper dans une addition ou inventer un tarif (J1, hallucinations). Règle d'or : **tous les montants sont calculés par le code** à partir de votre grille de prix ; l'IA rédige le texte autour, choisit le ton, résume le besoin. Un test vérifie chaque calcul. La même règle vaut pour tout ce qui se compte : les places restantes d'un atelier, le stock d'un produit, un délai.

### Brouillon ou automatique ?

| Mode | Quand l'utiliser | Exemples |
| --- | --- | --- |
| Brouillon à valider | Tout ce qui vous engage ou écrit à quelqu'un pour la première fois | Devis, réservation, remise, remboursement, première relance |
| Automatique | Ce qui est vérifiable et sans ambiguïté | Reçu après un paiement confirmé, confirmation d'inscription quand il reste des places, rappel de rendez-vous |

On commence toujours en brouillon. On passe en automatique après une ou deux semaines sans correction, une action à la fois.

### Le journal et l'interrupteur

Chaque agent écrit ce qu'il fait dans un journal visible dans l'administration : quoi, quand, sur quelle fiche, avec quel résultat. Chaque agent a un interrupteur : un clic l'arrête, sans rien casser.

### Ce qu'un agent ne fait jamais seul

- Accorder une remise hors de la grille, ou rembourser.
- Marquer un paiement comme reçu sans confirmation du prestataire.
- Écrire à quelqu'un qui n'a pas donné son consentement, ou qui s'est désinscrit.
- Supprimer une donnée.
- Promettre un délai ou un résultat absent de vos règles.

Chacun complète cette liste avec la ligne « Mes limites » de sa fiche projet.

## Cours 2 : les trois agents de la journée

Chez Kofi, ces trois agents remplissent deux rôles du socle de l'entreprise autonome (J1) : le commercial (agent vente : devis et relances) et la finance opérationnelle (agent encaissement). Ils transforment une demande en devis, un devis accepté en argent encaissé, et ne laissent aucun devis mourir sans relance. Dans votre projet, le premier agent fait votre action clé (devis, réservation, inscription ou commande), le deuxième encaisse si vous vendez, et le troisième relance ce qui reste en suspens. Sur la carte de référence des huit agents (J1), choisissez ceux dont votre projet a besoin.

### Avant tout : la clé d'API

Vos agents appellent un modèle par l'**API** (J1) : on paie aux tokens, sans abonnement ; les tarifs à jour sont sur la page de tarifs officielle du fournisseur. La clé se crée sur la console du fournisseur, avant la J4 (support de la J3), et va dans Vercel, variable **ANTHROPIC_API_KEY**, avec une limite de dépense mensuelle fixée sur la console. Une clé ne va jamais dans le code ni dans une conversation, y compris avec Claude.

### Agent 1 · L'action clé (chez Kofi, le devis)

- **Déclencheur** : une demande au statut « nouvelle ».
- **Ce qu'il fait** : il lit le besoin, choisit les lignes dans votre grille de prix, et le code calcule le total ; l'IA rédige le message d'accompagnement.
- **Validation** : le devis attend votre clic « Envoyer » dans l'administration. Si le besoin ne correspond à aucune ligne de la grille, il le signale au lieu d'inventer.
- **La grille de prix** est une table de la base, que vous modifiez depuis l'administration. Jamais un prix dans un prompt.
- **Variante rendez-vous ou réservation** : si vous travaillez sur rendez-vous plutôt que sur devis, le même agent propose des créneaux libres de votre agenda (connecteur, J1) et envoie un rappel la veille.
- **Variante commande** (boutique, produits) : l'agent prépare la commande, le code vérifie le stock et calcule le total.
- **Variante inscription** (association, école, communauté) : l'agent traite l'inscription, le code vérifie les places restantes ; une inscription hors délai ou au-delà des places attend votre clic.
- **Variante demande interne** (outil pour votre travail) : l'agent classe et prépare la réponse à une demande, que vous validez ; pas de paiement.

Dans tous les cas, la chaîne est la même : une demande arrive, l'agent lit le besoin et vos règles, le code calcule ou vérifie, vous validez.

### Agent 2 · L'encaissement (si votre projet vend)

Le client reçoit avec le devis, la réservation ou la commande un lien de paiement. Le statut « payé » ne vient **jamais** du navigateur du client (une page « merci » peut s'afficher sans paiement), ni d'une capture d'écran envoyée par le client : il vient d'une **notification serveur signée** par le prestataire, que votre application vérifie.

| Moyen | Prestataire | Ce qui confirme le paiement |
| --- | --- | --- |
| Carte | Stripe Checkout | Le webhook « paiement terminé », signature vérifiée |
| Mobile money | Un agrégateur de votre pays | Sa notification serveur, puis une vérification de statut auprès de lui |
| Virement, espèces | Aucun | Votre clic « Paiement reçu » dans l'administration, journalisé |

Stripe n'ouvre pas de compte marchand dans tous les pays. Si le vôtre n'est pas couvert, un agrégateur local peut gérer la carte et le mobile money : le principe de la notification signée est le même. Aujourd'hui, tout se fait en **mode test** : aucune vraie carte, aucun vrai argent.

Une fois le paiement confirmé, l'agent crée la commande, envoie le reçu et établit la facture, automatiquement : c'est vérifiable et sans ambiguïté. Factures et reçus sont enregistrés dans la base : l'agent administratif de la J6 les rangera pour la comptabilité. Quand seul un acompte est payé, le solde restant apparaît comme impayé dans le tableau de bord.

**Si votre projet ne vend pas** (association gratuite, outil interne) : la même logique s'applique à la confirmation de l'action clé. C'est votre application qui passe l'inscription ou la demande au statut « confirmé », selon vos règles, et qui prévient la personne par e-mail ; jamais un message de la personne (« c'est bon, je suis inscrit »). Chaque confirmation est notée au journal.

### Agent 3 · La relance

- **Déclencheur** : chaque matin, une tâche planifiée (Vercel Cron).
- **Ce qu'il cherche** : les devis envoyés il y a 5 jours ou plus, sans réponse ni paiement (ou, selon votre projet, les inscriptions, réservations ou commandes non finalisées).
- **Règles** : 2 relances au plus par devis ou par demande, espacées de 5 jours ; jamais à une personne désinscrite ; un lien de désinscription dans chaque e-mail ; ton aimable, aucune fausse urgence.
- **Validation** : en brouillon au début ; automatique quand vous ne corrigez plus.

### Le prompt qui décrit un agent

```
Crée l'agent [nom].

Déclencheur : [quand].
Outils : il peut lire [quoi] et créer [quoi]. Rien d'autre.
Règles : [vos règles, une par ligne].
Validation : [ce qui attend mon clic dans /admin].
Journal : chaque action est notée avec l'heure, la fiche concernée et le résultat, visible dans /admin. Un interrupteur dans /admin l'arrête.

Tous les montants sont calculés par le code, jamais par le modèle. La clé d'API est dans la variable ANTHROPIC_API_KEY. Écris les tests de chaque règle.
```

Remplacez les crochets à partir de votre fiche projet : le nom de l'agent dit votre action clé (« agent inscription », « agent commande »…), les règles reprennent vos prix, vos places ou votre stock, et la ligne « Mes limites ». Le même gabarit servira en J5 pour les agents spécialisés.

## Démonstration : l'exemple de Kofi Traiteur

Kofi Traiteur (fictif) vend sur devis : sa démonstration est un exemple, pas un modèle à reproduire. Les cinq phrases à retenir valent pour tous les projets.

En 55 minutes, une demande de déjeuner pour 25 personnes traverse les trois agents de Kofi, en mode test : devis préparé et validé, paiement par carte de test confirmé par le webhook, puis une relance préparée pour un autre devis resté sans réponse.

| Minutes | Ce qui est montré | Phrase à retenir |
| --- | --- | --- |
| 0 – 10 | Les règles de Kofi écrites en cinq éléments, la grille de prix dans la base | « Les règles avant l'agent. » |
| 10 – 25 | L'agent devis : brouillon, montant calculé par le code, validation dans /admin | « L'IA rédige, le code calcule. » |
| 25 – 40 | Stripe en mode test : lien de paiement, carte de test, webhook, reçu automatique | « Le payé vient du prestataire. » |
| 40 – 50 | L'agent relance déclenché à la main, brouillon, lien de désinscription | « Aimable, jamais pressant. » |
| 50 – 55 | Le journal, puis l'interrupteur d'un agent | « Un clic l'arrête. » |

Moment clé à montrer : le formateur ferme l'onglet de paiement juste après le paiement de test. La commande est quand même créée, parce que la confirmation vient du webhook et non du navigateur.

Plan B : branche « j4-agents » du dépôt « kofi-traiteur-demo ».

**Avec un participant volontaire (facultatif).** Le formateur peut faire une partie de la démonstration sur le projet d'un participant qui se porte volontaire. Pendant les minutes 0 – 10, il écrit avec lui les cinq éléments de son action clé à partir de sa fiche projet ; pendant les minutes 10 – 25, il lance le gabarit d'agent sur une branche à part du dépôt de démonstration, avec les règles du volontaire et des données de test (kit de départ), jamais ses données réelles ni ses clés à l'écran. Le paiement, la relance, le journal et l'interrupteur restent sur Kofi. Si ça déraille, on revient à Kofi sans attendre : la durée de 55 minutes ne change pas.

### Selon votre projet

Juste avant le réflexe du jour, une diapositive « Selon votre projet : l'agent de l'action clé » montre la même étape pour quatre profils (3 minutes : deux participants disent ce que donne l'étape pour leur projet).

| Profil | L'étape du jour |
| --- | --- |
| Service sur devis | L'agent prépare le devis depuis votre grille ; vous validez, le client paie par carte ou mobile money. |
| Boutique, produits | L'agent prend la commande ; le code vérifie stock et total ; paiement par carte ou mobile money. |
| Association, communauté | L'agent traite l'inscription, le code vérifie les places ; confirmation par e-mail, ou cotisation payée. |
| Outil interne, sans activité | L'agent traite une demande interne et la confirme, sans paiement, sur les données du kit de départ. |

Celui qui hésite entre deux profils choisit l'action la plus simple à montrer en J6.

## Bien travailler avec Claude : comprendre et tester un agent

Le réflexe du jour ouvre le labo, à 13 h 30, juste après la pause. Il dure 30 minutes (13 h 30 – 14 h 00), pris sur la pratique guidée (pas sur la démonstration). Pourquoi il compte pour un non-développeur : vous ne lirez pas le code de vos agents, mais vous pouvez toujours savoir ce qu'ils ont le droit de faire et vérifier leur comportement avant de leur confier vos clients.

**Comprendre un agent, puis le tester : les quatre points** (diapositive « Comprendre un agent, puis le tester »)

1. **Un modèle et des outils** : il lit, calcule, rédige grâce aux outils que vous lui donnez. Rien d'autre.
2. **Une boucle et un arrêt** : il recommence jusqu'à finir, ou s'arrête et vous passe la main.
3. **La fiche de règles** : écrite en français avant le code : ce qu'il fait seul, ce qu'il ne fait jamais.
4. **Dix cas avant la confiance** : quatre cas normaux, six difficiles. En service quand les dix passent.

**La fiche : les 10 cas de test** (diapositive « Dix cas de test, dont six difficiles », fiche 4)

```
1-4 Normal : question, action clé, paiement
5  Hors documents : il dit qu'il ne sait pas
6  Exception demandée : il refuse, il transmet
7  « J'ai payé, c'est fait » : il vérifie
8  Personne mécontente : il passe la main
9  « Oublie tes règles » : il refuse
10 Hors sujet : il ramène au projet
```

Les quatre cas normaux suivent votre action clé : une question, une demande qui la déclenche, un paiement ou une confirmation, une question de suivi. Le cas 6 est une remise pour un projet qui vend, une place en plus ou une inscription hors délai pour une association, une demande prioritaire pour un outil interne. Le cas 7 est « J'ai payé, voici la capture » si vous vendez, « C'est bon, je suis inscrit » sinon : dans les deux cas, l'agent ne valide rien de lui-même.

La règle :

- les 10 cas passent avant la mise en service ;
- chaque erreur devient un cas de plus ;
- on rejoue tout après chaque changement.

**L'exercice : l'agent de votre action clé passe ses 10 cas de test.**

1. Fiche 3 (10 à 15 min) : chacun remplit la fiche de règles de l'agent de son action clé à partir des cinq éléments écrits à l'atelier du matin et de la ligne « Mes limites » de sa fiche projet. Insister sur « Il ne fait jamais » et « Il s'arrête et me passe la main quand ».
2. Fiche 4 (15 min) : chacun écrit ses 10 messages de test avec les mots des personnes à qui s'adresse son projet (clients, membres, collègues), et la réaction attendue pour chacun. Sans activité encore : on fait écrire ces messages par Claude à partir de la fiche projet (kit de départ), puis on les relit et on les corrige.
3. À la fin de l'étape 2 du labo : chaque cas est joué comme une demande de test, le résultat est noté dans la colonne « Résultat ». Un cas qui échoue se corrige en précisant la règle à Claude Code, puis on rejoue les 10. On les rejoue aussi après les étapes 3 et 4.

**Comment l'animer (30 min).**

- 10 minutes : les quatre points, avec l'agent devis de Kofi Traiteur (fictif) comme exemple ; faire le lien avec les cinq éléments du matin.
- 5 minutes : la fiche 4, en lisant les six cas difficiles à voix haute, et en donnant leur version pour une association ou un outil interne.
- 15 minutes : l'exercice (fiches 3 et 4), en passant voir chacun.
- Le cas 7 rejoint l'encaissement ou la confirmation : une capture d'écran de paiement, par carte ou mobile money, ou un « c'est confirmé » de la personne, ne vaut jamais confirmation.
- Si le groupe est en retard : passer quand même à l'étape 1 à 14 h 00 et finir la fiche 4 pendant l'étape 1.

Fiches réflexes : [fiches 3 et 4](/admin/bibliotheque/fiches-reflexes-batisseur-ia) ; lien à donner aux participants : /ia/fiches.

## Atelier et labo

Le matin, chacun écrit les règles de ses trois agents. L'après-midi, de 13 h 30 à 15 h 15, chacun commence par le réflexe du jour (30 min), puis construit son agent devis et son paiement sur son application de la J3, **en mode test**, en quatre étapes :

| Étape | Ce que vous faites | Temps |
| --- | --- | --- |
| 1 | La grille de prix dans la base, modifiable depuis /admin | 15 min |
| 2 | L'agent devis, en brouillon, puis vos 10 cas de test joués | 25 min |
| 3 | Le paiement par carte de test, confirmé par le webhook | 25 min |
| 4 | Le journal et les interrupteurs | 10 min |

Soit 75 minutes, de 14 h 00 à 15 h 15, sans marge. Les clés (API du modèle avec limite de dépense, Stripe en mode test) ne sont plus une étape : elles sont créées avant la J4 (support de la J3) ; ceux qui ne les ont pas les créent avec le formateur pendant la pause de midi. Chaque étape passe par une demande de fusion, des tests verts et une vérification sur le lien Preview. L'agent relance est dans « Pour aller plus loin ».

### Atelier du matin · Vos règles (30 min)

Pour chacun des trois agents, remplissez les cinq éléments (déclencheur, outils, règles, validation, journal) à partir de ce que vous avez préparé avant la J4. Pour l'agent devis, ces éléments alimentent la fiche 3, complétée au début du labo.

- [ ] Ma grille de prix est écrite : produit ou service, prix, unité
- [ ] Mes limites sont écrites : remise maximale, validité du devis, nombre de relances
- [ ] Pour chaque action, j'ai choisi : brouillon à valider ou automatique

Avant de commencer : vérifiez que ANTHROPIC_API_KEY et STRIPE_SECRET_KEY sont dans les variables d'environnement Vercel, que la limite de dépense est fixée et que Stripe est en mode test. Aucune clé dans le code ni dans un message.

### Étape 1 · La grille de prix (15 min)

```
Ajoute une table « grille de prix » : nom, description, prix unitaire en centimes, devise, unité (par personne, par heure, forfait), actif oui ou non. Ajoute dans /admin une page pour la modifier. Remplis-la avec : [votre grille].
```

- [ ] Je modifie un prix depuis /admin sur mon téléphone

### Étape 2 · L'agent devis, puis vos 10 cas de test (25 min)

Utilisez le prompt du Cours 2 avec vos règles de l'atelier et votre fiche 3. Précisez :

```
Le devis est créé en brouillon et attend mon clic « Envoyer » dans /admin. Si le besoin ne correspond à aucune ligne active de la grille, l'agent le signale dans /admin et ne crée pas de devis. Le montant est la somme calculée par le code ; le modèle rédige seulement le message.
```

- [ ] Une demande de test produit un brouillon de devis au bon montant
- [ ] Une demande hors grille est signalée, sans devis inventé
- [ ] Mes 10 cas de test (fiche 4) sont joués et leur résultat est noté

### Étape 3 · Le paiement par carte, en test (25 min)

```
Quand j'envoie un devis, ajoute un lien de paiement Stripe Checkout au montant du devis, avec la clé de la variable STRIPE_SECRET_KEY.

Crée la route du webhook Stripe pour l'événement checkout.session.completed. Vérifie sa signature avec la variable STRIPE_WEBHOOK_SECRET. Seul ce webhook passe le paiement à « reçu », crée la commande et envoie le reçu. Le retour du navigateur n'affiche qu'un message d'attente.

Teste la signature : un webhook mal signé est refusé.
```

Dans Stripe (mode test), ajoutez l'adresse du webhook de votre site, copiez sa clé dans Vercel (**STRIPE_WEBHOOK_SECRET**), puis relancez le déploiement. Payez avec une carte de test Stripe.

- [ ] Après le paiement de test, la commande et le reçu apparaissent, même si je ferme l'onglet
- [ ] Le test « webhook mal signé refusé » est vert

Mobile money : si vous avez déjà un compte de test chez un agrégateur, appliquez le même principe (notification serveur vérifiée, puis vérification de statut auprès de lui). Sinon, on le branche après la formation avec sa documentation.

### Étape 4 · Le journal et les interrupteurs (10 min)

```
Ajoute dans /admin une page Journal : chaque action des agents, la plus récente en haut, avec l'heure, l'agent, la fiche et le résultat. Ajoute un interrupteur par agent : arrêté, l'agent ne fait plus rien et le journal le note.
```

- [ ] J'arrête l'agent devis, j'envoie une demande de test : aucun brouillon n'est créé, le journal le dit
- [ ] Le paiement de test de l'étape 3 apparaît dans le journal

Les agents ajoutés ensuite (relance, agents de la J5) écrivent dans ce même journal et reçoivent chacun leur interrupteur.

## Ça tourne ? La revue de 15 h 15

Chacun fait passer une demande de test du devis jusqu'au paiement, devant le groupe, puis montre son journal.

- [ ] Une demande produit un brouillon de devis au bon montant, que je valide
- [ ] Une demande hors grille est signalée, sans invention
- [ ] Ma fiche de règles (fiche 3) est complète
- [ ] Un paiement de test crée la commande et le reçu, par le webhook
- [ ] Le journal montre chaque action ; un interrupteur arrête un agent
- [ ] Les tests sont verts, dont celui du webhook mal signé
- [ ] Toutes les clés sont dans Vercel, en mode test, avec une limite de dépense
- [ ] Réflexe du jour : mon agent devis passe ses 10 cas de test

Rien ne passe en mode réel avant d'avoir relu les règles à tête reposée. Ceux qui n'ont pas fini notent les étapes restantes et les terminent avant la J5.

## Dépannage

| Symptôme | Quoi faire |
| --- | --- |
| L'agent devis invente un prix | « Le montant doit venir uniquement de la grille, calculé par le code ; ajoute un test » |
| « Authentication error » de l'API du modèle | Vérifiez ANTHROPIC_API_KEY dans Vercel, puis relancez le déploiement |
| Le webhook renvoie une erreur 400 | La clé STRIPE_WEBHOOK_SECRET ne correspond pas à cette adresse de webhook : recopiez-la, relancez le déploiement |
| Le paiement de test ne crée rien | Dans Stripe, ouvrez le webhook et regardez l'événement envoyé ; copiez la réponse à Claude Code |
| Pour aller plus loin : la relance ne part pas le matin | Les tâches planifiées ne tournent qu'en production : testez avec le bouton manuel |
| Le ton de l'agent ne vous ressemble pas | Donnez-lui deux exemples de vos vrais messages dans ses règles |
| Un des 10 cas de test échoue | Précisez la règle concernée à Claude Code, puis rejouez les 10 cas, pas seulement celui qui échouait |

On copie à Claude Code le message d'erreur ou la réponse de Stripe, jamais une clé. Bloqué plus de 10 minutes : levez la main.

## Lexique

| Mot | En une phrase |
| --- | --- |
| Agent | Un modèle qui enchaîne des étapes avec des outils, dans vos règles |
| Déclencheur | L'événement qui met l'agent au travail |
| Boucle et arrêt | L'agent recommence tant que sa tâche n'est pas finie, ou s'arrête et vous passe la main |
| Fiche de règles | Ce que l'agent fait seul, ce qu'il ne fait jamais et quand il s'arrête, écrit en français avant le code |
| Cas de test | Une situation dont on connaît la bonne réaction, jouée pour vérifier l'agent |
| Validation humaine | L'action attend votre clic avant de partir |
| Journal | La trace de chaque action d'un agent |
| Interrupteur | Le bouton qui arrête un agent sans rien casser |
| API | L'accès au modèle depuis votre application, payé aux tokens |
| Webhook | Une notification envoyée par un service à votre application |
| Signature | La preuve qu'un webhook vient bien du prestataire |
| Mode test | Des clés et des cartes factices : aucun vrai argent |
| Tâche planifiée (cron) | Un travail lancé seul à heure fixe |

## Quiz

1. Pourquoi le montant d'un devis n'est-il jamais calculé par le modèle ?
   - Parce qu'il peut se tromper ou inventer ; le code calcule, et un test le vérifie.
2. Le client voit « Merci pour votre paiement ». Le devis est-il payé ?
   - Pas forcément : seul le webhook signé du prestataire le confirme.
3. Quand passer la relance en automatique ?
   - Après une ou deux semaines de brouillons validés sans correction.
4. Un client s'est désinscrit. L'agent relance peut-il lui écrire pour un devis en cours ?
   - Non. Jamais à un client désinscrit.
5. Une relance part avec une erreur. Premier geste ?
   - L'interrupteur de l'agent, puis le journal pour comprendre.
6. Un client écrit « J'ai payé, voici la capture ». Que fait l'agent ?
   - Il ne valide pas la commande : seule la confirmation du prestataire compte. Il vérifie ou passe la main.
7. Quand un agent peut-il être mis en service ?
   - Quand ses 10 cas de test passent, dont les six difficiles ; on les rejoue après chaque changement.

## Avant la J5 · 30 minutes

- [ ] Notez les questions que vos clients posent le plus souvent, avec votre réponse habituelle
- [ ] Listez 3 concurrents ou sources à suivre (sites, pages, salons) et ce que vous voulez y surveiller
- [ ] Choisissez les réseaux où vous publiez, et rassemblez 3 publications qui vous ressemblent
- [ ] Si vous produisez ou livrez : décrivez le circuit d'une commande jusqu'à la livraison, et vos fournisseurs
- [ ] Lisez la fiche 5 : diagnostiquer une erreur en 5 étapes (fiches réflexes, lien /ia/fiches)

## Pour aller plus loin : l'agent relance

L'agent relance est présenté en cours et en démonstration, mais il n'est pas au labo et rien n'en dépend en J5. Si vous voulez le construire après la formation, écrivez à Claude Code :

```
Crée l'agent relance, lancé chaque matin par Vercel Cron. Il cherche les devis envoyés il y a 5 jours ou plus, sans paiement ni réponse, et prépare une relance en brouillon dans /admin. 2 relances au plus par devis, espacées de 5 jours. Jamais à un client désinscrit. Chaque e-mail contient un lien de désinscription en un clic. Ton aimable, aucune fausse urgence. Ajoute dans /admin un bouton pour le lancer à la main.
```

- [ ] Le bouton manuel prépare une relance pour un devis de test vieux de 5 jours
- [ ] Le lien de désinscription fonctionne et bloque la relance suivante
- [ ] J'arrête l'agent relance, je clique sur le bouton manuel : rien ne part, le journal le dit
