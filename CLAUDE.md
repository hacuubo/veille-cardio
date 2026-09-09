# Pause Cardio — contexte du projet

Le projet s'appelle **Pause Cardio**, descriptif : *« Chaque semaine, l'essentiel des publications qui
comptent en cardiologie : essais pivots, recommandations et grandes méta-analyses. »* (« résumés en
français » retiré le 01/09/2026 ; nom choisi le 23/08/2026 ; le dépôt et l'URL gardent pour l'instant l'ancien nom `veille-cardio`, un nom
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

Structure : sections par **surspécialité** — **rangées automatiquement par le script de la plus fournie à
la moins fournie** sur l'année cochée (compte des cartes, ordre stable en cas d'égalité, décision du
03/09/2026 : l'ordre des sections dans le HTML n'a plus d'importance) → sous-groupes par **année** (année en cours d'abord, puis N−1)
→ articles triés par **date de parution, les derniers parus en tête** (décision du 29/08/2026) : insérer
toute nouvelle carte en haut de son année, et lire la date dans la ligne `.meta` (jour facultatif, mois en
toutes lettres, année). Les cartes sans mois lisible restent en fin d'année. Chaque surspécialité est un **tiroir replié** : au chargement,
la page n'affiche que la liste des neuf titres avec leur nombre de sorties ; un clic sur un titre ouvre
ses articles (années comprises), un second le referme, et **un seul tiroir est ouvert à la fois** —
en ouvrir un referme le précédent (décision du 31/08/2026). Même exclusivité pour les fiches : déplier
un article referme celui qui était déplié.

- Surspécialités (`data-spec`) : `rythmo` (Rythmologie), `interv` (Interventionnel & structurel),
  `imagerie` (Imagerie cardiaque — coroscanner, IRM cardiaque, échocardiographie et ETT de stress),
  `ic` (Insuffisance cardiaque), `usic` (USIC · Réanimation cardiologique — arrêt cardiaque, choc
  cardiogénique, assistance circulatoire, soins critiques), `cmh` (Cardiomyopathies & myocardites),
  `prev` (Prévention), `sport` (Cardiologie du sport · CFX/VO₂ max), `onco` (Onco-cardiologie — cardiotoxicité
  des traitements, myocardites sous immunothérapie, thrombose et cancer, survivants, ajoutée le 03/09/2026).
  En créer une nouvelle si besoin (valvulopathies, SCA)
  avec sa couleur (`--series-N`), sa section **et son entrée dans la table `SPECS` du script en bas de
  page** ainsi que dans `outils/bulletin.mjs`.
- Il ne reste **que deux filtres** : les années et la recherche. Les puces de surspécialité et de niveau
  ont été retirées le 24/08/2026 — le sommaire replié fait le tri, et le niveau se lit sur chaque ligne.
  Ne pas les réintroduire sans demande explicite.
- Années : deux puces — **seule l'année en cours est cochée par défaut** (décision du 29/08/2026),
  le lecteur coche 2025 s'il veut l'an dernier (ce ne sont pas des boutons exclusifs). Si les deux sont décochées, la page affiche le
  message « Aucune année sélectionnée ». Les puces et les en-têtes d'année ne portent que le millésime
  (pas de mention « en cours »). **Depuis le 08/09/2026 les deux puces sont fabriquées par le script à
  partir de la date du jour** (année en cours, année précédente ; constantes `ANNEE` et `ANNEES`), et
  les cartes plus anciennes que l'an dernier sont **retirées de la page au chargement**, purement et
  simplement (compteurs, bandeau et favoris compris). Au changement d'année il n'y a donc rien à
  modifier dans le HTML : le premier samedi de janvier, la routine retire seulement les vieux groupes
  d'année du HTML pour alléger la page (ligne `A_FAIRE` de `congres.mjs`) et crée le groupe de la
  nouvelle année dans une surspécialité au moment d'y insérer sa première carte.
- Niveaux (`data-lvl`) : `crit` / `warn` / `watch`. Depuis le 29/08/2026 ils **ne s'affichent plus sur la
  plateforme** (badges masqués en CSS) mais restent obligatoires sur chaque carte : le bulletin et le
  courriel s'en servent pour leur tri, et ils gardent le classement éditorial. La seule mise en avant
  visuelle est réservée aux **recommandations** : le script pose la classe `reco` (fond rosé) sur toute
  carte dont le `span.type` contient « Recommandation ». La pastille verte « nouveau » est conservée :
  depuis le 09/09/2026 elle marque les cartes du **dernier courriel envoyé** (`bulletin/semaine.json`),
  et non plus une fenêtre glissante de 7 jours (règle gardée en secours seulement).
- Chaque carte porte `data-kw` : mots-clés **bilingues FR + EN** avec acronymes (FA/AF, CMH/HCM, IC/HF…),
  qui alimentent la barre de recherche.

## Règles éditoriales (décidées avec Robin)

