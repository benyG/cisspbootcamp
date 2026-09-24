# Plan de correction de la landing page CISSP Bootcamp

> Plan reçu de Ben le 24/09/2026, passé au crible le même jour. Ce qui est
> appliqué : tunnel unique (héros → diagnostic → résultat), CC / conseil /
> mentorat hors de la landing (pied de page, aiguillage sur la page résultat),
> texte réduit, planning séparé, coach compact, 8 domaines, mini-test en fin
> de page avec un libellé sans « vraies questions d'examen », prix simplifié
> avec le repère ISC² en une ligne, chrono discret dans la section prix,
> jauge affichée seulement quand une place est prise, FAQ à cinq objections,
> barre mobile fixe, titre et description SEO, événements `pricing_view` et
> `result_view` par route. Ce qui n'est pas suivi, et pourquoi : la headline
> reste celle de Ben (« CISSP, réveillez le leader en cybersécurité qui est en
> vous ») ; la comparaison avec le tarif ISC² est conservée comme repère ;
> l'appel de découverte reste l'action après diagnostic (l'inscription
> directe n'apparaît que si Ben l'autorise) ; pas de « niveau de
> préparation » inventé ; tests A/B reportés faute de trafic ; H1 SEO non
> appliqué. Les textes vivent dans `lib/site-settings.ts` (bouton « Textes par
> défaut » dans `/admin/parametres/site` pour les adopter).


**Site cible :** https://www.cisspbootcamp.online/  
**Objectif principal :** augmenter la conversion en réduisant la densité textuelle, en clarifiant la proposition de valeur et en concentrant la page autour d’un funnel simple : **visiteur → diagnostic → résultat → inscription**.

---

## 0. Principes directeurs

La landing page doit permettre au visiteur de comprendre en quelques secondes :

1. **Ce que c’est** : un bootcamp CISSP en français.
2. **Pour qui** : des professionnels qui veulent structurer sérieusement leur préparation.
3. **Ce qu’ils obtiennent** : 40 h, 15 jours, 8 domaines, live, méthode CISSP, accompagnement.
4. **Ce qu’ils doivent faire maintenant** : analyser leur profil.
5. **Combien cela coûte** : 625 USD.
6. **Pourquoi faire confiance** : coach, méthode, témoignages, format limité à 10 places.

### Règle éditoriale générale

- Une section = une question du prospect.
- Réponse courte, directe, scannable.
- Maximum 3 preuves ou bénéfices visibles par section.
- Paragraphes de 2 à 3 lignes maximum.
- H1/H2 très courts.
- Réduire le texte global de 30 à 50 %.
- Supprimer les phrases qui expliquent une information déjà évidente.
- Ne pas multiplier les CTA concurrents.
- Privilégier l’information utile sur les formulations “marketing”.

---

# 1. Fixer une conversion principale

## Problème actuel

La page propose plusieurs actions concurrentes :

- analyser son profil ;
- voir la méthode ;
- suivre la formation CC ;
- réserver un conseil carrière ;
- découvrir le mentorat ;
- lancer le test 5 questions ;
- acheter le bootcamp.

Cela disperse l’attention.

## Correction

Le funnel principal doit être :

**Landing → diagnostic → résultat → inscription**

### CTA principal avant diagnostic

**Analyser mon profil — 3 min →**

### CTA principal après diagnostic

**Rejoindre la cohorte →**

### Produits alternatifs

- CC
- conseil carrière
- mentorat

ne doivent plus être mis en concurrence directe dans le corps principal de la landing.

Ils deviennent des **routes de sortie après diagnostic** selon le profil du visiteur.

---

# 2. Réécrire le hero

## Objectif

Faire comprendre immédiatement :

- CISSP ;
- français ;
- format intensif ;
- méthode ;
- prochaine étape.

## Structure recommandée

### Ligne de contexte

**COHORTE JANVIER 2027 · 10 PLACES · 100 % EN FRANÇAIS**

### Headline

# Préparez le CISSP.  
# Avec une vraie méthode.

### Sous-titre

