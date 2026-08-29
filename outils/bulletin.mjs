#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — fabrique du bulletin hebdomadaire
 *
 * Compare les articles présents dans index.html à ceux déjà signalés la semaine
 * précédente (mémorisés dans bulletin/etat.json). S'il y a du nouveau, écrit un
 * bulletin HTML prêt à imprimer, met à jour la page d'archives et le lien qui
 * figure en tête du site.  S'il n'y a rien de neuf, ne produit aucun fichier.
 *
 * Usage :  node outils/bulletin.mjs [--date=AAAA-MM-JJ] [--init] [--apercu]
 *   --init    : mémorise les articles actuels sans produire de bulletin
 *               (à ne lancer qu'une fois, à la mise en place)
 *   --apercu  : produit un bulletin d'essai à partir des articles les plus
 *               récents, sans rien mémoriser ni modifier le site
 * --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE   = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE     = join(RACINE, 'index.html');
const DOSSIER  = join(RACINE, 'bulletin');
const ETAT     = join(DOSSIER, 'etat.json');

const args    = process.argv.slice(2);
const opt     = n => args.includes('--' + n);
const valeur  = n => (args.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1] || '';

/* ---------------------------------------------------------------- utilitaires */

const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août',
              'septembre','octobre','novembre','décembre'];