- **Charte de rédaction** (`outils/CHARTE-REDACTION.md`, adoptée le 05/09/2026) : tout texte français —
  accroche, résumé, résultat principal, fiche, « En pratique », courriel — doit se lire comme écrit
  directement en français par un médecin habitué à la synthèse scientifique. Pas de calque de
  l'anglais ni de style télégraphique, phrases complètes avec sujet, une idée par phrase, terminologie
  française usuelle, abréviations peu courantes développées, degré d'affirmation calé sur le niveau de
  preuve, distinction association/causalité, critère principal/secondaire, relatif/absolu. Le résumé
  français existant n'est pas une référence : on vérifie sur le résumé PubMed. Toute nouvelle carte
  suit `outils/BRIEF-CARTE.md` (format) et la charte (fond), puis passe par une **relecture de
  fidélité distincte** avant publication. Les révisions gardent l'ancienne version et un journal dans
  `revision/AAAA-MM-JJ/`.

- **Titres des articles dans leur langue d'origine** (anglais si l'article est anglais).
  Tout le reste — résumés, fiches, interface — en français.
- Sélection stricte : essais randomisés pivots, recommandations, méta-analyses majeures. Pas de cohortes
  anecdotiques. Mieux vaut 5 sorties qui comptent que 20 sans intérêt.
- Chaque entrée a un **lien vers l'article original** (NEJM, PubMed, JAMA, EHJ…) et, si possible, un lien
  d'analyse (TCTMD, ACC.org, Cardio-online).
