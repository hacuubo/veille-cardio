#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — une page par article, pour les moteurs de recherche.
 *
 * Le site tient sur une seule adresse ; Google n'y voit qu'une page énorme. Ce
 * script fabrique, à partir des cartes d'index.html, une page statique par
 * article dans fiche/<ancre>/index.html (titre d'origine, accroche, résumé,
 * résultat principal, « En pratique », fiche complète, liens), avec les
 * métadonnées que les moteurs lisent (description, canonical, Open Graph,
 * JSON-LD). Chaque page renvoie vers le site principal, à la carte
 * correspondante (https://pausecardio.fr/#ancre) : c'est là que se lit la
 * veille, les pages par article ne servent qu'à être trouvées. Le bouton
 * « Partager » du site continue lui aussi de pointer vers le site principal
 * (décision du 08/09/2026).
 *
 * Usage :  node outils/pages-articles.mjs            écrit fiche/ et le bloc
 *                                                     FICHES de sitemap.xml
 *          node outils/pages-articles.mjs --verifier  ne modifie rien ; code 1
 *                                                     si fiche/ n'est plus à jour
 *
 * L'ancre d'une page est la même que sur le site (règle du script d'index.html
 * et de poserAncres dans outils/bulletin.mjs : minuscules sans accents, tirets,
 * 64 caractères, suffixe -2 en cas de doublon). Ne jamais changer l'une sans
 * les autres. À lancer après toute modification d'index.html ; le workflow
 * .github/workflows/fiches.yml rattrape un oubli.
 * --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'fiche');
const SITE = 'https://pausecardio.fr/';
const VERIFIER = process.argv.includes('--verifier');

const SPECS = {
  rythmo:   ['#2a78d6', 'Rythmologie'],
  interv:   ['#eb6834', 'Interventionnel & structurel'],
  imagerie: ['#0f95a8', 'Imagerie cardiaque'],
  ic:       ['#1baf7a', 'Insuffisance cardiaque'],
  usic:     ['#a8348c', 'USIC · Réanimation cardiologique'],
  cmh:      ['#4a3aa7', 'Cardiomyopathies & myocardites'],
  prev:     ['#e87ba4', 'Prévention'],
  sport:    ['#eda100', 'Cardiologie du sport · CFX/VO₂ max'],
  onco:     ['#6b7f2e', 'Onco-cardiologie'],
};
const MOIS = { janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12 };

/* ------------------------------------------------------------ utilitaires */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', thinsp: '\u2009', ensp: ' ', emsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', ccedil: 'ç', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç', laquo: '«', raquo: '»',
  middot: '·', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', deg: '°', times: '×',
  le: '≤', ge: '≥', plusmn: '±', minus: '−', rarr: '→', sup2: '²', micro: 'µ', beta: 'β', alpha: 'α', oelig: 'œ', OElig: 'Œ', copy: '©' };
