# Conversion — leviers psychologiques, mesure et actions admin

Proposition du 22/09/2026, à valider par Ben avant implémentation.
Objectif : faire de la landing une machine à remplir 10 places par mois,
sans tricher. Public : professionnels en poste, méfiants, sur mobile.
Une seule règle au-dessus de toutes les autres : **tout ce que la page
affirme doit être vrai** (fausse rareté et faux compte à rebours sont
interdits en droit de la consommation européen et détruisent la confiance
d'un public de RSSI et d'auditeurs).

## 1. Où en est la page aujourd'hui

| Levier (Cialdini, économie comportementale) | Présent ? | Où |
|---|---|---|
| Réciprocité (donner avant de demander) | Oui | Analyse de profil gratuite, résultat immédiat |
| Engagement progressif (micro-oui) | Oui | 11 questions, barre de progression |
| Autorité | Oui | Coach certifié, titres, « à qui ça ne convient pas » |
| Rareté | Partiel | Jauge « places restantes », mais sans date butoir |
| Preuve sociale | Vide | Section témoignages sans contenu, chiffres « proof » génériques |
| Ancrage du prix | Partiel | Prix local indicatif ; pas de comparaison à l'échec |
| Aversion à la perte | Non | Rien ne dit ce que coûte un échec ou un report |
| Inversion du risque (garantie) | Non | Aucune garantie, aucun « et si ça ne marche pas » |
| Urgence temporelle | Non | Aucune date limite d'inscription |
| Sympathie / unité | Partiel | « Coach francophone », mais peu de « nous, en Afrique de l'Ouest » |
| Dotation (ce qui est déjà à moi) | Non | La place n'est jamais « tenue » pour le prospect |
| Objections (budget, temps, employeur) | Partiel | FAQ ; rien sur le paiement en plusieurs fois ni l'employeur |
| Mesure | Quasi nulle | Vercel Analytics pages vues ; aucun événement de tunnel |

## 2. Leviers à ajouter, par ordre d'impact

### 2.1 Urgence vraie : une date limite par cohorte
- Nouveau champ `registrationClosesAt` sur la cohorte (défaut : J-7 avant le
  démarrage, modifiable dans `/admin/cohortes`).
- Affiché partout où l'offre apparaît : héros, section prix, page résultat,
  page inscription, e-mails de relance. Format : « Inscriptions closes le
  4 janvier · dans 12 jours ». Compte à rebours en jours, jamais en secondes.
- Passé la date : la page bascule automatiquement sur la cohorte suivante et
  propose la liste d'attente. Rien n'est jamais faux.
- Option « tarif de lancement » : prix réduit jusqu'à J-30, prix plein ensuite.
  Deux vrais paliers dans le temps, affichés tous les deux (ancrage +
  urgence). À décider par Ben.

### 2.2 Aversion à la perte : le coût de l'échec, chiffré
Nouvelle section courte entre la preuve et la méthode : « Ce que coûte un
essai raté ». 750 USD de frais d'examen, 30 jours d'attente minimum avant de
repasser, des semaines de révision à refaire, et le poste ou la prime qui
attend. Face à ça, le prix du bootcamp devient une assurance. Chiffres
sourcés (ISC²), ton factuel.

### 2.3 Inversion du risque : une garantie claire
Le levier le plus fort pour un public qui doute. Trois formes possibles,
Ben choisit celle qu'il peut tenir :
1. « Pas prêt à la fin ? Séance de coaching individuelle offerte jusqu'à
   votre examen. » (coût faible, très crédible)
2. « Échec à l'examen dans les 90 jours ? Vous refaites la cohorte suivante
   gratuitement. » (classique du secteur, fort)