- Fiche de lecture sur **chaque carte, tous niveaux confondus** (décision du 30/08/2026) : question
  clinique → méthode → résultats chiffrés (HR, IC95 %, NNT) → limites → **« En pratique »** (ce que ça
  change au quotidien), suivie de la
  mention « Résumé à valider par le lecteur avant application clinique — se reporter à l'article
  original en lien » (depuis le 29/08/2026, aucune mention d'auteur dans les fiches ni les bulletins).
- Ne jamais inventer un chiffre, un titre ou un lien : vérifier par recherche web, sinon omettre.
- **Aucune référence géographique ou personnelle** dans les résumés et fiches (pas de « en Aveyron »,
  « à Rodez », « notre centre ») : le contenu doit servir n'importe quel cardiologue francophone.
- **Grands congrès** (ESC, ACC, AHA…) : couverture **exhaustive des recommandations et documents de
  consensus** présentés — les vérifier une à une sur PubMed et le site du congrès, aucune ne doit
  manquer. Les sorties de congrès restent en ligne **au moins trois mois** après la fin du congrès ;
  quand la publication définitive paraît, mettre la carte à jour plutôt que la retirer.

## Chaîne qualité — obligatoire pour tout texte diffusé (depuis le 06/09/2026)

Quatre pièces, toutes versionnées dans le dépôt, s'appliquent à **chaque nouvelle carte, chaque mise à
jour de carte et chaque courriel** ; la routine, les sous-agents et toute session qui touche au contenu
doivent les suivre, sans exception :

1. **`outils/CHARTE-REDACTION.md`** — le fond : ton de médecin francophone, langue, fidélité
   scientifique, rubrique « En pratique », méthode en deux passes.
2. **`outils/BRIEF-CARTE.md`** (nouvelle carte) et **`outils/BRIEF-REVISION.md`** (carte existante) — le
   format et la livraison ; le rédacteur part du résumé PubMed (`efetch`) et des pages ouvertes, jamais
   de mémoire.
3. **`outils/BRIEF-CONTROLE.md`** — la relecture de fidélité par un **agent distinct du rédacteur** :
   chiffres, groupes, critères, degré de certitude, cohérence accroche/résumé/résultat principal/fiche.
   Aucune carte n'est insérée dans `index.html` sans cette relecture.
4. **`node outils/controle-cartes.mjs`** — le contrôle automatique, à lancer après toute modification :
   structure, accroche, date de parution, typographie française, formules interdites (« vs », « Au
   cabinet », mention d'auteur ou d'IA, référence géographique, effets journalistiques), cohérence des
   chiffres entre les présentations ; avec `--sources`, fidélité des chiffres au résumé PubMed. Par
   défaut il contrôle les cartes ajoutées ou parues depuis 8 jours ; `--tout` couvre le site. Avec
   `--strict`, une ERREUR bloque. **`outils/faire-bulletin.sh` l'exécute en mode strict avant tout
   bulletin, et le workflow `bulletin-inscrits.yml` avant tout envoi Brevo : un courriel ne part pas
   tant qu'une carte de la semaine est en ERREUR.** Les AVERTISSEMENTS ne bloquent pas mais doivent
   être traités par la routine quand ils concernent une carte de la semaine.

Révision par lots (plusieurs cartes anciennes) : `outils/revision/extraire.py` inventorie et conserve
les versions en cours dans `revision/AAAA-MM-JJ/avant/`, les lots passent par BRIEF-REVISION puis
BRIEF-CONTROLE, et `outils/revision/appliquer.py` applique les textes validés avec le garde-fou sur les
chiffres et écrit `revision/AAAA-MM-JJ/journal.md` (corrections sourcées, passages à vérifier).
Première application : révision complète des 153 cartes le 05/09/2026.

## Présentation (ne pas casser)

La page affiche chaque article sur **une ligne repliée** : titre d'origine, accroche française en dessous,
puis une ligne de repère *revue · date · type d'étude*. Un clic déplie la fiche complète, un second replie
(le dépliage est animé). **Cette mise en forme est construite automatiquement par le script en bas de
`index.html`** à partir du HTML des cartes : écris donc les cartes au format long habituel
(`<article class="card">` avec `.top`, `<h3>`, `.meta`, `.sum`, `.actions`, `.fiche`) et l'accordéon se
fabrique tout seul. Ne pas écrire de cartes « déjà compactes ».

Trois attributs et un bloc à renseigner **sur chaque nouvelle carte** :

- `data-ajout="AAAA-MM-JJ"` — **obligatoire** : date d'ajout, gardée pour la traçabilité des lots.
  Depuis le 01/09/2026 elle ne pilote plus l'affichage : la pastille verte « nouveau » et le bandeau
  « Cette semaine » sont déclenchés par la **date de parution** lue dans la ligne `.meta`
  (« *Revue* · 5 août 2026 · … »), pendant 7 jours après parution — un article repris tardivement
  n'est donc plus marqué « nouveau » à tort. Le **jour** doit figurer dans `.meta` pour qu'une carte
  soit signalée (sans jour, pas de pastille) : toujours l'écrire pour les sorties de la semaine.
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
- Le bloc `.verdict` (« En pratique ») reste écrit à sa place habituelle dans la fiche : **le script le
  remonte tout seul** juste sous le résumé, avec un libellé en capitales. Ne pas le déplacer à la main.

Autres règles de mise en page :

- En-tête (`header.site-head`) : **rien au-dessus du logo**, et tout est **centré**. Dans l'ordre — le nom
  **PAUSE CARDIO** (`h1.brand-name`) au milieu, avec la marque ECG (`svg.brand-mark`) à sa droite sur
  ordinateur et **sous le nom sur téléphone** (moins de 560 px) ; la ligne discrète `.eyebrow` (nombre de
  sorties + date de mise à jour — **recalculés automatiquement** par le script depuis les cartes :
  compte des `article.card`, date du `data-ajout` le plus récent ; ne plus les écrire à la main, le
  `span#maj-ligne` n'est qu'un texte de secours) ; le liséré rouge `.brand-rule` ; puis la
  seule ligne de descriptif (la même phrase que sur l'écran d'ouverture). Pas de tuiles de statistiques.
- Sous le descriptif viennent **l'encart d'inscription replié**, la ligne repliée **« Ajouter l'appli
  Pause Cardio »**, puis le bandeau **« Cette semaine »**. **Depuis le 09/09/2026 il rappelle exactement
  la liste du dernier courriel envoyé** : `outils/bulletin.mjs` écrit `bulletin/semaine.json` (sujet,
  lundi de la semaine, ancres des articles dans l'ordre du courriel) chaque fois qu'un courriel part
  (`--rappel` le samedi, `--congres` pour un récapitulatif ; jamais les matins de congrès), et le
  script de la page le lit. Le bandeau change donc le samedi, après la routine, et reste identique
  toute la semaine — **pas de semaine glissante**. Titre « Cette semaine · 35 sorties · semaine du
  lundi 31 août », « Semaine calme · rappel · … » ou « Récapitulatif ESC 2026 · … ». La **pastille
  verte « nouveau » suit la même liste**. En secours seulement (page ouverte en local, fichier
  illisible), la règle précédente reste : cartes parues depuis moins de 7 jours d'après la ligne `.meta`.
  `node outils/bulletin.mjs --semaine-seule` réécrit le fichier depuis la mémoire du dernier lot.
  Le bandeau est **replié par défaut**, une seule ligne avec un chevron ; un clic déplie la liste, un
  second la replie. Les lignes dépliées sont cliquables : elles ouvrent le tiroir de l'article et le
  déplient. **Puis** les filtres — années et recherche. Rien d'autre, et pas de tuiles de statistiques.
- **Encart d'inscription au bulletin** : construit par le script, en deux exemplaires bâtis par la même
  fonction — une ligne repliée « ✉ Recevoir par mail chaque semaine les dernières sorties, c'est ici. »
  (libellé arrêté le 01/09/2026) sous le bandeau « Cette semaine », et la version
  dépliée `.abo.plein` juste avant le pied de page. Trois règles : l'adresse du formulaire Brevo se met
  **uniquement** dans la constante `ABO_FORM` en bas du script ; **tant qu'elle est vide, l'encart n'est
  pas affiché du tout** (pas de champ qui ne mène nulle part) ; l'envoi vise une fenêtre invisible
  (`iframe[name=pc-abo-cadre]`) pour que le lecteur ne quitte pas la page. On ne peut donc pas lire le
  verdict de Brevo : c'est le mail de confirmation (double opt-in) qui fait foi, et le message affiché
  le dit ainsi. Ne pas retirer la case à cocher de consentement ni la mention sur l'usage de l'adresse.
- **Encart « Ajouter l'appli Pause Cardio »** (`section.instal`, ajouté le 03/09/2026, simplifié le même
  jour) : construit par le script (bloc « installation sur l'écran d'accueil » en bas de page), en deux
  exemplaires comme l'inscription — une ligne repliée « 📱 Ajouter l'appli Pause Cardio » **juste sous
  l'encart d'inscription replié**, et la version dépliée `.instal.plein` après l'inscription dépliée,
  avant « Rythme de mise à jour ». Pas de paragraphe d'introduction : le contenu commence par les deux
  onglets « iPhone · iPad » / « Android », l'appareil détecté étant présélectionné. Sur iPhone : les trois
  étapes « ⋯ » (à droite de la barre d'adresse, depuis iOS 26) → Partager → « Sur l'écran d'accueil » →
  « Ajouter », et rien d'autre — Apple n'autorise aucun
  site à déclencher l'installation, et la feuille de partage ouverte par `navigator.share` **ne contient
  pas** « Sur l'écran d'accueil » (bouton essayé puis retiré le 03/09/2026 : ne pas le remettre). Sur Android : quand Chrome propose l'installation
  (`beforeinstallprompt`), **un appui sur la ligne repliée lance directement la fenêtre d'installation**,
  sans rien déplier ; sinon la ligne se déplie sur le bouton « Installer Pause Cardio » (caché tant que
  Chrome ne le permet pas) et les étapes menu ⋮ → « Ajouter à l'écran d'accueil ». Trois règles :
  **il n'est jamais affiché quand la page est déjà ouverte depuis l'icône** (mode `standalone`), il
  reste en teinte neutre (pas le rosé de marque, réservé à l'inscription et aux recommandations), et
  il disparaît pendant une recherche comme les autres encarts.
- **Encart « Radar — les prochaines semaines »** (design « fil chronologique » choisi le 02/09/2026) :
  en bas de page, **une seule carte**, une liste `ol#radar-fil` où chaque `<li>` porte l'échéance
  (`<span class="q">`) puis le libellé (`<span class="t">`, nom en `<b>`). Deux sortes de lignes :
  - `class="pub"` (point bleu) : **publications attendues** — essais présentés en attente de parution,
    recommandations annoncées. **C'est la seule partie que la routine entretient**, à chaque veille
    du samedi et au lendemain de chaque congrès : retirer ce qui est paru, ajouter ce qui s'annonce,
    dates vérifiées par recherche web, jamais inventées.
  - congrès (point rouge = niveau 1, gris = niveau 2) : **ajoutés automatiquement par le script** depuis
    `outils/congres.json` (les 4 prochains dans les 150 jours, « En cours » pendant le congrès,
    « à confirmer » si la date n'est pas confirmée). Ne jamais écrire de congrès à la main : pour
    en changer, corriger le calendrier. Les `<li class="secours">` ne servent que si le calendrier
    est illisible (retirés sinon) — les tenir à jour à l'occasion, sans plus.
  Ne pas y remettre de deuxième carte « publié à … » : ce qui est paru va dans les sections.
- **Encart « Rythme de mise à jour »** (`section.rythme`, ajouté le 01/09/2026) : juste avant le pied
  de page, après l'encart d'inscription déplié. Texte fixe et discret qui explique le fonctionnement :
  samedi matin (veille + bulletin 8 h, même semaine calme), mise à jour quotidienne pendant ESC, ACC
  et AHA avec récapitulatif le lendemain de la clôture, autres congrès repris le samedi. À modifier
  seulement si le rythme change.
- **Couleurs** : la surspécialité ne sert plus que de fin liséré à gauche de la carte (et de couleur du
  libellé « En pratique ») ; le fond légèrement rosé est réservé aux cartes `reco` (recommandations).
  Ne pas remettre de grosse pastille de couleur ni de badge de niveau par article.
- **Favoris et articles lus** (ajoutés le 06/09/2026) : construits par le script, mémorisés **sur
  l'appareil seulement** (`localStorage`, clés `pc-favoris` et `pc-lus`, listes d'ancres de cartes — la
  même ancre que les liens du bulletin, donc stable). Une étoile (`button.fav-btn`, hors du bouton de
  ligne) à droite de chaque ligne, précédée d'une **coche « lu »** (`button.lu-chk`, cercle vide puis plein) :
  c'est le lecteur qui décide, **déplier une fiche ne marque rien** (décision du 06/09/2026) ; la carte
  cochée passe en `lu` (titre et accroche grisés), un second appui l'annule. **Trois listes exclusives**
  (décision du 06/09/2026) : la liste principale ne montre que les articles **ni lus ni favoris** — cocher ou
  étoiler un article le fait quitter la liste aussitôt ; les puces « ★ Mes favoris · N » et « ✓ Lus · N »
  de la rangée « Lecture » affichent chacune les leurs, **toutes surspécialités et années confondues**,
  tiroirs ouverts, encarts masqués comme lors d'une recherche (`state.vue` : `tout` / `favoris` / `lus`,
  `choisirVue()`). Un lien direct vers une carte (bulletin, bandeau) bascule sur la liste qui la contient.
  Pas de recherche dédiée aux favoris. Rien ne quitte l'appareil, aucun compte.
- **Bouton « Partager »** (ajouté le 08/09/2026) : posé par le script en fin de rangée `.actions` de
  chaque fiche, jamais écrit dans le HTML des cartes. Sur téléphone il ouvre la feuille de partage du
  système (WhatsApp, SMS, mail) avec le titre d'origine, l'accroche française et le lien direct
  `https://pausecardio.fr/#ancre` (constante `SITE_URL` du script, la même adresse que dans les
  courriels) ; ailleurs il copie le lien et affiche « Lien copié » (`#toast`).
- **Tiroirs de surspécialité** : la tête de section (`.spec-h`) est cliquable (chevron à droite, `role`
  et `aria-expanded` posés par le script) ; l'état ouvert est porté par `section.spec.ouvert` et par
  l'ensemble `ouverts` du script. Trois règles à ne pas casser : les tiroirs ouverts sont **mémorisés
  d'une visite à l'autre** (`localStorage`, clé `pc-ouverts` — un seul désormais) et rouvert au
  chargement, une
  **recherche ouvre tout** — sinon le lecteur ne verrait pas ses propres résultats —, et le compteur de
  la tête (`.count`) est recalculé à chaque filtrage, il ne doit plus être écrit en dur dans le HTML.
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

**Icône d'application** (choisie le 26/08/2026) : fond encre `#141412`, tracé ECG crème et deux barreaux
rouges `#e2564f` — c'est le logo réduit à ce qui reste lisible à 60 px. Les fichiers sont dans `icone/`
et se refabriquent depuis `icone/icone.svg` (version aux coins arrondis, pour le favicon) :
`pausecardio-apple.png` est **pleine page, sans coins arrondis** — iOS applique son propre masque —,
tandis que `pausecardio-512.png` est l'icône *maskable* Android, dont le dessin est réduit à 74 % pour
rester dans la zone que le système peut rogner. **Toujours produire ces PNG en 512 × 512** : Chromium
sans interface impose une hauteur de fenêtre minimale, si bien qu'une capture demandée en 180 ou 192 px
sort comprimée vers le haut, moitié basse vide. Le vérifier avec `outils/png.py` avant de publier ; pour obtenir une taille plus petite sans le défaut, rendre dans une fenêtre de 360 px avec `--force-device-scale-factor=0.5`. iOS réclame un `apple-touch-icon` de **180 × 180** et va le chercher aussi à la racine : garder `apple-touch-icon.png` et `apple-touch-icon-precomposed.png` à côté d'`index.html`, sans quoi le raccourci d'écran d'accueil affiche la vignette de secours d'iOS (fond noir, lettre blanche). `manifest.webmanifest` à la racine donne le nom
« Pause Cardio » à l'icône posée sur l'écran d'accueil. Ne pas mettre l'icône arrondie dans
l'`apple-touch-icon` : les coins apparaîtraient deux fois.

## Méthode de veille — ne rien laisser passer

La sélection ne part **jamais de la mémoire** : elle part d'une récolte systématique. Avant toute mise
à jour d'`index.html` :

1. `node outils/moisson.mjs` (options : `--jours=N`, `--depuis=AAAA-MM-JJ`, `--spec=rythmo`, `--tout`
   pour voir aussi ce qui est déjà en ligne, `--brut` pour ne rien filtrer). Le script interroge PubMed
   surspécialité par surspécialité — d'abord les dix grandes revues tous types confondus, puis les revues
   de surspécialité pour les seuls essais randomisés, recommandations et méta-analyses — et marque d'un
   `★` ce qui relève de ces trois catégories. Il signale ce qui est déjà sur le site (comparaison sur le
   titre, préfixe compris, pour rattraper les recommandations à sous-titre à rallonge).
2. **Passer en revue chaque ligne `NOUVEAU`**, pas seulement les `★`. Un article écarté doit l'être en
   connaissance de cause, pas par omission.
3. Compléter par ce que PubMed ne voit pas encore : Hot Lines de congrès (ESC, ACC, AHA, TCT, EuroPCR,
   HFA, HRS, EHRA), communiqués topline, relais TCTMD / ACC.org / Cardio-online.
4. Dire dans le compte rendu combien de candidats ont été examinés et combien retenus.

Règles de classement qui évitent les oublis constatés :

- Un **suivi à long terme d'un essai pivot** (5 ans, 10 ans, extension ouverte) n'est jamais « veille » :
  au minimum « à connaître ». Exemple : HOST-EXAM à 10 ans, d'abord classé « veille » à tort en 2026.
- Un **essai négatif** sur un traitement en vogue vaut un essai positif : c'est ce qui évite de prescrire.
- Une **méta-analyse sur données individuelles** dans une grande revue est au moins « à connaître ».
- Dans le doute entre deux niveaux, prendre le plus haut : mieux vaut une ligne de trop qu'une sortie
  qui échappe au lecteur.

## Mise à jour

- Automatique : la **routine Claude Code « Veille cardio »** s'exécute **tous les jours à 05:00 UTC**
  (elle ne fixe pas de modèle : elle tourne avec celui de la session liée). **Depuis le 05/09/2026 elle tourne dans une session persistante qui a le dépôt
  attaché et `main` comme branche de sortie** (session « Veille cardio — session de la routine
  quotidienne ») : la routine créée le 29/08 n'avait aucun dépôt attaché et n'a jamais pu pousser —
  d'où le samedi 05/09 sans courriel. Si on recrée la routine, il faut la lier à une session qui
  possède le dépôt (source) et `main` (outcome), sinon elle « réussit » sans rien publier. Son
  premier geste est `git reset --hard origin/main`, son dernier une vérification que le commit est
  bien sur `origin/main`. Elle commence par `node outils/congres.mjs`, qui lit le **calendrier des
  congrès** `outils/congres.json` et lui donne son mode du jour, sans interprétation (rythme
  définitif arrêté le 01/09/2026) :
  - `MODE SAMEDI` → veille hebdomadaire complète, mise à jour du site et du Radar, puis
    `bash outils/faire-bulletin.sh --rappel` : **le courriel du samedi part toutes les semaines sans
    exception**, à 08:00. S'il y a du nouveau, c'est « Les sorties de la semaine du lundi … » ; s'il
    n'y a rien, c'est « Semaine calme — rappel des sorties de la semaine du lundi … », même gabarit,
    qui dit proprement qu'aucune sortie d'ampleur n'est parue et rappelle les sorties du dernier
    bulletin (mémorisées dans `bulletin/etat.json`, clé `dernier_lot`).
  - `MODE CONGRES_EN_COURS` (congrès de **niveau 1** : ESC, ACC, AHA) → mise à jour quotidienne du
    site avec les Hot Lines, **sans courriel** (supprimer `bulletin/courriel-AAAA-MM-JJ.html` avant
    le commit). Si ce jour est un samedi (`SAMEDI_DANS_CONGRES`), **pas de courriel hebdomadaire**
    non plus : le récapitulatif le remplace.
  - `MODE CLOTURE_HIER` → veille complète du congrès, Radar remis à jour, puis
    `bash outils/faire-bulletin.sh --congres="ESC 2026"` : courriel « Récapitulatif des sorties du
    congrès "…" », envoyé à **07:50**.
  - `MODE RIEN` → elle termine sans rien modifier.
  - Les congrès de **niveau 2** (TCT, EuroPCR, HRS, EHRA, HFA, sessions de cardiologie du sport)
    n'ont pas de mode propre : leurs sorties sont reprises par la veille du samedi.
- **Deux commits, pas un** (décision du 08/09/2026), dans tout mode qui publie : d'abord le site
  (`index.html`, `fiche/`, `sitemap.xml`, `outils/congres.json`, `journal/`), poussé aussitôt ; puis le
  bulletin (`bulletin/`), poussé à son tour. Si la fabrication du bulletin échoue, le site est déjà en ligne.
- **Journal de veille** (`journal/AAAA-MM-JJ.md`, depuis le 08/09/2026) : chaque jour qui modifie le
  site, la routine écrit ce qu'elle a examiné, retenu et écarté, avec le motif. `node outils/moisson.mjs
  --json=F` puis `node outils/journal.mjs --squelette --moisson=F` dressent la liste des candidats ;
  la routine remplit Verdict et Motif de chaque ligne ; `node outils/journal.mjs --cloture` ajoute
  les cartes du jour, le bilan du contrôle qualité et les fichiers du bulletin, et **refuse tant qu'un
  candidat n'a pas de verdict**. Le journal part dans le premier commit. Le dépôt étant public, il ne
  contient que des titres, des liens PubMed et des décisions éditoriales. Voir `journal/README.md`.
- **Publications définitives et publications attendues** : en fin de rapport, `moisson.mjs` rapproche
  les sorties PubMed des cartes présentées en congrès qui n'ont pas encore de lien vers l'article
  (`DEFINITIF?`, avec une recherche ciblée par sigle d'essai, hors fenêtre de dates) et des lignes
  « publications attendues » du Radar (`RADAR?`). Une ligne `DEFINITIF?` se traite en **mettant la
  carte à jour** (`outils/BRIEF-REVISION.md`, chaîne qualité), jamais en créant une seconde carte ;
  une ligne `RADAR?` retire l'attente du Radar et traite l'article comme candidat.
- **Une page par article pour les moteurs de recherche** (`fiche/<ancre>/index.html`, depuis le
  08/09/2026) : `node outils/pages-articles.mjs` fabrique, à partir des cartes d'`index.html`, une page
  statique par article (titre d'origine, accroche, résumé, résultat principal, « En pratique », fiche
  complète, liens ; description, canonical, Open Graph et JSON-LD pour Google) et tient le bloc
  `<!--FICHES:DEBUT-->…<!--FICHES:FIN-->` de `sitemap.xml`. Ces pages ne servent qu'à être trouvées :
  chacune renvoie vers le site principal, à la carte (`https://pausecardio.fr/#ancre`), et **le bouton
  « Partager » du site continue de pointer vers le site principal, pas vers la page par article**
  (décision du 08/09/2026). L'ancre est la même que celle du script d'`index.html` et de
  `outils/bulletin.mjs` : trois endroits à ne jamais changer isolément. **La routine lance le script
  après toute modification d'`index.html`, avant son premier commit** (`fiche/` et `sitemap.xml`
  partent avec le site) ; le workflow `.github/workflows/fiches.yml` rattrape un oubli en régénérant et
  poussant lui-même. Rien ne change sur la page principale. `--verifier` dit si `fiche/` est à jour.
- **Chien de garde** (`.github/workflows/chien-de-garde.yml`, `outils/chien-de-garde.mjs`, depuis le
  08/09/2026) : indépendant de la routine, il vérifie chaque matin à 08:00 UTC que ce qui devait être
  publié l'a été — le courriel du samedi ou du congrès sur `main`, un commit du jour pendant un
  congrès. Sinon, e-mail d'alerte au propriétaire (secrets Gmail du bulletin) et échec du workflow,
  notifié par GitHub. C'est ce qui aurait signalé le samedi 05/09 sans courriel.
- **Contrôle mensuel des liens** (`.github/workflows/controle-liens.yml`, `outils/controle-liens.mjs`) :
  le 1er du mois, chaque lien des cartes et du Radar est sondé ; les liens morts (404, 410, domaine
  disparu) ouvrent une issue GitHub « Liens morts » avec la liste. Les refus d'éditeurs (403, 429)
  sont classés « incertains » et n'ouvrent rien. Corriger un lien mort = remplacer l'adresse dans la
  carte, sans toucher au texte.
- **Entretien du calendrier, pour que ça roule d'une année sur l'autre** : `congres.mjs` imprime des
  lignes `A_VERIFIER` — dates inconnues, dates non confirmées, ou édition suivante à chercher quand la
  dernière édition connue d'une famille est passée, et revérification générale le premier samedi de
  janvier. La routine traite chaque ligne le jour même : elle cherche les dates **sur le site officiel
  du congrès** (champ `source`), les inscrit dans `outils/congres.json` avec `"confirme": true`, et
  laisse `null` ce qu'elle ne trouve pas — jamais une date inventée. **Quand elle ne trouve rien, elle
  écrit `"prochaine_verification": "AAAA-MM-JJ"` (aujourd'hui + 14 jours) sur l'entrée** : jusqu'à
  cette date la ligne sort en `REPORTE` et n'est pas à retraiter (depuis le 08/09/2026, pour ne pas
  refaire la même recherche tous les matins). Le champ se retire quand les dates sont confirmées.
- **Contexte de congrès sur les cartes** : quand une sortie est ajoutée pendant ou pour un congrès,
  la ligne `.meta` se termine par le sigle du congrès — « <b>NEJM</b> · 28 août 2026 · Essai
  randomisé · **ESC 2026** » — pour la distinguer des sorties ordinaires.
- **Horaires d'envoi** (`outils/envoyer-courriel.mjs`) : bulletin du samedi à **08:00**, récapitulatif
  de congrès à **07:50**, heure de Paris ; la campagne Brevo est programmée quand le courriel est
  poussé avant l'heure, envoyée immédiatement sinon (tests à la main).
- **Une fois `index.html` à jour, toujours lancer `bash outils/faire-bulletin.sh`** (voir la section
  suivante) : c'est ce qui fabrique le bulletin PDF de la semaine.
- **Avant** d'écrire quoi que ce soit : `node outils/moisson.mjs` (voir la section précédente).
- Après modification : commit + push sur `main` (index.html **et** le dossier `bulletin/`).
  GitHub Pages republie tout seul en 1–2 minutes. Les dates `lastmod` de `sitemap.xml` sont
  entretenues automatiquement par `outils/bulletin.mjs` à chaque bulletin produit.
- Toujours vérifier avant de pousser : HTML valide, liens qui fonctionnent, filtres et recherche opérants.

## Bulletin PDF hebdomadaire

Après chaque mise à jour, un **bulletin d'une à trois pages** récapitule uniquement ce qui vient d'être
ajouté — de quoi être lu en deux minutes ou transféré aux 10 cardiologues du groupe.

- Une seule commande, à lancer depuis la racine du dépôt : `bash outils/faire-bulletin.sh`
- La même commande écrit aussi **`bulletin/courriel-AAAA-MM-JJ.html`** : le bulletin en version
  e-mail (tableaux, styles en ligne), où chaque titre renvoie vers sa fiche sur
  `https://pausecardio.fr/#ancre-de-l-article`. C'est **la voie principale d'envoi** : le workflow
  `.github/workflows/bulletin-inscrits.yml` l'expédie à la liste Brevo n° 3 (« Bulletin Pause
  Cardio ») dès qu'il arrive sur `main`, via `outils/envoyer-courriel.mjs`. Il faut pour cela le
  secret `BREVO_CLE_API` (Settings → Secrets → Actions) ; sans lui l'envoi est ignoré sans erreur.
  Le pied du courriel doit garder le lien `{{ unsubscribe }}`, que Brevo remplace chez chaque
  destinataire. `--apercu` produit aussi `courriel-apercu.html`, jamais envoyé.