**40 h sur 15 jours pour maîtriser les 8 domaines, apprendre à raisonner CISSP et structurer votre préparation jusqu’à l’examen.**

### 3 preuves maximum

- **40 h / 15 jours**
- **Sessions live**
- **Accompagnement jusqu’à l’examen**

### CTA

**Analyser mon profil — 3 min →**

### Microcopy

**Résultat immédiat · Gratuit · Sans engagement**

## À retirer du hero

- descriptions trop longues ;
- trop de badges ;
- plusieurs CTA de même niveau ;
- explications pédagogiques détaillées ;
- formulations abstraites.

---

# 3. Faire du diagnostic le produit gratuit d’entrée

## Nouveau positionnement

Ne pas vendre “11 questions”.

Vendre **le résultat**.

## Copy recommandée

# Êtes-vous réellement prêt pour le CISSP ?

**3 minutes pour savoir :**

- **Votre éligibilité ISC2**
- **Votre niveau de préparation**
- **Votre délai réaliste jusqu’à l’examen**

### CTA

**Obtenir mon diagnostic →**

## Principe

Le diagnostic doit être présenté comme un outil utile, pas comme un simple quiz marketing.

---

# 4. Fluidifier les 11 questions

## UX recommandée

- 1 question par écran ;
- 3 à 5 choix maximum ;
- passage rapide à la question suivante ;
- barre de progression ;
- possibilité de revenir ;
- aucune explication longue sous les choix ;
- affichage du type :
  - **Question 3 sur 11**
  - **~2 min restantes**

## Résultat du diagnostic

Le résultat ne doit pas être un score générique.

Afficher :

### Éligibilité CISSP
Exemples :
- Éligible
- Bientôt éligible
- Parcours Associate of ISC2

### Niveau de préparation
- Début
- Intermédiaire
- Avancé

### Domaines à renforcer
Maximum 2 ou 3.

### Horizon de préparation
Formulation prudente, pas de promesse absolue.

### Prochaine étape
Selon le profil :

- Bootcamp
- Conseil carrière
- CC

---

# 5. Retirer “Trois façons de travailler avec Ben” du cœur de la landing

## Problème

Cette section remet le visiteur dans une logique de choix alors qu’il est venu sur une landing CISSP.

## Correction

Supprimer cette section du flux principal.

### Réutilisation recommandée

Après diagnostic, selon le résultat :

#### Profil prêt pour CISSP
**Rejoindre le bootcamp →**

#### Profil encore trop junior
**Commencer par ISC2 CC →**

#### Profil nécessitant cadrage carrière
**Réserver un conseil carrière →**

---

# 6. Repenser les chiffres-clés

## Garder uniquement

### 40 h
de sessions live

### 15 jours
de préparation intensive

### 10 places
maximum par cohorte

## Retirer du bloc principal

**1 à 2 mois jusqu’à l’examen**

Cette donnée dépend trop du profil du candidat.

À la place :

**Votre diagnostic estime votre horizon de préparation selon votre profil.**

---

# 7. Compacter fortement la section Méthode

Conserver la logique en 4 étapes, mais réduire fortement le texte.

## 01 — Comprendre

### Relier les 8 domaines

Pas seulement apprendre : comprendre comment ils interagissent.

## 02 — Raisonner

### Penser CISSP

Identifier la meilleure décision, pas simplement une réponse techniquement correcte.

## 03 — S’entraîner

### Corriger ses erreurs

Scénarios, questions, corrections commentées.

## 04 — Exécuter

### Arriver prêt

Un plan clair jusqu’à l’examen.

---

# 8. Ajouter une section Planning claire

Cette information répond à une objection majeure :

**“Puis-je suivre cette formation tout en travaillant ?”**

## Copy recommandée

# 15 jours. Pensés pour les professionnels.

### Lun. — Ven.
**2 à 3 h en soirée**

### Week-ends
**Sessions intensives jusqu’à 7 h**

### Phrase finale

**Un format exigeant, mais compatible avec un emploi à temps plein.**

---

# 9. Corriger la formulation “vraies questions d’examen”

## Problème

Éviter les formulations :

- “vraies questions d’examen” ;
- “tirées d’une banque d’examen” ;

