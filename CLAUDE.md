# Pause Cardio — contexte du projet

Le projet s'appelle **Pause Cardio**, descriptif : *« Screening transversal hebdomadaire de sorties
bibliographiques d'ampleur, assisté par IA. »* (nom choisi le 23/08/2026 ; le dépôt et l'URL gardent pour l'instant l'ancien nom `veille-cardio`, un nom
de domaine propre est prévu). Le fichier principal est **`index.html`**, publié automatiquement par
GitHub Pages sur **https://hacuubo.github.io/veille-cardio/**. C'est un tableau de bord de veille
scientifique en cardiologie.

Ambition à moyen terme : devenir une source reconnue de la cardiologie française, collecter des
inscriptions au bulletin, et servir la visibilité du centre de Rodez. La feuille de route en cinq phases
(site → audience → application web installable → stores) a été établie le 23/08/2026 ; l'app native n'est
pas la première étape.

## À qui ça sert

Robin Bouchau, cardiologue libéral au Centre de Cardiologie de Rodez (Aveyron). Le site lui permet de
retrouver en un coup d'œil les sorties récentes susceptibles de changer sa pratique quotidienne. Il est
consulté sur téléphone entre deux patients, et sera partagé aux 10 cardiologues du groupe.
Interlocuteur non développeur : explique les choses simplement, et évite le jargon technique.

## Ce que contient la page