- **Gabarit du courriel** (refondu le 01/09/2026) : sujet et en-tête « Les sorties de la semaine du
  lundi … » (le lundi de la semaine couverte), articles **rangés par surspécialité** comme sur la
  plateforme — en-tête au nom de la surspécialité dans sa couleur, puis ses articles dans l'ordre de
  la page — **sans aucun badge de niveau** : chaque bloc commence directement par le titre (accroche,
  repère revue · date, « Résultat principal », lien « Lire la fiche » dessous ; fond rosé conservé
  pour les recommandations). Avec `--congres="…"`, le sujet devient « Récapitulatif des sorties du
  congrès "…" ». Ne pas réintroduire les badges de niveau dans le courriel.
- **Ancres des articles** : le script d'`index.html` donne à chaque carte un `id` tiré de son titre
  (minuscules sans accents, tirets, 64 caractères max, suffixe `-2` en cas de doublon) et ouvre
  tiroir + fiche à l'arrivée sur `#ancre`. La **même règle vit dans `outils/bulletin.mjs`**
  (fonction `poserAncres`) : ne jamais changer l'une sans l'autre, les liens des bulletins déjà
  envoyés en dépendent.
- Elle compare les articles de `index.html` à ceux déjà signalés (mémorisés dans `bulletin/etat.json`,
  la comparaison se fait sur le titre) et ne garde que ceux **parus dans les 7 derniers jours** (voir
  plus bas) :
  - **s'il y a du nouveau** → écrit `bulletin/bulletin-AAAA-MM-JJ.html`, l'imprime en PDF avec Chromium,
    met à jour la page d'archives `bulletin/index.html` et pose le lien « 📄 Bulletin du … » dans la ligne
    d'en-tête du tableau de bord ;
  - **s'il n'y a rien de neuf** → affiche `RIEN` et n'écrit rien… sauf avec `--rappel` (le samedi) :
    il écrit alors le courriel « Semaine calme » qui rappelle les sorties du dernier bulletin
    (`RAPPEL`), sans PDF ni entrée d'archives.
