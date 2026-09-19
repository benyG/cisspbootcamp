# CISSP Bootcamp — Cadrage stratégique

*Version 1.0 — 17 septembre 2026*

## 1. Objectif

Vendre **10 inscrits minimum par cohorte, une cohorte par mois, pendant 10 mois**, à partir de **janvier 2027**.

Le produit est prêt : bootcamp CISSP de 40 h, exclusivement en français, supports testés sur deux sessions (5 à 7 participants, retours positifs). Ce qui manque est **la machine de conversion**, pas le contenu.

## 2. Positionnement

- **Coach CISSP**, pas formateur. Le coach diagnostique, oriente, accompagne jusqu'à l'examen.
- Légitimité : certifié CISSP, conférencier, présence établie sur les réseaux, expérience d'audit ISO 27001.
- Promesse implicite : *« Je te dis honnêtement si tu es prêt, puis je t'y amène. »*

Ce positionnement justifie l'appel de découverte et le prix.

## 3. Marché

| Phase | Cible | Raison |
|---|---|---|
| Phase 1 (dès maintenant) | Afrique francophone | Crédibilité et réseau déjà présents (groupes WhatsApp, LinkedIn) |
| Phase 2 (après 2 cohortes remplies) | Europe, Canada | Pouvoir d'achat supérieur, canaux différents |

Profil type : professionnel IT/sécurité en poste, 5 ans d'expérience (prérequis ISC²), employeur susceptible de financer.

## 4. Tarification

| Palier | Prix | Zone |
|---|---|---|
| Afrique | **625 USD** (~350 000 FCFA) | Afrique francophone |
| International | **~1 200 USD** | Europe, Canada |
| Entreprise | à définir (> 1 200 USD) | Employeur qui finance, facture |

Le palier est déterminé automatiquement par le pays déclaré/détecté du prospect. Référence marché : un bootcamp CISSP en Europe/Amérique du Nord coûte 3 000 à 5 000 USD.

**Moyens de paiement** : Stripe (carte) et mobile money via Netticket.net (Orange Money, MTN MoMo, etc. selon pays). E-mails via Resend.

## 5. Mécanique de conversion

```
Contenu de preuve (LinkedIn, groupes WhatsApp)
        ↓
Scanner de profil « CISSP ready » (aimant + diagnostic + capture)
        ↓
Appel de découverte 15 min (booking libre-service)
        ↓
Offre + paiement (palier selon pays)
        ↓
Cohorte (jauge, liste d'attente, pré-engagement)
        ↓
Suivi présence → examen → certifié → témoignage → parrainage
```

**Hypothèses de volume** : 10 appels / semaine × 30–40 % de conversion ≈ 3–4 inscrits / semaine → 10 par cohorte atteignables. Le goulot est de **remplir les 10 créneaux hebdomadaires**.

## 6. Acquisition — ce qui se fait, ce qui ne se fait pas

**On fait :**
- Rejoindre ~10 groupes WhatsApp cyber/IT francophones, observer une semaine, puis apporter de la valeur (réponses techniques, décryptage d'un domaine CISSP, actu sécurité). Ne jamais vendre dans le groupe : les contacts viennent en privé.
- Profil WhatsApp et LinkedIn = vitrine (photo, « Coach CISSP », lien vers le scanner).
- 2 publications / semaine, générées par IA à partir d'angles récurrents, validées par Ben.
- Recontacter les 2–3 anciens participants joignables pour témoignages et statut examen.

**On ne fait pas :**
- Extraction des membres de groupes WhatsApp pour démarchage non sollicité : illégal (RGPD pour prospects UE/Canada), contraire aux CGU WhatsApp (risque de bannissement du numéro), et réputationnellement toxique dans une communauté où tout le monde se connaît.
- SEO comme levier de court terme (6–12 mois avant résultat). Utile en phase 2 seulement.

## 7. Contrainte de temps de Ben

**1 heure par jour**, dont ~30 min pour 2 appels. L'application doit donc servir une **file d'actions quotidienne** (3 actions max), pas un tableau de bord contemplatif.

## 8. Périmètre applicatif

Application **indépendante** sur `cisspbootcamp.online`, séparée d'ExamBoot. Règle : réutiliser ExamBoot uniquement là où c'est plus rapide que de recoder (quiz via API, plus tard). Partout ailleurs, faire neuf et simple.

- **V1 (2 semaines)** : landing, scanner de profil, booking, paiement, vue cohorte, file d'actions.
- **V2 (après les premiers appels)** : CRM/scoring, moteur de contenu, veille de canaux, suivi de cohorte, parrainage, API ExamBoot.

## 9. Garde-fou principal

Le risque identifié est de **s'enfoncer dans le code** au lieu de vendre. Pendant les deux semaines de V1, la prospection manuelle continue : témoignages, publications, groupes.

## 10. Calendrier

| Échéance | Jalon |
|---|---|
| Fin sept. 2026 | V1 en ligne, DNS basculé sur Vercel |
| Oct. 2026 | Premiers appels de découverte, ajustements |
| Nov.–déc. 2026 | Remplissage cohorte 1, V2 par briques |
| **Jan. 2027** | **Cohorte 1 (10 inscrits)** |