Structure : sections par **surspécialité** → sous-groupes par **année** (année en cours d'abord, puis N−1)
→ articles triés par **niveau d'impact**.

- Surspécialités (`data-spec`) : `rythmo` (Rythmologie), `interv` (Interventionnel & structurel),
  `imagerie` (Imagerie cardiaque — coroscanner, IRM cardiaque, échocardiographie et ETT de stress),
  `ic` (Insuffisance cardiaque), `cmh` (Cardiomyopathies & myocardites), `prev` (Prévention),
  `sport` (Cardiologie du sport · CFX/VO₂ max). En créer une nouvelle si besoin (valvulopathies, SCA)
  avec sa couleur (`--series-N`), sa section, sa puce de filtre **et son entrée dans la table `SPECS`
  du script en bas de page** ainsi que dans `outils/bulletin.mjs`.
- Années : deux puces, **2026 et 2025, cochées toutes les deux par défaut**, que le lecteur décoche
  indépendamment (ce ne sont pas des boutons exclusifs). Si les deux sont décochées, la page affiche le
  message « Aucune année sélectionnée ». Au passage à 2027, ajouter la puce de l'année en cours et
  retirer la plus ancienne.
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

Autres règles de mise en page :

- En-tête : une ligne discrète (nombre de sorties + date de mise à jour + lien vers le dernier bulletin),
  puis le titre **PAUSE CARDIO**, puis la seule ligne de descriptif
  *« Screening transversal hebdomadaire de sorties bibliographiques d'ampleur, assisté par IA. »*.
  Rien d'autre entre le descriptif et les filtres, et pas de tuiles de statistiques.
- Les puces de surspécialité sont disposées **en grille ordonnée** (`.filters .row.grid .chips`) :
  trois colonnes sur ordinateur, deux sur téléphone, et « Toutes les surspécialités » sur toute la
  largeur. Ne pas revenir à une simple ligne de puces qui s'enchaînent.
- **Écran d'ouverture** : au chargement, un plein écran affiche « PAUSE CARDIO » avec un tracé ECG qui se
  dessine, le cœur qui bat, puis s'efface sur l'accueil — **durée totale 5 secondes** (maintien puis fondu).
  Une ligne discrète « Touchez l'écran pour entrer » apparaît au bout de 2 secondes : l'écran se saute d'un
  clic ou d'une touche. Il ne rejoue pas dans la même session (`sessionStorage`) et se réduit à un bref
  fondu si le lecteur a demandé moins d'animations. Le balisage est en tête de `<body>` (`#splash`), les
  styles sous « écran d'ouverture ».

## Mise à jour

- Automatique : une **routine Claude Code** s'exécute chaque lundi 07:00 et met à jour `index.html`
  (son prompt de référence est repris dans ce dépôt et dans le projet Claude de Robin).
- Pendant les grands congrès (ESC, ACC, AHA, TCT, EuroPCR, HFA), passer en couverture quotidienne des
  Hot Lines via « Run now ».
- **Une fois `index.html` à jour, toujours lancer `bash outils/faire-bulletin.sh`** (voir la section
  suivante) : c'est ce qui fabrique le bulletin PDF de la semaine.
- Après modification : commit + push sur `main` (index.html **et** le dossier `bulletin/`).
  GitHub Pages republie tout seul en 1–2 minutes.
- Toujours vérifier avant de pousser : HTML valide, liens qui fonctionnent, filtres et recherche opérants.

## Bulletin PDF hebdomadaire

Après chaque mise à jour, un **bulletin d'une à trois pages** récapitule uniquement ce qui vient d'être
ajouté — de quoi être lu en deux minutes ou transféré aux 10 cardiologues du groupe.

- Une seule commande, à lancer depuis la racine du dépôt : `bash outils/faire-bulletin.sh`
- Elle compare les articles de `index.html` à ceux déjà signalés (mémorisés dans `bulletin/etat.json`,
  la comparaison se fait sur le titre) :
  - **s'il y a du nouveau** → écrit `bulletin/bulletin-AAAA-MM-JJ.html`, l'imprime en PDF avec Chromium,
    met à jour la page d'archives `bulletin/index.html` et pose le lien « 📄 Bulletin du … » dans la ligne
    d'en-tête du tableau de bord ;
  - **s'il n'y a rien de neuf** → n'écrit aucun fichier et affiche `RIEN`. Pas de bulletin vide : Robin
    n'est sollicité que quand il y a quelque chose à lire.
- Contenu d'une entrée : surspécialité, niveau, type d'étude, titre (cliquable vers l'article original),
  journal et date, résumé, et l'encadré **« Au cabinet »** repris de la fiche de lecture. Ordre :
  crit → warn → watch. Le pied de page rappelle que les fiches sont rédigées par Claude et à valider.
- Le PDF est publié avec le site : `https://hacuubo.github.io/veille-cardio/bulletin/` liste tous les
  bulletins, le plus récent en tête. `bulletin/exemple.pdf` sert d'aperçu avant le premier vrai bulletin.
- Les fichiers de `bulletin/` (PDF, `index.html`, `etat.json`) doivent être **commités** : c'est `etat.json`
  qui évite de re-signaler la semaine suivante les articles déjà annoncés.
- Autres commandes utiles : `node outils/bulletin.mjs --init` (remémorise tous les articles actuels sans
  produire de bulletin — à ne relancer qu'en cas de remise à zéro), `bash outils/faire-bulletin.sh --apercu`
  (bulletin d'essai à partir des 5 dernières sorties 2026, ne touche à rien d'autre),
  `--date=AAAA-MM-JJ` pour forcer la date du bulletin.
- Ne jamais toucher aux repères `<!--BULLETIN:DEBUT-->` / `<!--BULLETIN:FIN-->` de `index.html` : c'est là
  que le script insère le lien vers le dernier bulletin.

## Envoi du bulletin par e-mail

Dès qu'un nouveau bulletin arrive sur `main`, GitHub l'envoie par e-mail avec le PDF en pièce jointe
(corps du message : la liste des nouveautés ; le détail est dans le PDF).

- Mécanique : `.github/workflows/bulletin-mail.yml` se déclenche sur les pushes vers `main` qui touchent
  `bulletin/bulletin-*.pdf`, et lance `outils/envoyer-bulletin.py` (Python standard, envoi via SMTP Gmail).
- Réglages, à enregistrer une seule fois dans **Settings → Secrets and variables → Actions** :
  - `GMAIL_ADRESSE` — l'adresse Gmail qui envoie ;
  - `GMAIL_MOT_DE_PASSE_APPLICATION` — le « mot de passe d'application » Gmail (16 lettres, à créer sur
    myaccount.google.com/apppasswords ; ce n'est pas le mot de passe du compte) ;
  - `BULLETIN_DESTINATAIRES` — facultatif, adresses séparées par des virgules. **Absent = le bulletin part
    vers `GMAIL_ADRESSE`**, c'est-à-dire vers Robin seul. Pour ajouter les autres cardiologues, il suffit
    d'ajouter ce secret.
- Le dépôt est **public** : les adresses ne sont jamais écrites dans un fichier, uniquement dans ce secret,
  et les destinataires sont mis en copie cachée.
- Si les identifiants ne sont pas (encore) enregistrés, le script affiche « envoi ignoré » et se termine
  normalement — pas d'échec rouge ni de notification d'erreur.
- Envoi manuel de test : onglet **Actions → Bulletin par e-mail → Run workflow**, en indiquant
  `bulletin/exemple.pdf` dans le champ prévu. En local : `python3 outils/envoyer-bulletin.py --essai`
  affiche le message sans rien envoyer.

## Sources de veille

NEJM, Lancet, Circulation, European Heart Journal, JACC, JAMA / JAMA Cardiology, NEJM Evidence ;
recommandations ESC (escardio.org) et ACC/AHA ; relais TCTMD, Cardio-online (français), Medscape,
ACC.org journal scans. Congrès : ESC, ACC, AHA, HRS, EHRA, TCT, EuroPCR, HFA, et pour le sport les
sessions Sports & Exercise Cardiology (EAPC) et Care of the Athletic Heart.

## Historique

- 19/08/2026 — création du tableau de bord, puis « édition zéro » : rattrapage complet 2025–2026,
  66 sorties dont 11 en changement de pratique probable.
- 21/08/2026 — bulletin PDF hebdomadaire (`outils/faire-bulletin.sh`) et envoi par e-mail.
- 23/08/2026 — le projet devient **Pause Cardio** : nouveau titre et descriptif, écran d'ouverture,
  filtres de surspécialité en grille, création de la surspécialité **Imagerie cardiaque** (4 premières
  sorties, dont SCOT-HEART à 10 ans).
- Autres projets de Robin sur ce compte GitHub : `site-cardios` (site vitrine du cabinet, déployé sur
  Netlify) et `planning-indispo` (application d'indisponibilités des cardiologues, également sur Netlify).