- Contenu d'une entrée du PDF : surspécialité, niveau, type d'étude, titre (cliquable vers l'article
  original), journal et date, résumé, et l'encadré **« En pratique »** repris de la fiche de lecture.
  Ordre : crit → warn → watch. Le pied de page — du PDF comme du courriel — porte la mention
  « **Fiches rédigées à l'aide de l'IA** — résumés à valider par le lecteur avant toute application
  clinique » (jamais « rédigées par Claude », décision du 01/09/2026).
- Le PDF est publié avec le site : `https://hacuubo.github.io/veille-cardio/bulletin/` liste tous les
  bulletins, le plus récent en tête. `bulletin/exemple.pdf` sert d'aperçu avant le premier vrai bulletin.
- Les fichiers de `bulletin/` (PDF, `index.html`, `etat.json`) doivent être **commités** : c'est `etat.json`
  qui évite de re-signaler la semaine suivante les articles déjà annoncés.
- **Ce qui fait foi, c'est la date de parution dans la revue** (décision du 04/09/2026), lue dans la
  ligne `.meta` de la carte : le bulletin et le courriel ne signalent que les articles **inconnus et
  parus dans la semaine écoulée**, du samedi précédent (jour du dernier courriel) au samedi de la
  routine inclus (règle confirmée le 09/09/2026 ; le script imprime la ligne `FENETRE`). Tout article
  déjà annoncé par un courriel précédent est retiré, même s'il tombe dans la fenêtre. Un article ajouté après coup — rattrapage
  d'une année, nouvelle surspécialité, reprise tardive — est **mémorisé sans être annoncé** (ligne
  `HORS_SEMAINE` dans la sortie du script) : s'il n'y a que cela, la semaine reste « calme ». Une carte
  sans jour dans `.meta` est écartée de la même façon : toujours écrire le jour pour une sortie de la
  semaine. Exemple : les 16 cartes d'onco-cardiologie (dernière parution le 8 août 2026) ajoutées le
  03/09 ne sont pas parties dans le courriel du samedi 05/09.