function aujourdhui() {
  const f = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date());                       // AAAA-MM-JJ
}
function enFrancais(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  return `${j} ${MOIS[m - 1]} ${a}`;
}
function enFrancaisCourt(iso) {
  const [, m, j] = iso.split('-').map(Number);
  return `${j} ${MOIS[m - 1]}`;
}
/** texte brut, sans balises ni entités — sert de clé de comparaison */
function brut(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&rsquo;|&#8217;/g, '’')
    .replace(/&[a-zA-Z]+;/g, m => ENTITES[m] ?? ' ')
    .replace(/\s+/g, ' ').trim();
}
const ENTITES = {
  '&eacute;':'é','&egrave;':'è','&ecirc;':'ê','&agrave;':'à','&acirc;':'â','&ccedil;':'ç',
  '&ugrave;':'ù','&ucirc;':'û','&icirc;':'î','&iuml;':'ï','&ouml;':'ö','&ocirc;':'ô',
  '&laquo;':'«','&raquo;':'»','&middot;':'·','&hellip;':'…','&mdash;':'—','&ndash;':'–',
};
/** clé stable d'un article : son titre, sans accents ni ponctuation */
function cle(titreHtml) {
  return brut(titreHtml).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/* ------------------------------------------------------- lecture des articles */

const SPECS = {
  rythmo: { nom: 'Rythmologie',                       couleur: '#2a78d6' },
  interv: { nom: 'Interventionnel & structurel',      couleur: '#eb6834' },
  ic:     { nom: 'Insuffisance cardiaque',            couleur: '#1baf7a' },
  usic:   { nom: 'USIC · Réanimation cardiologique',  couleur: '#a8348c' },
  cmh:    { nom: 'Cardiomyopathies & myocardites',    couleur: '#4a3aa7' },
  prev:   { nom: 'Prévention',                        couleur: '#e87ba4' },
  imagerie: { nom: 'Imagerie cardiaque',            couleur: '#0f95a8' },
  sport:  { nom: 'Cardiologie du sport · CFX/VO₂ max',couleur: '#eda100' },
};
const NIVEAUX = {
  crit:  { nom: 'Changement de pratique probable', court: 'Changement de pratique', couleur: '#d03b3b', rang: 0 },
  warn:  { nom: 'À connaître',                     court: 'À connaître',            couleur: '#c98500', rang: 1 },
  watch: { nom: 'Veille — à suivre',               court: 'Veille',                 couleur: '#898781', rang: 2 },
};

function lireArticles(html) {
  const articles = [];
  const re = /<article class="card[^"]*"([^>]*)>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, attrs, corps] = m;
    const attr  = n => (attrs.match(new RegExp(n + '="([^"]*)"')) || [])[1] || '';
    const bloc  = re2 => (corps.match(re2) || [])[1] || '';
    const titre = bloc(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    if (!titre) continue;
    const actions = bloc(/<div class="actions">([\s\S]*?)<\/div>/);
    const liens = [...actions.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map(([, href, texte]) => ({ href, texte: brut(texte).replace(/\s*↗\s*$/, '').replace(/\s*&#8599;\s*$/, '').trim() }));
    articles.push({
      cle:     cle(titre),
      accroche: attr('data-fr'),
      chiffre: bloc(/<div class="cle">([\s\S]*?)<\/div>/),
      spec:    attr('data-spec'),
      annee:   attr('data-year'),
      niveau:  attr('data-lvl') || 'watch',
      titre,
      type:    bloc(/<span class="type">([\s\S]*?)<\/span>/),
      meta:    bloc(/<div class="meta">([\s\S]*?)<\/div>/),
      resume:  bloc(/<p class="sum">([\s\S]*?)<\/p>/),
      cabinet: bloc(/<div class="verdict">([\s\S]*?)<\/div>/),
      liens,
    });
  }
  poserAncres(articles);
  return articles;
}

/** même règle de nommage que dans le script d'index.html : ne changer ni l'une
 *  ni l'autre isolément, les liens des bulletins déjà envoyés en dépendent. */
function poserAncres(articles) {
  const pris = new Set();
  for (const a of articles) {
    let base = brut(a.titre).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
    let libre = base, n = 2;
    while (pris.has(libre)) libre = base + '-' + n++;
    pris.add(libre);
    a.ancre = libre;
  }
}

/* --------------------------------------------------------- rendu du bulletin */

function rendreBulletin(nouveaux, dateIso) {
  const tri = [...nouveaux].sort((a, b) =>
    (NIVEAUX[a.niveau]?.rang ?? 9) - (NIVEAUX[b.niveau]?.rang ?? 9)
    || a.spec.localeCompare(b.spec));

  const n = tri.length;
  const nbCrit = tri.filter(a => a.niveau === 'crit').length;
  const chapeau = nbCrit
    ? `${n} nouveaut&eacute;${n > 1 ? 's' : ''} cette semaine, dont ${nbCrit} susceptible${nbCrit > 1 ? 's' : ''} de changer votre pratique.`
    : `${n} nouveaut&eacute;${n > 1 ? 's' : ''} cette semaine — aucune ne modifie la pratique dans l&rsquo;imm&eacute;diat.`;

  const entrees = tri.map(a => {
    const spec   = SPECS[a.spec]   || { nom: a.spec, couleur: '#898781' };
    const niveau = NIVEAUX[a.niveau];
    const lienPrincipal = (a.liens.find(l => /original/i.test(l.texte)) || a.liens[0] || {}).href || '';
    const autres = a.liens.filter(l => l.href !== lienPrincipal);
    return `
    <article class="e${a.niveau === 'crit' ? ' une' : ''}">
      <div class="fil" style="background:${spec.couleur}"></div>
      <div class="txt">
        <div class="ligne1">
          <span class="spec" style="color:${spec.couleur}">${spec.nom}</span>
          <span class="niv" style="background:${niveau.couleur}">${niveau.court}</span>
          ${a.type ? `<span class="type">${a.type}</span>` : ''}
        </div>
        <h3>${lienPrincipal ? `<a href="${lienPrincipal}">${a.titre}</a>` : a.titre}</h3>
        ${a.meta ? `<div class="meta">${a.meta}</div>` : ''}
        ${a.resume ? `<p class="sum">${a.resume}</p>` : ''}
        ${a.cabinet ? `<div class="cab">${a.cabinet}</div>` : ''}
        <div class="liens">${
          [lienPrincipal ? { href: lienPrincipal, texte: 'Article original' } : null, ...autres]
            .filter(Boolean)
            .map(l => `<a href="${l.href}">${l.texte || 'Lien'}</a>`).join('<span class="sep">·</span>')
        }</div>
      </div>
    </article>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Pause Cardio — bulletin du ${enFrancais(dateIso)}</title>
<style>
  @page { size: A4; margin: 14mm 13mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #111; background: #fff;
         font-size: 10.4pt; line-height: 1.42; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 185mm; margin: 0 auto; padding: 10mm 6mm; }
  @media print { .page { padding: 0; } }

  header.tete { border-bottom: 2px solid #111; padding-bottom: 7px; margin-bottom: 4px; }
  .tete .sur { font-size: 8pt; letter-spacing: .10em; text-transform: uppercase; color: #6b6a66; font-weight: 700; }
  .tete h1 { font-size: 19pt; font-weight: 800; margin-top: 3px; letter-spacing: -.01em; }
  .tete h1 .c { color: #d03b3b; }
  .tete .date { font-size: 9.5pt; color: #52514e; margin-top: 3px; }
  .chapeau { margin: 12px 0 16px; font-size: 10.5pt; color: #333; }

  article.e { display: flex; gap: 9px; padding: 11px 0 12px; border-bottom: 1px solid #e4e3dc;
              page-break-inside: avoid; break-inside: avoid; }
  article.e:last-of-type { border-bottom: none; }
  article.e.une { background: #fdf6f6; border-left: 0; padding-left: 8px; padding-right: 8px;
                  border-radius: 4px; border-bottom: 1px solid #f0dede; }
  .fil { width: 3px; border-radius: 2px; flex: none; }
  .txt { flex: 1; min-width: 0; }
  .ligne1 { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-bottom: 4px; }
  .ligne1 .spec { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  .ligne1 .niv { font-size: 7.5pt; font-weight: 700; color: #fff; border-radius: 99px; padding: 1.5px 7px; letter-spacing: .02em; }
  .ligne1 .type { font-size: 8pt; color: #7a7975; font-weight: 600; }
  h3 { font-size: 11.6pt; line-height: 1.28; font-weight: 700; }
  h3 a { color: #111; text-decoration: none; }
  .meta { font-size: 9pt; color: #52514e; margin-top: 2px; }
  .sum { font-size: 9.8pt; color: #2c2c2a; margin-top: 5px; }
  .cab { font-size: 9.6pt; margin-top: 6px; padding: 6px 9px; background: #f4f4f0;
         border-left: 2px solid #111; border-radius: 0 4px 4px 0; }
  .liens { margin-top: 5px; font-size: 8.4pt; }
  .liens a { color: #2a78d6; text-decoration: none; }
  .liens .sep { color: #b5b4ac; margin: 0 6px; }

  footer.pied { margin-top: 18px; padding-top: 8px; border-top: 1px solid #d8d7cf;
                font-size: 8.2pt; color: #7a7975; line-height: 1.5; page-break-inside: avoid; }
  footer.pied a { color: #7a7975; }
  footer.pied b { color: #52514e; }
</style>
</head>
<body>
<div class="page">
  <header class="tete">
    <div class="sur">Bulletin hebdomadaire &middot; Centre de Cardiologie de Rodez</div>
    <h1>PAUSE CARDIO <span class="c">&#10084;</span></h1>
    <div class="date">Nouveaut&eacute;s de la semaine du ${enFrancais(dateIso)}</div>
  </header>
  <p class="chapeau">${chapeau}</p>
${entrees}
  <footer class="pied">
    Tableau de bord complet &mdash; toutes les sorties, recherche FR/EN, fiches de lecture :
    <a href="https://pausecardio.fr/">pausecardio.fr</a><br>
    <b>R&eacute;sum&eacute;s &agrave; valider par le lecteur avant toute application clinique &mdash; se reporter aux articles originaux.</b>
  </footer>
</div>
</body>
</html>`;
}

/* ------------------------------------------------------------- courriel */

/** Le bulletin en version e-mail, au visuel des cartes de l'application :
 *  fond papier, carte claire au liséré de surspécialité, badge de niveau,
 *  accroche puis repère revue · date. Le titre est du texte : seul le lien
 *  rouge « Lire la fiche » (et le bouton du bas) mènent au site.
 *  HTML « à l'ancienne » (tableaux, styles en ligne), seule forme que
 *  Gmail, Outlook et Apple Mail affichent tous correctement. */
function rendreCourriel(nouveaux, dateIso) {
  const SITE_URL = 'https://pausecardio.fr/';
  const tri = [...nouveaux].sort((a, b) =>
    (NIVEAUX[a.niveau]?.rang ?? 9) - (NIVEAUX[b.niveau]?.rang ?? 9)
    || a.spec.localeCompare(b.spec));
  const n = tri.length;
  const nbCrit = tri.filter(a => a.niveau === 'crit').length;
  const chapeau = nbCrit
    ? `${n} nouveaut${n > 1 ? 'és' : 'é'} cette semaine, dont ${nbCrit} susceptible${nbCrit > 1 ? 's' : ''} de changer votre pratique.`
    : `${n} nouveaut${n > 1 ? 'és' : 'é'} cette semaine — aucune ne modifie la pratique dans l’immédiat.`;

  // les pastilles de niveau, reprises trait pour trait des badges du site
  const BADGE = {
    crit:  '<span style="font-size:11px;font-weight:bold;color:#d03b3b;letter-spacing:.3px;">&#9733; À la une</span>'
         + '&nbsp;&nbsp;<span style="background:#d03b3b;color:#ffffff;font-weight:bold;border-radius:99px;padding:2px 10px;font-size:11px;">Changement de pratique</span>',
    warn:  '<span style="background:#fab219;color:#4a3500;font-weight:bold;border-radius:99px;padding:2px 10px;font-size:11px;">À connaître</span>',
    watch: '<span style="background:#f2f2ee;color:#52514e;font-weight:bold;border-radius:99px;padding:2px 10px;font-size:11px;border:1px solid #e4e3dc;">Veille</span>',
  };

  const entrees = tri.map(a => {
    const spec = SPECS[a.spec] || { nom: a.spec, couleur: '#898781' };
    const lien = SITE_URL + '#' + a.ancre;
    const fond = a.niveau === 'crit' ? '#fbf2f1' : '#fcfcfb';
    return `
    <tr><td style="padding:0 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${fond};border:1px solid #e4e3dc;border-left:3px solid ${spec.couleur};border-radius:12px;">
        <tr><td style="padding:13px 15px 14px;">
          <div style="font-family:Helvetica,Arial,sans-serif;">${BADGE[a.niveau] || ''}
            &nbsp;&nbsp;<span style="font-size:11px;color:#898781;font-weight:bold;">${spec.nom}</span></div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.32;font-weight:bold;color:#0b0b0b;margin-top:7px;">${a.titre}</div>
          ${a.accroche ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#52514e;line-height:1.35;margin-top:3px;">${a.accroche}</div>` : ''}
          ${a.meta ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:11.5px;color:#898781;margin-top:3px;">${a.meta}</div>` : ''}
          ${a.chiffre ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#52514e;line-height:1.5;background:#f2f2ee;border:1px solid #e4e3dc;border-radius:10px;padding:8px 12px;margin-top:9px;"><span style="display:block;font-size:10.5px;font-weight:bold;letter-spacing:.9px;color:#898781;margin-bottom:3px;">RÉSULTAT PRINCIPAL</span>${a.chiffre}</div>` : ''}
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;margin-top:10px;">
            <a href="${lien}" style="color:#d03b3b;font-weight:bold;text-decoration:none;">Lire la fiche sur Pause Cardio &rarr;</a>
          </div>
        </td></tr>
      </table>
      <div style="font-size:8px;line-height:8px;">&nbsp;</div>
    </td></tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pause Cardio — les sorties du ${enFrancais(dateIso)}</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f7;">
<div style="display:none;max-height:0;overflow:hidden;">${chapeau}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;">
  <tr><td align="center" style="padding:26px 10px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td align="center" style="padding:0 20px 6px;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:bold;letter-spacing:5px;color:#0b0b0b;">PAUSE&nbsp;CARDIO</div>
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#898781;margin-top:5px;">Les sorties de la semaine du ${enFrancais(dateIso)}</div>
        <div style="height:6px;border-radius:3px;background:#d03b3b;margin-top:12px;font-size:0;line-height:0;">&nbsp;</div>
      </td></tr>
      <tr><td style="padding:14px 20px 12px;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#333333;">${chapeau}</div>
      </td></tr>
${entrees}
      <tr><td align="center" style="padding:12px 20px 8px;">
        <a href="${SITE_URL}" style="font-family:Helvetica,Arial,sans-serif;font-size:13.5px;font-weight:bold;color:#ffffff;background:#d03b3b;border-radius:8px;padding:11px 22px;text-decoration:none;display:inline-block;">Ouvrir le tableau de bord complet</a>
      </td></tr>
      <tr><td style="padding:16px 20px 8px;">
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#898781;line-height:1.55;border-top:1px solid #e4e3dc;padding-top:12px;">
          <b style="color:#52514e;">Pause Cardio</b> — veille bibliographique hebdomadaire en cardiologie.
          R&eacute;sum&eacute;s &agrave; valider par le lecteur avant toute application clinique &mdash; se reporter aux articles originaux.<br>
          Vous recevez ce message parce que vous vous &ecirc;tes inscrit sur <a href="${SITE_URL}" style="color:#898781;">pausecardio.fr</a>.
          <a href="{{ unsubscribe }}" style="color:#898781;">Se d&eacute;sinscrire</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* --------------------------------------------------------- page d'archives */

function rendreArchives(bulletins) {
  const lignes = [...bulletins].sort((a, b) => b.date.localeCompare(a.date)).map((b, i) => `
      <li${i === 0 ? ' class="dernier"' : ''}>
        <a class="pdf" href="${b.fichier}">Bulletin du ${enFrancais(b.date)}</a>
        <span class="n">${b.nb} nouveaut&eacute;${b.nb > 1 ? 's' : ''}${b.crit ? ` &middot; ${b.crit} &#9733;` : ''}</span>
      </li>`).join('');
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pause Cardio — bulletins hebdomadaires</title>
<meta name="description" content="Tous les bulletins hebdomadaires Pause Cardio en PDF : les nouvelles sorties bibliographiques en cardiologie de chaque semaine, résumées en français.">
<link rel="canonical" href="https://pausecardio.fr/bulletin/">
<link rel="icon" href="../icone/icone.svg" type="image/svg+xml">
<link rel="apple-touch-icon" sizes="180x180" href="../icone/pausecardio-180.png">
<style>
  :root { color-scheme: light dark; --page:#f9f9f7; --surface:#fcfcfb; --texte:#0b0b0b;
          --doux:#52514e; --muet:#898781; --bord:rgba(11,11,11,.10); --rouge:#d03b3b; }
  @media (prefers-color-scheme: dark) {
    :root { --page:#0d0d0d; --surface:#1a1a19; --texte:#fff; --doux:#c3c2b7; --muet:#898781;
            --bord:rgba(255,255,255,.10); }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--page);
         color: var(--texte); line-height: 1.45; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 28px 20px 64px; }
  .eyebrow { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muet); font-weight: 600; }
  h1 { font-size: 26px; margin-top: 4px; }
  h1 .c { color: var(--rouge); }
  .retour { display: inline-block; margin-top: 14px; font-size: 14px; color: var(--doux); }
  ul { list-style: none; margin-top: 26px; }
  li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; background: var(--surface);
       border: 1px solid var(--bord); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
  li.dernier { border-color: var(--texte); box-shadow: inset 0 0 0 1px var(--texte); }
  li a.pdf { font-size: 15.5px; font-weight: 600; color: var(--texte); text-decoration: none; }
  li a.pdf::before { content: "\\1F4C4\\00A0"; }
  li .n { font-size: 13px; color: var(--muet); margin-left: auto; }
  .vide { color: var(--muet); font-size: 14.5px; margin-top: 26px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="eyebrow">Pause Cardio &middot; archives</div>
  <h1>Bulletins hebdomadaires <span class="c">&#10084;</span></h1>
  <a class="retour" href="../">&#8592; Retour au tableau de bord</a>
  ${bulletins.length ? `<ul>${lignes}\n  </ul>` : '<p class="vide">Aucun bulletin pour le moment — le premier para&icirc;tra d&egrave;s qu&rsquo;une nouvelle sortie sera ajout&eacute;e au tableau de bord.<br><br>En attendant, voici <a href="exemple.pdf">un exemple de bulletin</a> pour voir &agrave; quoi il ressemblera.</p>'}
</div>
</body>
</html>`;
}

/** pose (ou remplace) le lien vers les bulletins dans l'en-tête du tableau de bord */
function poserLien(html, lien) {
  const marque = /<!--BULLETIN:DEBUT-->[\s\S]*?<!--BULLETIN:FIN-->/;
  if (!marque.test(html)) {
    console.warn('Repères <!--BULLETIN:DEBUT--> absents de index.html : lien non mis à jour.');
    return;
  }
  writeFileSync(SITE, html.replace(marque, `<!--BULLETIN:DEBUT-->${lien}<!--BULLETIN:FIN-->`));
}

/* ------------------------------------------------------------------ exécution */

const html     = readFileSync(SITE, 'utf8');
const articles = lireArticles(html);
if (!articles.length) { console.error('Aucun article trouvé dans index.html — arrêt.'); process.exit(1); }

if (!existsSync(DOSSIER)) mkdirSync(DOSSIER, { recursive: true });
const etat = existsSync(ETAT)
  ? JSON.parse(readFileSync(ETAT, 'utf8'))
  : { connus: [], bulletins: [], derniere_execution: null };

const dateIso = valeur('date') || aujourdhui();

if (opt('init')) {
  etat.connus = articles.map(a => a.cle);
  etat.derniere_execution = dateIso;
  writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n');
  writeFileSync(join(DOSSIER, 'index.html'), rendreArchives(etat.bulletins));
  poserLien(html, '');
  console.log(`INIT ${etat.connus.length} articles mémorisés — aucun bulletin produit.`);
  process.exit(0);
}

if (opt('apercu')) {
  const echantillon = articles.filter(a => a.annee === '2026').slice(0, 5);
  const fichier = join(DOSSIER, 'apercu.html');
  writeFileSync(fichier, rendreBulletin(echantillon, dateIso));
  writeFileSync(join(DOSSIER, 'courriel-apercu.html'), rendreCourriel(echantillon, dateIso));
  console.log('APERCU ' + fichier + ' (+ courriel-apercu.html)');
  process.exit(0);
}

const connus   = new Set(etat.connus);
const nouveaux = articles.filter(a => !connus.has(a.cle));

if (!nouveaux.length) {
  etat.derniere_execution = dateIso;
  writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n');
  console.log('RIEN — aucune nouveauté cette semaine, pas de bulletin produit.');
  process.exit(0);
}

const nomHtml = `bulletin-${dateIso}.html`;
const nomPdf  = `bulletin-${dateIso}.pdf`;
writeFileSync(join(DOSSIER, nomHtml), rendreBulletin(nouveaux, dateIso));
writeFileSync(join(DOSSIER, `courriel-${dateIso}.html`), rendreCourriel(nouveaux, dateIso));

/* on garde aussi les clés des articles retirés du site : un article un jour supprimé
   puis remis ne doit pas être re-signalé comme une nouveauté. */
etat.connus = [...new Set([...etat.connus, ...articles.map(a => a.cle)])];
etat.bulletins = [
  ...etat.bulletins.filter(b => b.date !== dateIso),
  { date: dateIso, fichier: nomPdf, nb: nouveaux.length, crit: nouveaux.filter(a => a.niveau === 'crit').length },
];
etat.derniere_execution = dateIso;
writeFileSync(ETAT, JSON.stringify(etat, null, 2) + '\n');
writeFileSync(join(DOSSIER, 'index.html'), rendreArchives(etat.bulletins));

// depuis le 29/08/2026 le tableau de bord n'affiche plus de lien vers le PDF :
// le bulletin part par courriel, les archives restent accessibles sur /bulletin/.
poserLien(html, '');

console.log(`BULLETIN ${nouveaux.length} nouveauté(s) → bulletin/${nomHtml}`);
nouveaux.forEach(a => console.log('  · [' + a.niveau + '] ' + brut(a.titre)));
