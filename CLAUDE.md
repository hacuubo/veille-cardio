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
  `ic` (Insuffisance cardiaque), `usic` (USIC · Réanimation cardiologique — arrêt cardiaque, choc
  cardiogénique, assistance circulatoire, soins critiques), `cmh` (Cardiomyopathies & myocardites),
  `prev` (Prévention), `sport` (Cardiologie du sport · CFX/VO₂ max). En créer une nouvelle si besoin (valvulopathies, SCA)
  avec sa couleur (`--series-N`), sa section, sa puce de filtre **et son entrée dans la table `SPECS`
  du script en bas de page** ainsi que dans `outils/bulletin.mjs`.
- Années : deux puces, **2026 et 2025, cochées toutes les deux par défaut**, que le lecteur décoche
  indépendamment (ce ne sont pas des boutons exclusifs). Si les deux sont décochées, la page affiche le
  message « Aucune année sélectionnée ». Les puces et les en-têtes d'année ne portent que le millésime
  (pas de mention « en cours »). Au passage à 2027, ajouter la puce de l'année en cours et retirer la
  plus ancienne.
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

La page affiche chaque article sur **une ligne repliée** : titre d'origine, accroche française en dessous,
puis une ligne de repère *revue · date · type d'étude*. Un clic déplie la fiche complète, un second replie
(le dépliage est animé). **Cette mise en forme est construite automatiquement par le script en bas de
`index.html`** à partir du HTML des cartes : écris donc les cartes au format long habituel
(`<article class="card">` avec `.top`, `<h3>`, `.meta`, `.sum`, `.actions`, `.fiche`) et l'accordéon se
fabrique tout seul. Ne pas écrire de cartes « déjà compactes ».

Trois attributs et un bloc à renseigner **sur chaque nouvelle carte** :

- `data-ajout="AAAA-MM-JJ"` — **obligatoire** : date d'ajout. C'est elle qui déclenche la pastille verte
  « nouveau » (pendant 7 jours) et qui alimente le bandeau « Cette semaine ». Sans elle, la sortie passe
  inaperçue.
- `data-fr="…"` — accroche française de six à dix mots, **obligatoire sur chaque carte, quel que soit
  le niveau** : c'est la ligne que Robin lit sous le titre anglais, et celle qui s'affiche dans le bandeau
  « Cette semaine ». Elle doit se lire à voix haute sans buter : une phrase de français courant, verbe
  conjugué, jamais un chiffre laissé en suspens en fin de phrase (écrire « chez le diabétique, un dépistage
  sur quatre révèle une insuffisance cardiaque ignorée », pas « … révèle une IC ignorée sur quatre »).
  Développer les sigles peu courants, garder ceux que tout cardiologue lit d'un coup d'œil (FA, FEVG, TAVI).
  Espace insécable avant `:`, `?` et `%`.
- `<div class="cle">…</div>` — **juste après `<p class="sum">`**, hors de la fiche : le chiffre clé de
  l'étude, repris mot pour mot de la fiche (HR, IC95 %, pourcentages, avec les nombres en `<b>`). Le script
  l'affiche en bandeau « Résultat principal ». À omettre pour les recommandations sans chiffre unique.
- Le bloc `.verdict` (« Au cabinet ») reste écrit à sa place habituelle dans la fiche : **le script le
  remonte tout seul** juste sous le résumé, avec un libellé en capitales. Ne pas le déplacer à la main.

Autres règles de mise en page :

- En-tête (`header.site-head`) : **rien au-dessus du logo**, et tout est **centré**. Dans l'ordre — le nom
  **PAUSE CARDIO** (`h1.brand-name`) au milieu, avec la marque ECG (`svg.brand-mark`) à sa droite sur
  ordinateur et **sous le nom sur téléphone** (moins de 560 px) ; la ligne discrète `.eyebrow` (nombre de
  sorties + date de mise à jour + lien vers le dernier bulletin) ; le liséré rouge `.brand-rule` ; puis la
  seule ligne de descriptif *« Screening transversal hebdomadaire de sorties bibliographiques d'ampleur,
  assisté par IA. »*. Rien d'autre entre le descriptif et les filtres, et pas de tuiles de statistiques.