- Autres commandes utiles : `node outils/bulletin.mjs --init` (remémorise tous les articles actuels sans
  produire de bulletin — à ne relancer qu'en cas de remise à zéro), `bash outils/faire-bulletin.sh --apercu`
  (bulletin d'essai à partir des 5 dernières sorties 2026, ne touche à rien d'autre),
  `--date=AAAA-MM-JJ` pour forcer la date du bulletin, `--congres="ESC 2026"` pour le titre
  récapitulatif de congrès, `--rappel` pour le courriel « Semaine calme » quand rien n'est neuf
  (`--apercu --rappel` pour en voir un exemple).
- Les repères `<!--BULLETIN:DEBUT-->` / `<!--BULLETIN:FIN-->` d'`index.html` restent en place mais
  **vides** : depuis le 29/08/2026 le tableau de bord n'affiche plus de lien vers le PDF ni vers les
  archives (le bulletin part par courriel ; `/bulletin/` reste accessible par adresse directe).
  Ne pas les retirer, `outils/bulletin.mjs` s'en sert toujours.

## Fréquentation du site

Compteur **GoatCounter** (posé le 04/09/2026) : une balise `<script data-goatcounter=…>` juste avant
`</body>` dans `index.html` et dans la page d'archives `bulletin/index.html` (gabarit dans
`outils/bulletin.mjs`, fonction `rendreArchives`, pour qu'elle survive à chaque régénération). Sans
cookie ni bandeau de consentement. Tableau de bord : https://pausecardio.goatcounter.com (compte de
Robin). Ne pas ajouter d'autre outil de mesure sans demande explicite.

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
ACC.org journal scans. Congrès (calendrier tenu dans `outils/congres.json`, deux niveaux — 1 :
ESC, ACC, AHA avec couverture quotidienne et récapitulatif ; 2 : repris le samedi) : ESC, ACC, AHA, HRS, EHRA, TCT, EuroPCR, HFA, et pour le sport les
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
- 03/09/2026 — création de la surspécialité **Onco-cardiologie** (`onco`, couleur `--series-9`) : rattrapage
  2025–2026 sur les mêmes critères (essais pivots, recommandations HFA/AHA/ACC/ICOS, méta-analyses),
  moisson PubMed élargie aux revues d'oncologie (JACC CardioOncology, Lancet Oncology, JCO, JAMA Oncology,
  Annals of Oncology), prise en compte dans le bulletin et le courriel.
- 08/09/2026 — fiabilité et entretien : chien de garde quotidien, journal de veille dans `journal/`,
  deux commits le samedi, rapprochement des publications définitives et attendues dans la moisson,
  report des vérifications de calendrier, contrôle mensuel des liens, années calculées par le script
  (passage à 2027 sans intervention), bouton « Partager » sur chaque fiche, une page statique par
  article dans `fiche/` pour les moteurs de recherche.
- Autres projets de Robin sur ce compte GitHub : `site-cardios` (site vitrine du cabinet, déployé sur
  Netlify) et `planning-indispo` (application d'indisponibilités des cardiologues, également sur Netlify).