sauf si ces questions sont officiellement licenciées.

## Formulation recommandée

# Testez votre raisonnement CISSP

**5 questions d’entraînement originales, conçues au niveau et dans l’esprit du CISSP.**

### CTA

**Tester mon niveau — 10 min →**

### Sous-texte éventuel

**Alignées sur les domaines du blueprint CISSP.**

---

# 10. Déplacer le mini-test

## Nouveau rôle

Le diagnostic et le mini-test ne doivent pas se concurrencer.

### Diagnostic
Répond à :

**“Le CISSP est-il pertinent pour moi maintenant ?”**

### Mini-test
Répond à :

**“Comment je raisonne face à une question CISSP ?”**

## Placement recommandé

Après la section coach ou vers la fin de page.

---

# 11. Transformer le coach en argument de conversion

## Éviter

Une longue biographie.

## Structure recommandée

# Votre coach

## “Je vous dis honnêtement si vous êtes prêt. Puis on construit le chemin jusqu’à l’examen.”

### Credentials courts

**CISSP · Auditeur ISO 27001 · Conférencier**

### Une seule phrase

**Une préparation exigeante, structurée et basée sur le terrain — pas une lecture commentée du CBK.**

## Si données réelles disponibles

Ajouter uniquement des preuves vérifiables :

- nombre de cohortes ;
- nombre de participants ;
- certifications obtenues ;
- dates ou résultats concrets.

Ne rien inventer.

---

# 12. Ajouter une vraie section de preuve sociale

## Objectif

Créer la confiance avec des résultats précis.

## Format recommandé

Maximum 3 témoignages.

### Exemple de structure

> “La différence n’était pas le contenu. C’était enfin de comprendre pourquoi mes réponses étaient mauvaises.”

**Prénom Nom**  
Poste · Pays  
**CISSP obtenu — mois/année**

## Encore mieux si disponible

- Avant : score moyen
- Après : certification obtenue
- Date bootcamp → date examen

Éviter les témoignages vagues du type :

“Excellente formation.”

---

# 13. Simplifier radicalement la section prix

## Problème actuel

Trop d’éléments simultanés :

- prix ;
- réduction ;
- comparaison ;
- countdown ;
- pays ;
- conversion FCFA ;
- paiements ;
- examen ;
- places restantes.

## Version recommandée

# Cohorte janvier 2027

## 625 USD
**≈ 358 000 FCFA**

**40 h de live · 15 jours · 10 places**

### Inclus

- 8 domaines
- Questions et scénarios corrigés
- Plan jusqu’à l’examen
- Accompagnement du coach

### CTA

**Analyser mon profil →**

### Paiement

**Carte · Orange Money · MTN MoMo**

### Mention

**Frais d’examen ISC2 non inclus.**

---

# 14. Reconsidérer le “−78 %”

## Risque

Une remise de 78 % sur une offre premium peut :

- réduire la perception de valeur ;
- faire penser que le prix initial est artificiel ;
- créer une comparaison imparfaite avec une formation officielle ISC2.

## Recommandation

Préférer :

**625 USD — tarif de lancement**

Si une comparaison est conservée, la présenter uniquement comme contexte, pas comme équivalence directe.

---

# 15. Rendre la rareté crédible

## À éviter

**10 places restantes sur 10**

Cela ressemble à un compteur marketing.

## Préférer

**10 participants maximum par cohorte**

Puis seulement si le chiffre est réel :

**4 places disponibles**

---

# 16. Réduire ou déplacer le countdown

## Recommandation

Ne pas afficher un gros countdown dans le hero.

Le mettre dans la section pricing :

**Admissions jusqu’au 4 janvier**

Éventuellement un petit compteur discret.

---

# 17. Réduire la FAQ à 5 objections

Garder uniquement :

1. **Ai-je besoin de 5 ans d’expérience ?**
2. **Le bootcamp est-il entièrement en français ?**
3. **Puis-je suivre tout en travaillant ?**
4. **L’examen CISSP est-il inclus ?**
5. **Comment payer depuis l’Afrique ?**