const decoder = h => (h || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&([a-zA-Z0-9]+);/g, (m, n) => ENT[n] ?? m);
const texte = h => decoder((h || '').replace(/<[^>]*>/g, ' ')).replace(/[ \t\r\n]+/g, ' ').trim();
const echapper = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = t => echapper(t);
// même règle d'ancre que le script d'index.html (norm + slug) et outils/bulletin.mjs
const slug = t => texte(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
function dateParution(meta) {
  const m = texte(meta).toLowerCase().match(/(\d{1,2})(?:er)?\s+([a-zéèêûôîàç]+)\s+(\d{4})/);
  if (!m || !MOIS[m[2]]) return '';
  return `${m[3]}-${String(MOIS[m[2]]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}
const aujourdhui = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/* ------------------------------------------------------------- les cartes */
const html = readFileSync(join(RACINE, 'index.html'), 'utf8');
const cartes = [];
const pris = new Set();
for (const m of html.matchAll(/<article class="card"([^>]*)>([\s\S]*?)<\/article>/g)) {
  const a = m[1], corps = m[2];
  const at = n => decoder((a.match(new RegExp(`${n}="([^"]*)"`)) || [])[1] || '');
  const bloc = (re) => (corps.match(re) || [])[1] || '';
  const titreHtml = bloc(/<h3[^>]*>([\s\S]*?)<\/h3>/);
  const titre = texte(titreHtml);
  if (!titre) continue;
  let ancre = slug(titreHtml), libre = ancre, n = 2;
  while (pris.has(libre)) libre = ancre + '-' + n++;
  pris.add(libre);
  const fiche = bloc(/<div class="fiche">([\s\S]*?)<\/div>\s*<\/article>/) || bloc(/<div class="fiche">([\s\S]*)$/);
  const liens = [...corps.matchAll(/<a class="btn"([^>]*)href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(l => ({ href: decoder(l[2]), libelle: texte(l[3]).replace(/\s*[↗]\s*$/, '').trim() }));
  const metaHtml = bloc(/<div class="meta">([\s\S]*?)<\/div>/);
  cartes.push({
    ancre: libre, spec: at('data-spec'), annee: at('data-year'), niveau: at('data-lvl'), ajout: at('data-ajout'),
    fr: at('data-fr'), titre, titreHtml, type: texte(bloc(/<span class="type">([\s\S]*?)<\/span>/)),
    metaHtml, meta: texte(metaHtml), paru: dateParution(metaHtml),
    sum: bloc(/<p class="sum">([\s\S]*?)<\/p>/), cle: bloc(/<div class="cle">([\s\S]*?)<\/div>/),
    verdict: (fiche.match(/<div class="verdict">([\s\S]*?)<\/div>/) || [])[1] || '',
    corpsFiche: fiche.replace(/<div class="verdict">[\s\S]*?<\/div>/, '').replace(/<div class="sig">[\s\S]*?<\/div>/, '').trim(),
    liens,
  });
}

/* ------------------------------------------------------------- le gabarit */
const STYLE = `
:root{--bg:#f9f9f7;--surface:#fcfcfb;--text:#0b0b0b;--text2:#52514e;--muted:#898781;--grid:#e1e0d9;--border:rgba(11,11,11,.10);--brand:#d03b3b;--rose:rgba(208,59,59,.055);--rose2:rgba(208,59,59,.22);color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--bg:#0d0d0d;--surface:#1a1a19;--text:#fff;--text2:#c3c2b7;--muted:#898781;--grid:#2c2c2a;--border:rgba(255,255,255,.10);--brand:#e2564f;--rose:rgba(226,86,79,.09);--rose2:rgba(226,86,79,.3)}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.5}
a{color:inherit}
.tete{display:flex;align-items:center;justify-content:center;gap:12px;padding:18px 16px 12px;text-decoration:none}
.tete b{font-size:18px;letter-spacing:.14em;font-weight:800}
.tete svg{width:92px;height:26px}.tete .tr{fill:none;stroke:#c3c2b7;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.tete .ba{fill:var(--brand)}
.regle{height:3px;background:var(--brand);margin:0 0 22px}
main{max-width:720px;margin:0 auto;padding:0 18px 40px}
.spec{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
h1{font-size:23px;line-height:1.3;margin:6px 0 8px}
.fr{font-size:17px;color:var(--text2);margin:0 0 6px}
.meta{font-size:13px;color:var(--muted);margin:0 0 18px}.meta b{color:var(--text2)}
.sum{font-size:16px;margin:0 0 16px}
.bloc{border:1px solid var(--border);border-left:4px solid var(--brand);background:var(--surface);border-radius:10px;padding:12px 14px;margin:0 0 14px}
.bloc .lab{display:block;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--brand);margin-bottom:4px}
.bloc.cle{border-left-color:var(--muted)}.bloc.cle .lab{color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 26px}
.btn{font-size:14px;font-weight:600;border-radius:9px;padding:9px 14px;border:1px solid var(--border);background:var(--surface);color:var(--text);text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.btn.primaire{background:var(--text);color:var(--surface);border-color:var(--text)}
.fiche{border-top:1px solid var(--grid);padding-top:14px;max-width:68ch}
.fiche h2{font-size:15px;letter-spacing:.02em;text-transform:uppercase;color:var(--muted);margin:18px 0 6px}
.fiche p,.fiche li{font-size:15.5px;color:var(--text2)}.fiche ul{padding-left:20px}
.sig{font-size:13px;color:var(--muted);border-top:1px solid var(--grid);margin-top:20px;padding-top:12px}
footer{border-top:1px solid var(--grid);margin-top:30px;padding:18px 18px 40px;text-align:center;font-size:14px;color:var(--text2)}
footer p{max-width:620px;margin:6px auto}
`.trim();
const MARQUE = '<svg viewBox="0 0 92 26" aria-hidden="true"><path class="tr" d="M0,13 H18 l3,-6 l4,12 l3,-6 H36"/><rect class="ba" x="40" y="4" width="4" height="18" rx="1.5"/><rect class="ba" x="48" y="4" width="4" height="18" rx="1.5"/><path class="tr" d="M56,13 H62 l3,-6 l4,12 l3,-6 H92"/></svg>';

function page(c) {
  const [couleur, nomSpec] = SPECS[c.spec] || ['#898781', ''];
  const url = `${SITE}fiche/${c.ancre}/`;
  const surLeSite = `${SITE}#${c.ancre}`;
  const accroche = texte(c.fr);
  const cle = texte(c.cle);
  let description = accroche ? accroche + (/[.!?]$/.test(accroche) ? '' : '.') : '';
  if (cle && description.length < 110) description += ' ' + cle;
  if (!description) description = texte(c.sum);
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, '') + '…';
  const original = c.liens.find(l => /article original|pubmed/i.test(l.libelle)) || c.liens.find(l => /doi\.org|pubmed/.test(l.href));
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article',
    '@id': url + '#fiche', mainEntityOfPage: url, url,
    headline: c.titre, description, inLanguage: 'fr',
    ...(c.paru ? { datePublished: c.paru } : {}), ...(c.ajout ? { dateModified: c.ajout } : {}),
    articleSection: nomSpec, isPartOf: { '@id': SITE + '#site' },
    publisher: { '@id': SITE + '#org' },
    ...(original ? { isBasedOn: original.href } : {}),
  };
  const ficheHtml = c.corpsFiche.replace(/<h4>/g, '<h2>').replace(/<\/h4>/g, '</h2>');
  const boutons = [`<a class="btn primaire" href="${attr(surLeSite)}">Voir sur Pause Cardio</a>`]
    .concat(c.liens.map(l => `<a class="btn" href="${attr(l.href)}" target="_blank" rel="noopener">${attr(l.libelle)} ↗</a>`));
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${attr(c.titre)} — Pause Cardio</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Pause Cardio">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${attr(c.titre)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(url)}">
<meta property="og:image" content="${SITE}icone/partage.png?v=3">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f9f9f7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d0d0d" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${SITE}icone/icone.svg" type="image/svg+xml">
<link rel="apple-touch-icon" sizes="180x180" href="${SITE}icone/pausecardio-180.png">
<style>${STYLE}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="tete" href="${SITE}" aria-label="Pause Cardio, accueil"><b>PAUSE CARDIO</b>${MARQUE}</a>
<div class="regle"></div>
<main>
<article>
<div class="spec" style="color:${couleur}">${attr(nomSpec)}${c.type ? ' · ' + attr(c.type) : ''}</div>
<h1>${c.titreHtml.trim()}</h1>
${c.fr ? `<p class="fr">${c.fr}</p>` : ''}
${c.metaHtml ? `<p class="meta">${c.metaHtml.trim()}</p>` : ''}
${c.sum ? `<p class="sum">${c.sum.trim()}</p>` : ''}
${c.cle ? `<div class="bloc cle"><span class="lab">Résultat principal</span>${c.cle.trim()}</div>` : ''}
${c.verdict ? `<div class="bloc"><span class="lab">En pratique</span>${c.verdict.trim().replace(/^<b>En pratique\s*(&nbsp;| )?:?\s*<\/b>\s*/i, '')}</div>` : ''}
<div class="actions">${boutons.join('\n')}</div>
<div class="fiche">
${ficheHtml}
<div class="sig">Résumé à valider par le lecteur avant application clinique — se reporter à l’article original en lien. Fiche rédigée à l’aide de l’IA.</div>
</div>
</article>
</main>
<footer>
<p><b>Pause Cardio</b> — chaque semaine, l’essentiel des publications qui comptent en cardiologie&nbsp;: essais pivots, recommandations et grandes méta-analyses.</p>
<p><a href="${SITE}">Retrouver toutes les sorties sur pausecardio.fr</a></p>
</footer>
<script data-goatcounter="https://pausecardio.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</body>
</html>
`;
}

/* --------------------------------------------------------------- écriture */
const attendu = new Map(cartes.map(c => [c.ancre, page(c)]));
// lastmod : la date d'ajout, sinon la date de parution ; jamais la date du jour, qui
// changerait le sitemap tous les matins sans raison
const urls = cartes.map(c => `  <url>\n    <loc>${SITE}fiche/${c.ancre}/</loc>\n${(c.ajout || c.paru) ? `    <lastmod>${c.ajout || c.paru}</lastmod>\n` : ''}    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>`);
const SITEMAP = join(RACINE, 'sitemap.xml');
let sitemap = existsSync(SITEMAP) ? readFileSync(SITEMAP, 'utf8') : '';
const bloc = `<!--FICHES:DEBUT-->\n${urls.join('\n')}\n  <!--FICHES:FIN-->`;
let sitemapAttendu = sitemap;
if (/<!--FICHES:DEBUT-->[\s\S]*<!--FICHES:FIN-->/.test(sitemap)) sitemapAttendu = sitemap.replace(/<!--FICHES:DEBUT-->[\s\S]*<!--FICHES:FIN-->/, bloc);
else if (sitemap.includes('</urlset>')) sitemapAttendu = sitemap.replace('</urlset>', `  ${bloc}\n</urlset>`);

const existants = existsSync(DOSSIER) ? readdirSync(DOSSIER, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : [];
const enTrop = existants.filter(a => !attendu.has(a));
const differents = [...attendu].filter(([a, contenu]) => {
  const f = join(DOSSIER, a, 'index.html');
  return !existsSync(f) || readFileSync(f, 'utf8') !== contenu;
}).map(([a]) => a);
const sitemapChange = sitemapAttendu !== sitemap;

if (VERIFIER) {
  if (!enTrop.length && !differents.length && !sitemapChange) { console.log(`A_JOUR fiche/ (${attendu.size} pages) et sitemap.xml`); process.exit(0); }
  console.log(`DESYNCHRONISE ${differents.length} page(s) à (ré)écrire, ${enTrop.length} en trop${sitemapChange ? ', sitemap.xml à mettre à jour' : ''} — lancer node outils/pages-articles.mjs`);
  differents.slice(0, 10).forEach(a => console.log('  · ' + a));
  process.exit(1);
}

mkdirSync(DOSSIER, { recursive: true });
for (const a of enTrop) rmSync(join(DOSSIER, a), { recursive: true, force: true });
for (const a of differents) { mkdirSync(join(DOSSIER, a), { recursive: true }); writeFileSync(join(DOSSIER, a, 'index.html'), attendu.get(a), 'utf8'); }
if (sitemapChange) writeFileSync(SITEMAP, sitemapAttendu, 'utf8');
console.log(`FICHES ${attendu.size} page(s) dans fiche/ — ${differents.length} écrite(s), ${enTrop.length} retirée(s)${sitemapChange ? ', sitemap.xml mis à jour' : ''}`);