3. Remboursement si abandon avant le 3ᵉ jour. (rassure sur l'engagement)
Affichée sous le prix et dans la FAQ, mot pour mot.

### 2.4 Dotation : « votre place est tenue 48 h »
Après l'appel de découverte, Ben peut réserver la place depuis la fiche
lead : le prospect reçoit un e-mail « votre place n° X est tenue jusqu'à
jeudi 18 h », la jauge publique la compte comme réservée, et l'admin la
libère automatiquement à l'échéance. La place devient « à moi », la perdre
coûte. Relance automatique à H-12.

### 2.5 Preuve sociale, vraie et spécifique
- Témoignages : au moins trois, avec prénom, poste, pays, et si possible le
  score ou la date de réussite. Vidéo de 60 s > texte.
- « 7 inscrits sur 10 » affiché seulement quand ≥ 3 inscrits (en dessous, la
  jauge dessert). Règle dans `lib/cohorts.ts`.
- Bandeau « Fatou (Dakar) vient de réserver son appel » : uniquement avec
  de vrais événements des 7 derniers jours et le consentement d'affichage du
  prénom (case sur le scanner). Sinon, pas de bandeau.
- Logos : les entreprises où travaillent les anciens, avec leur accord.

### 2.6 Personnalisation après le scanner (le moment d'intention maximale)
La page résultat est l'écran le plus chaud du tunnel ; aujourd'hui elle ne
vend pas. Ajouts selon le verdict :
- `ready` : prix de son pays, date limite, places restantes, bouton
  « Réserver mon appel » + bouton secondaire « Je connais déjà mon choix :
  m'inscrire » (court-circuit pour les décidés, après validation du message
  par Ben ou immédiatement si Ben l'autorise pour les `ready`).
- `conditional` : le même, avec le plan de comblement des domaines faibles
  et la phrase « Ben confirme votre éligibilité pendant l'appel ».
- `not_yet` : pas de vente, une ressource offerte (réciprocité) et un rendez-
  vous dans six mois.
- Rappel de son propre délai : « Seul : 6 mois. Accompagné : 2 mois. Votre
  objectif : dans 3 à 6 mois. » Le contraste fait le travail.

### 2.7 Lever les trois objections qui bloquent le paiement
- **Budget** : paiement en 2 fois (Stripe le permet ; mobile money en deux
  transactions). Affiché comme « 2 × 325 USD ».
- **Employeur** : générateur de lettre de demande de prise en charge
  (PDF pré-rempli avec le programme, les dates, le prix, la garantie),
  envoyé par e-mail depuis la page résultat. La réponse « oui, si mon
  employeur finance » au scanner déclenche automatiquement cette proposition.
- **Temps** : calendrier visuel des 15 jours (soirs + week-ends) dans la
  section méthode, et FAQ « et si je rate une session ? » (replay).

### 2.8 Micro-leviers d'interface
- Bouton d'appel à l'action collant en bas d'écran sur mobile, après
  défilement du héros, avec le prix local et la date limite.
- Bouton WhatsApp direct « Une question ? Ben répond » (le canal naturel du
  public), horaires affichés.
- Titre en formulation « perte » testé contre la formulation actuelle
  (voir A/B tests plus bas).
- Vitesse : rester sous 2,5 s de LCP en 3G ; chaque seconde perdue coûte
  environ 7 % de conversion (données Google/Deloitte).

Ce qui est écarté, volontairement : compte à rebours en secondes, faux
« 3 personnes regardent cette page », pop-up de sortie (inutile sur mobile
et pénalisé par Google), cases pré-cochées, prix barré fictif.

## 3. Mesurer : le tunnel, événement par événement

Vercel Analytics compte les pages vues ; il ne suffit pas. On enregistre
nos propres événements, côté serveur, dans notre base (aucun tiers, pas de
cookie de suivi, compatible avec la politique de confidentialité).

### 3.1 Modèle `FunnelEvent`
`id, visitorId (aléatoire, cookie 1ʳᵉ partie, 90 j), leadId?, name, step?,
variant?, utmSource, utmMedium, utmCampaign, country?, createdAt`.

### 3.2 Événements
| Nom | Quand |
|---|---|
| `landing_view` | Chargement de la page d'accueil |
| `cta_click` | Clic sur un bouton d'action, avec sa position (héros, prix, collant, vidéo) |
| `scanner_start` | Première réponse |
| `scanner_step` | Chaque question, avec son numéro (→ où l'on perd les gens) |
| `scanner_submit` / `scanner_blocked` | Envoi réussi / refusé (consentement, champ) |
| `result_view` | Page résultat, avec le verdict ; `result_return` si revisite |
| `book_click`, `booking_done` | Réservation |
| `offer_view`, `pay_click` (méthode), `payment_started`, `paid` | Paiement |
| `price_country_change` | Changement de pays dans la section prix |
| `faq_open` | Question ouverte (→ objections réelles) |

### 3.3 Tableau de bord `/admin/tunnel`
Un seul écran, lisible en 10 secondes :
- Tunnel de la semaine : visites → scanner commencé → terminé → résultat →
  appel réservé → offre vue → payé, avec le taux entre chaque marche et la
  comparaison à la semaine précédente.
- Perte par question du scanner (barres) : la question qui fait fuir se
  réécrit.
- Par source (UTM) et par pays : où investir.
- Objections : questions de la FAQ les plus ouvertes.
- Résultat des tests A/B en cours.

### 3.4 Tests A/B, sans dépendance
Un cookie `variant` tiré au chargement, une table d'expériences dans les
paramètres (nom, variantes, actif), l'événement `paid` comme métrique. Test
n° 1 : le titre (actuel contre formulation « perte »). Test n° 2 : bouton
« Analyser mon profil » contre « Vérifier si je suis prêt ». Un test à la
fois, deux semaines minimum, décision au seuil de 95 %.

## 4. Brancher les actions admin sur la mesure

Les événements ne servent que s'ils déclenchent quelque chose. Règles
proposées, toutes visibles dans la file d'actions existante (`/admin`) :

| Signal | Action automatique | Action de Ben |
|---|---|---|
| `offer_view` sans `paid` sous 2 h | Relance « abandon de paiement » le jour même (e-mail + WhatsApp pré-rédigé) | Un clic « Envoyé » |
| `result_return` ≥ 2 en 7 jours | Lead marqué « très chaud », remonte en tête de file | Appel prioritaire |
| `pay_click` mobile money sans confirmation en 30 min | Relance avec la page de secours Netticket | — |
| Réponse « employeur finance » au scanner | Lettre de prise en charge envoyée automatiquement | Suivi J+5 |
| Place tenue arrive à H-12 | Rappel automatique | — |
| Cohorte à J-30 avec < 5 payés | Alerte à Ben + suggestion d'activer le tarif de lancement ou un message « dernières places » aux leads chauds | Décision |
| Cohorte à J-7 (date limite) | Dernier e-mail « inscriptions closes ce soir » aux leads consentants non inscrits | Validation |
| Taux scanner terminé / commencé < 60 % sur 7 jours | Alerte : une question fait fuir, la voir dans le tableau | Réécrire |
| Source UTM avec 0 conversion sur 100 visites | Alerte budget | Couper |

Chaque message automatique respecte le consentement déjà donné, contient le
lien de désinscription, et s'arrête au premier « stop ». Aucun envoi à
quelqu'un qui n'a pas rempli le scanner.

## 5. Ordre de réalisation proposé

1. **Mesure d'abord** (sinon on améliore à l'aveugle) : `FunnelEvent`,
   événements, tableau `/admin/tunnel`. Une étape.
2. **Urgence et perte** : date limite par cohorte, section « coût de
   l'échec », place tenue 48 h, page résultat vendeuse. Une étape.
3. **Garantie, paiement en 2 fois, lettre employeur, bouton collant,
   WhatsApp**. Une étape.
4. **Automatisations admin** sur les signaux, puis A/B tests. Une étape.

Chaque étape se mesure sur deux semaines avant la suivante.

## 6. Décisions de Ben (22/09/2026)

| Sujet | Décision | Conséquence |
|---|---|---|
| Garantie | **En attente** | Recommandation : la n° 1 (séance individuelle offerte jusqu'à l'examen si pas prêt), la moins coûteuse et la plus crédible. Rien n'est affiché tant que Ben n'a pas tranché. |
| Date limite d'inscription | **Oui, en permanence, à J-7 du démarrage** | Chaque cohorte ouverte a une fenêtre d'admission qui se ferme 7 jours avant son début ; passée cette date, la page bascule sur la cohorte suivante. Aucun réglage manuel. |
| Prix promotionnel | **Les tarifs actuels (625 / 1 200 USD) sont déjà promotionnels** | On l'affiche partout, avec le prix de référence du marché barré : la formation officielle ISC² (Official Training) est vendue autour de 2 800 USD. Le prix promotionnel n'est garanti que pendant la fenêtre d'admission de la cohorte en cours : chrono réel (jours, heures, minutes) jusqu'à sa fermeture, sur le héros, la section prix, la page résultat et la page inscription. Le chrono ne se remet jamais à zéro artificiellement : c'est celui de la fenêtre. |
| Paiement en 2 fois | **Non** | — |
| WhatsApp public | **Non** | À la place : un mini-assistant de prise de rendez-vous sur la landing (bouton flottant « Parler à Ben »), qui pose trois questions (prénom, e-mail, consentement) et propose les créneaux réels de l'agenda que Ben règle dans `/admin/parametres/google`. Il réutilise la réservation directe existante (`bookDirect`). |
| Place tenue 48 h après l'appel | **Oui** | Bouton « Tenir la place 48 h » sur la fiche lead, comptée dans la jauge, e-mail au prospect, rappel à H-12, libération automatique à l'échéance. |

Sur les techniques écartées au chapitre 2 : Ben précise que chez lui la
promotion est réelle (prix inférieur au marché, limité à la fenêtre
d'admission). Elle est donc affichée et chronométrée. Restent écartés,
parce qu'ils seraient faux : le compteur qui se remet à zéro chaque jour,
les « 3 personnes regardent cette page » inventés, le prix barré fictif.
Le prix barré affiché sera celui de la formation officielle ISC², sourcé
et daté dans les paramètres (modifiable par Ben).

## 7. Plan d'exécution révisé

1. **Fenêtre d'admission et prix promotionnel** : champ calculé J-7 sur la
   cohorte, chrono réel, prix de référence ISC² dans `/admin/parametres/prix`,
   mention « prix promotionnel de lancement » sur le héros, la section prix, la
   page résultat, la page inscription et les e-mails. Titre du héros mis à
   jour (fait le 22/09).
2. **Mesure** : `FunnelEvent`, événements, `/admin/tunnel`.
3. **Page résultat vendeuse, coût de l'échec, place tenue 48 h.**
4. **Mini-assistant de rendez-vous** sur la landing.
5. **Automatisations admin** sur les signaux, lettre employeur, tests A/B.
6. **Garantie**, dès que Ben a choisi.

## 8. Test ExamBoot en un clic — analyse de placement (22/09/2026)

Source : « API ExamBoot : créer un test en un clic ». Un POST serveur crée un
test CISSP « shareable » de 5 questions et renvoie une URL publique jouable
180 jours, sans compte ; le visiteur donne un pseudo et un e-mail à ExamBoot
pour voir son score. Contraintes : appel serveur à serveur uniquement,
30 appels/min par IP (donc un test par jour mis en cache, pas un par clic),
aucun retour de score vers nous, le lead est capté chez ExamBoot.

### Ce que le test apporte à la conversion
- **Réciprocité** : une vraie valeur donnée avant de demander quoi que ce soit.
- **Écart ressenti** : un professionnel qui fait 2/5 sur cinq vraies questions
  comprend, sans discours, pourquoi il a besoin d'une méthode. C'est le levier
  le plus fort de cette page : la preuve par soi-même.
- **Crédibilité** : les questions viennent d'une vraie banque, pas d'un
  argumentaire.

### Le risque à gérer
Le test capte l'e-mail chez ExamBoot, pas dans notre CRM, et n'en revient
pas. Placé avant notre capture, il détourne des prospects du scanner ; placé
après, il renforce un prospect que nous tenons déjà. La règle : **le test
sert d'abord ceux que nous avons déjà captés**, et n'apparaît avant capture
que comme argument secondaire, jamais à la place de l'analyse de profil.

### Placements, par ordre de valeur
1. **Page résultat, pour tous les verdicts** (le meilleur endroit). Un bloc
   « Vérifiez-le sur 5 vraies questions » entre les axes et la prochaine
   étape. Le prospect est capté, son diagnostic devient concret, l'écart
   pousse vers l'appel ou l'inscription. Pour un profil « pas encore », c'est
   la ressource offerte prévue au §2.6.
2. **E-mail de résultat et message de relance validé par Ben** : le même
   lien. Il donne une raison de répondre et un sujet pour l'appel (« vous
   avez fait combien ? »).
3. **Page de confirmation d'appel et rappel 24 h** : « Avant l'appel, 5
   questions pour que Ben cale ses conseils ». Augmente le taux de présence
   et arme la conversation.
4. **Landing, section « La méthode »** (bande sombre « le CISSP n'est pas un
   concours de mémorisation ») : un bouton secondaire « Voyez par vous-même :
   5 questions réelles », ouvert dans un nouvel onglet. Visible, honnête, mais
   après le scanner dans l'ordre de lecture, et jamais dans le héros ni dans
   la section prix : le héros garde une seule action, et le moment du prix ne
   doit rien avoir qui distraie.
5. **FAQ**, réponse à « l'examen est en anglais » : « essayez cinq questions
   en conditions réelles ». Traite l'objection par l'expérience.

### Mise en œuvre (faite le 22/09/2026, documentation v2 avec retour du score)
- Un prospect identifié (page résultat, e-mails, page de confirmation
  d'appel) reçoit **son propre test**, réutilisé 24 h : le score qui revient
  est le sien. Il est stocké dans `practice_tests`, affiché sur la page, dans
  la fiche lead et dans `/admin/tunnel`. Un visiteur anonyme (landing, FAQ)
  joue **le test partagé du jour** : aucun score n'est affiché ni attribué,
  et le quota ExamBoot est tenu quel que soit le trafic.
- Routes serveur : `POST /api/examboot/test` (création ou réutilisation,
  renvoie code et URL), `GET /api/examboot/test/<code>` (relais du score),
  `GET /test-cissp?t=…|b=…&from=…` (lien des e-mails et des relances :
  redirection directe vers le test).
- Page : `components/examboot/PracticeTestBox.tsx` ouvre le test dans un
  nouvel onglet et interroge le score toutes les 10 s pendant 30 min ; le
  cron balaie ensuite les tests en attente pendant 48 h pour la fiche lead.
- Emplacements : 1 page résultat (tous verdicts), 2 e-mail de résultat et
  gabarits de relance (`{{lien_test}}`, mention dans le message IA et le
  gabarit sans IA), 3 page de confirmation d'appel et rappel 24 h, 4 landing
  section « La méthode », 5 FAQ.
- Événements `examboot_click` (emplacement) et `examboot_done`
  (emplacement:tranche de score). Tableau « Tests ExamBoot » dans le tunnel.
- Variables `EXAMBOOT_API_KEY` (à créer sur Vercel), `EXAMBOOT_CISSP_ID`
  (4). Sans clé, aucun bouton n'apparaît : le site reste tel quel.
- `CLAUDE.md` réservait l'API ExamBoot à la V2 (B6) ; Ben l'a avancée.