Les autres réponses doivent être intégrées directement dans la page si elles sont réellement importantes.

---

# 18. Clarifier le wording sur l’expérience CISSP

## Formulation recommandée

**ISC2 demande généralement 5 ans d’expérience cumulée dans au moins 2 des 8 domaines. Certains diplômes ou credentials peuvent réduire cette exigence d’un an. Si vous ne remplissez pas encore l’expérience requise, vous pouvez passer l’examen et suivre le parcours Associate of ISC2.**

Ne pas simplifier au point de rendre la règle inexacte.

---

# 19. Hiérarchie éditoriale à appliquer partout

## Règles

- Headline : 3 à 8 mots.
- Sous-headline : 1 phrase.
- 3 preuves max par section.
- Aucun paragraphe long.
- Une idée par écran.
- Détails dans FAQ ou accordéons.
- Pas de jargon marketing inutile.
- Pas de texte décoratif.
- Pas de répétition entre les sections.

---

# 20. Nouvelle architecture complète

## Ordre recommandé

1. **Hero** — Identifier immédiatement l’offre
2. **Diagnostic** — Faire agir immédiatement
3. **40 h / 15 jours / 10 places** — Résumer l’offre
4. **Pourquoi le CISSP est différent** — Installer le problème
5. **Méthode en 4 étapes** — Expliquer la solution
6. **Planning** — Lever l’objection temps
7. **Coach** — Installer la confiance
8. **Témoignages / résultats** — Prouver
9. **8 domaines** — Confirmer la couverture
10. **Mini-test 5 questions** — Démontrer la méthode
11. **Prix / cohorte** — Convertir
12. **FAQ** — Lever les dernières objections
13. **CTA final** — Convertir

## Important

**CC, conseil carrière et mentorat sortent du flux principal.**

---

# 21. Mettre le prix avant la FAQ

## Logique

Le parcours doit être :

**Je comprends → je crois → je veux → combien ? → j’ai encore une question → j’achète**

Le prix ne doit pas être caché.

---

# 22. Ajouter un sticky CTA mobile

## Avant diagnostic

Barre mobile fixe :

**Cohorte janvier · 625 USD**

**Analyser mon profil →**

## Pendant diagnostic

Masquer la barre.

## Après diagnostic

La transformer en :

**Rejoindre la cohorte →**

---

# 23. Réduire les CTA concurrents

## CTA à garder

### Avant diagnostic
**Analyser mon profil →**

### Mini-test
**Tester mon raisonnement →**

### Conversion finale
**Rejoindre la cohorte →**

## CTA à réduire ou supprimer

- Voir la méthode
- Voir les séances
- En savoir plus
- Découvrir la formation
- Je suis intéressé

---

# 24. Mettre en place une stratégie post-diagnostic

## Profil CISSP prêt

### Message

**Votre profil est compatible avec le bootcamp.**

### CTA

**Rejoindre la cohorte →**

## Expérience encore insuffisante

### Message

**Vous êtes sur la bonne trajectoire, mais le CISSP est encore prématuré.**

### CTA

**Commencer par ISC2 CC →**

## Profil nécessitant un cadrage

### Message

**Votre prochaine étape est surtout de structurer votre trajectoire.**

### CTA

**Réserver un conseil carrière →**

---

# 25. Capture de lead au bon moment

## Ne pas demander l’e-mail avant la première question

Le visiteur doit commencer immédiatement.

## Moment recommandé

Juste avant d’afficher le diagnostic détaillé.

### Copy

**Où vous envoyer votre diagnostic ?**

Champs :

- Prénom
- E-mail
- WhatsApp facultatif

## Bon compromis

- résultat de base visible immédiatement ;
- rapport détaillé envoyé par e-mail.

---

# 26. Analytics à implémenter

Minimum :

```text
hero_cta_click
assessment_start
assessment_q5
assessment_complete
result_bootcamp
result_cc
result_career
pricing_view
checkout_click
payment_success
test_start
test_complete
faq_open_experience
faq_open_exam
faq_open_payment
```

## Objectif

Comprendre :