- Sous le descriptif vient le bandeau **« Cette semaine »** (construit par le script à partir des
  `data-ajout` les plus récents : jusqu'à six sorties). Il est **replié par défaut** — une seule ligne
  « Cette semaine · N sorties ajoutées le … » avec un chevron ; un clic déplie la liste, un second la
  replie. Les lignes dépliées sont cliquables : elles lèvent les filtres et déplient l'article. **Puis**
  les filtres. Rien d'autre, et pas de tuiles de statistiques.
- Les puces de surspécialité sont disposées **en grille ordonnée** (`.filters .row.grid .chips`) :
  trois colonnes sur ordinateur, deux sur téléphone, et « Toutes les surspécialités » sur toute la
  largeur. Ne pas revenir à une simple ligne de puces qui s'enchaînent.
- **Couleurs** : la surspécialité ne sert plus que de fin liséré à gauche de la carte (et de couleur du
  libellé « Au cabinet ») ; c'est le **niveau** qui porte la couleur forte — badge, et fond légèrement
  rosé pour les `crit`. Ne pas remettre de grosse pastille de couleur par article.
- **Confort de lecture** : le texte des fiches est limité à 68 caractères de large, les lignes d'articles
  font au moins 44 px de haut, et l'en-tête de surspécialité reste collé en haut pendant le défilement.
- **Écran d'ouverture** : au chargement, un plein écran dessine le logo — un tracé ECG qui se déroule,
  s'interrompt sur les deux barreaux rouges du symbole pause, puis repart — suivi du nom « PAUSE CARDIO »
  et du descriptif, avant de s'effacer sur l'accueil — **durée totale 5 secondes** (maintien puis fondu).
  Une ligne discrète « Touchez l'écran pour entrer » apparaît au bout de 2 secondes : l'écran se saute d'un
  clic ou d'une touche. Il ne rejoue pas dans la même session (`sessionStorage`) et se réduit à un bref
  fondu si le lecteur a demandé moins d'animations. Le balisage est en tête de `<body>` (`#splash`), les
  styles sous « écran d'ouverture ».

## Identité

Le site s'appelle **PAUSE CARDIO**. Le logo est le symbole pause (⏸) dessiné dans un tracé ECG : la ligne
se déroule, s'interrompt sur les deux barreaux rouges, repart. Il existe en deux tailles, toutes deux en
SVG écrit à la main dans `index.html` — `svg.brand-mark` (92 × 26) en tête de page, `svg.splash-mark`
(300 × 90) sur l'écran d'ouverture. **Ne pas redessiner ces tracés** ni déplacer le bloc `#splash`, qui
doit rester juste après `<body>` avec son script inline (c'est ce qui évite le clignotement au retour).
Sous 560 px de large la marque d'en-tête passe sous le nom, centrée : côte à côte, le tracé serait comprimé
et les complexes QRS deviendraient illisibles.

Couleurs de marque : `--brand` (#d03b3b en clair, #e2564f en sombre) et `--brand-line` pour le tracé.
Ne pas les confondre avec `--status-critical`, réservé au niveau « changement de pratique » des fiches.

Pas de `favicon` ni d'`apple-touch-icon` tant que l'icône d'écran d'accueil n'est pas tranchée : iOS
génère une capture de la page, ce qui convient en attendant.

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
- 23/08/2026 — identité visuelle : logo « pause dans l'ECG » en tête de page et sur l'écran d'ouverture,
  accroche française sur les 84 sorties, et création de la surspécialité **USIC · Réanimation
  cardiologique** (6 premières sorties, dont les recommandations AHA 2025 de réanimation).
- Autres projets de Robin sur ce compte GitHub : `site-cardios` (site vitrine du cabinet, déployé sur
  Netlify) et `planning-indispo` (application d'indisponibilités des cardiologues, également sur Netlify).
