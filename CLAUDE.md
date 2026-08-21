# Veille Cardio — contexte du projet

Ce dépôt contient **un seul fichier utile : `index.html`**, publié automatiquement par GitHub Pages sur
**https://hacuubo.github.io/veille-cardio/**. C'est un tableau de bord de veille scientifique en cardiologie.

## À qui ça sert

Robin Bouchau, cardiologue libéral au Centre de Cardiologie de Rodez (Aveyron). Le site lui permet de
retrouver en un coup d'œil les sorties récentes susceptibles de changer sa pratique quotidienne. Il est
consulté sur téléphone entre deux patients, et sera partagé aux 10 cardiologues du groupe.
Interlocuteur non développeur : explique les choses simplement, et évite le jargon technique.

## Ce que contient la page

Structure : sections par **surspécialité** → sous-groupes par **année** (année en cours d'abord, puis N−1)
→ articles triés par **niveau d'impact**.

- Surspécialités (`data-spec`) : `rythmo` (Rythmologie), `interv` (Interventionnel & structurel),
  `ic` (Insuffisance cardiaque), `cmh` (Cardiomyopathies & myocardites), `prev` (Prévention),
  `sport` (Cardiologie du sport · CFX/VO₂ max). En créer une nouvelle si besoin (imagerie, valvulopathies,
  SCA) avec sa couleur, sa section et sa puce de filtre.
- Niveaux (`data-lvl`) : `crit` = changement de pratique probable (marqué « ★ À la une », liséré rouge,
  placé en tête de son année) ; `warn` = à connaître ; `watch` = veille, à suivre.
  Ordre dans chaque année : crit → warn → watch.
- Chaque carte porte `data-kw` : mots-clés **bilingues FR + EN** avec acronymes (FA/AF, CMH/HCM, IC/HF…),
  qui alimentent la barre de recherche.

## Règles éditoriales (décidées avec Robin)

- **Titres des articles dans leur langue d'origine** (anglais si l'article est anglais).
  Tout le reste — résumés, fiches, interface — en français.
- Sélection stricte : essais randomisés pivots, recommandations, méta-analyses majeures. Pas de cohortes
  anecdotiques. Mieux vaut 5 sorties qui comptent que 20 sans intérêt.
- Chaque entrée a un **lien vers l'article original** (NEJM, PubMed, JAMA, EHJ…) et, si possible, un lien
  d'analyse (TCTMD, ACC.org, Cardio-online).
- Fiche de lecture pour les niveaux crit et warn : question clinique → méthode → résultats chiffrés
  (HR, IC95 %, NNT) → limites → **« Au cabinet »** (ce que ça change en pratique libérale), suivie de la
  mention « Fiche rédigée par Claude — à valider par le lecteur avant application clinique ».
- Ne jamais inventer un chiffre, un titre ou un lien : vérifier par recherche web, sinon omettre.

## Présentation (ne pas casser)

La page affiche chaque article sur **une seule ligne** (pastille de couleur + titre + badge de niveau).
Un clic déplie la fiche complète, un second clic replie. **Cette mise en forme est construite
automatiquement par le script en bas de `index.html`** à partir du HTML des cartes : écris donc les cartes
au format long habituel (`<article class="card">` avec `.top`, `<h3>`, `.meta`, `.sum`, `.actions`, `.fiche`)
et l'accordéon se fabrique tout seul. Ne pas écrire de cartes « déjà compactes ».

Autres règles de mise en page : aucun texte d'introduction entre le titre de la page et les filtres de
surspécialité ; pas de tuiles de statistiques ; l'en-tête tient en une ligne discrète (nombre de sorties +
date de mise à jour).

## Mise à jour

- Automatique : une **routine Claude Code** s'exécute chaque lundi 07:00 et met à jour `index.html`
  (son prompt de référence est repris dans ce dépôt et dans le projet Claude de Robin).
- Pendant les grands congrès (ESC, ACC, AHA, TCT, EuroPCR, HFA), passer en couverture quotidienne des
  Hot Lines via « Run now ».
- Après modification : commit + push sur `main`. GitHub Pages republie tout seul en 1–2 minutes.
- Toujours vérifier avant de pousser : HTML valide, liens qui fonctionnent, filtres et recherche opérants.

## Sources de veille

NEJM, Lancet, Circulation, European Heart Journal, JACC, JAMA / JAMA Cardiology, NEJM Evidence ;
recommandations ESC (escardio.org) et ACC/AHA ; relais TCTMD, Cardio-online (français), Medscape,
ACC.org journal scans. Congrès : ESC, ACC, AHA, HRS, EHRA, TCT, EuroPCR, HFA, et pour le sport les
sessions Sports & Exercise Cardiology (EAPC) et Care of the Athletic Heart.

## Historique

- 19/08/2026 — création du tableau de bord, puis « édition zéro » : rattrapage complet 2025–2026,
  66 sorties dont 11 en changement de pratique probable.
- Autres projets de Robin sur ce compte GitHub : `site-cardios` (site vitrine du cabinet, déployé sur
  Netlify) et `planning-indispo` (application d'indisponibilités des cardiologues, également sur Netlify).