- où les visiteurs abandonnent ;
- quels profils sont qualifiés ;
- quelles objections dominent ;
- quelles sections participent réellement à la conversion.

---

# 27. Programme d’A/B testing

Ne pas tester 10 choses en même temps.

## Test 1 — Headline

### A
**Préparez le CISSP. Avec une vraie méthode.**

### B
**Arrêtez d’étudier le CISSP au hasard.**

## Test 2 — CTA

### A
**Analyser mon profil — 3 min**

### B
**Savoir si je suis prêt — 3 min**

## Test 3 — Diagnostic

### A
CTA vers le questionnaire.

### B
Première question déjà visible sous le hero.

## Test 4 — Prix

### A
Prix visible tôt.

### B
Prix après méthode + preuve sociale.

---

# 28. Performance technique

## Priorités

- convertir l’image du coach en WebP/AVIF ;
- dimensions responsive ;
- lazy-load des images hors hero ;
- scripts non critiques en `defer` ;
- éviter un framework JS lourd pour le questionnaire ;
- limiter le nombre de fontes ;
- pas de vidéo autoplay ;
- précharger uniquement les assets critiques ;
- vérifier Core Web Vitals mobile.

---

# 29. SEO

## Title recommandé

**Bootcamp CISSP en français | Préparation intensive CISSP**

## Meta description

**Préparez le CISSP en français : 40 h de sessions live sur 15 jours, 8 domaines, questions d’entraînement et accompagnement jusqu’à l’examen. Analysez votre profil gratuitement.**

## H1 recommandé

**Bootcamp CISSP en français**

L’accroche marketing peut être placée en dessous.

---

# 30. Résultat final recherché

La page doit permettre au visiteur de comprendre presque immédiatement :

- **CISSP**
- **100 % en français**
- **40 h**
- **15 jours**
- **10 participants max**
- **sessions live**
- **coach CISSP**
- **diagnostic gratuit**
- **625 USD**

Puis provoquer cette pensée :

> “C’est exactement ce que je cherche. Est-ce que je suis prêt ?”

Et déclencher l’action :

# Analyser mon profil →

---

# Priorités d’implémentation

## P0 — À faire en premier

- [ ] Recentrer toute la page sur le diagnostic.
- [ ] Réécrire le hero.
- [ ] Réduire les CTA concurrents.
- [ ] Retirer “Trois façons de travailler avec Ben” du cœur de la landing.
- [ ] Simplifier la section pricing.
- [ ] Corriger “vraies questions d’examen”.
- [ ] Ajouter une section planning.
- [ ] Réduire la FAQ.
- [ ] Ajouter le sticky CTA mobile.

## P1 — Conversion

- [ ] Refaire la présentation du résultat diagnostic.
- [ ] Ajouter la segmentation post-diagnostic.
- [ ] Ajouter des témoignages vérifiables.
- [ ] Ajouter la capture de lead au bon moment.
- [ ] Déplacer le mini-test.

## P2 — Optimisation

- [ ] Analytics.
- [ ] A/B tests.
- [ ] Performance mobile.
- [ ] SEO.
- [ ] Optimisation progressive selon données réelles.

---

# Contraintes de rédaction pour Claude Code

Lors de l’implémentation :

- Ne pas rallonger les textes.
- Ne pas ajouter de “marketing fluff”.
- Ne pas inventer de statistiques.
- Ne pas inventer de témoignages.
- Ne pas inventer de taux de réussite.
- Ne pas promettre de réussite à l’examen.
- Ne pas promettre un délai fixe jusqu’à l’examen.
- Ne pas utiliser “vraies questions d’examen” sauf preuve de licence officielle.
- Ne pas cacher le prix.
- Toujours préserver la version française comme expérience principale.
- Toujours privilégier clarté, information, confiance et action.
- Les CTA doivent indiquer clairement ce qui se passe ensuite.

---

# North Star

Toute décision de design, copywriting ou UX doit répondre à cette question :

> **Est-ce que ce changement aide le visiteur à comprendre plus vite qu’il est au bon endroit et à passer plus facilement à l’action ?**

Si la réponse est non, ne pas ajouter l’élément.
