#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — prévenir les moteurs dès la publication (protocole IndexNow).
 *
 * Au lieu d'attendre que le robot passe de lui-même — ce qui prend des jours sur
 * un site neuf —, on annonce les adresses nouvelles ou modifiées. Bing, Yandex,
 * Seznam et Naver partagent le même point d'entrée. Ça compte doublement ici :
 * l'index de Bing alimente les réponses de ChatGPT et de Copilot, donc une fiche
 * reprise vite est une fiche citable vite.
 *
 * Google ne participe PAS à IndexNow : pour lui, c'est le plan du site et son
 * propre rythme qui font foi. Ce script ne le remplace pas.
 *
 * Usage :
 *   node outils/indexnow.mjs                  les cartes du jour + la page d'accueil
 *   node outils/indexnow.mjs <url|chemin>...  des adresses précises
 *   node outils/indexnow.mjs --tout           toutes les adresses du plan du site
 *   node outils/indexnow.mjs --essai          montre ce qui partirait, n'envoie rien
 *
 * LA CLÉ N'EST PAS UN SECRET. Le protocole exige qu'elle soit lisible par tous à
 * l'adresse `https://pausecardio.fr/<clé>.txt` : c'est ainsi que le moteur vérifie
 * que celui qui annonce les adresses possède bien le site. Elle vit donc dans le
 * dépôt, au vu de tous, et ce n'est pas une négligence. Ne pas la déplacer dans
 * les secrets GitHub : le fichier doit rester servi par le site.
 *
 * Ce script ne fait jamais échouer ce qui l'appelle : un refus du moteur ou une
 * panne de réseau s'affiche et se termine par un code 0. Prévenir un moteur est
 * un confort, pas une condition de publication.
 * --------------------------------------------------------------------------- */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE   = 'https://pausecardio.fr/';
const HOTE   = 'pausecardio.fr';
const POINT  = 'https://api.indexnow.org/indexnow';

const args  = process.argv.slice(2);
const essai = args.includes('--essai');
const tout  = args.includes('--tout');
const donnes = args.filter(a => !a.startsWith('--'));

/* ------------------------------------------------------------------- la clé */
// le fichier <clé>.txt à la racine du dépôt est la seule source : pas de clé en dur
const fichiersCle = readdirSync(RACINE).filter(f => /^[0-9a-f]{8,128}\.txt$/i.test(f));
if (fichiersCle.length !== 1) {
  console.log(`IndexNow ignoré : ${fichiersCle.length} fichier(s) de clé à la racine, il en faut exactement un.`);
  process.exit(0);
}
const cle = readFileSync(join(RACINE, fichiersCle[0]), 'utf8').trim();
if (cle !== fichiersCle[0].replace(/\.txt$/i, '')) {
  console.log(`IndexNow ignoré : ${fichiersCle[0]} ne contient pas la clé qui lui donne son nom.`);
  process.exit(0);
}

/* -------------------------------------------------------------- les adresses */
const aujourdhui = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// même règle d'ancre que le script d'index.html, outils/bulletin.mjs et
// outils/pages-articles.mjs : ne jamais changer l'une sans les autres
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', rsquo: '’', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', ecirc: 'ê', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', icirc: 'î', deg: '°', middot: '·', mdash: '—', ndash: '–' };
const decoder = h => (h || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&([a-zA-Z0-9]+);/g, (m, n) => ENT[n] ?? m);
const texte = h => decoder((h || '').replace(/<[^>]*>/g, ' ')).replace(/[ \t\r\n]+/g, ' ').trim();
const slug = t => texte(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');

function adressesDuJour() {
  const html = readFileSync(join(RACINE, 'index.html'), 'utf8');
  const urls = [SITE];
  const pris = new Set();
  for (const m of html.matchAll(/<article class="card"([^>]*)>([\s\S]*?)<\/article>/g)) {
    const titre = (m[2].match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1];
    if (!titre) continue;
    let a = slug(titre), libre = a, n = 2;
    while (pris.has(libre)) libre = a + '-' + n++;
    pris.add(libre);
    if (m[1].includes(`data-ajout="${aujourdhui}"`)) urls.push(`${SITE}fiche/${libre}/`);
  }
  return urls;
}

function adressesDuPlan() {
  const xml = readFileSync(join(RACINE, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

const normaliser = x => {
  if (/^https?:\/\//.test(x)) return x;
  const p = x.replace(/^\.?\//, '').replace(/index\.html$/, '');
  return SITE + p;
};

let urls = donnes.length ? donnes.map(normaliser) : (tout ? adressesDuPlan() : adressesDuJour());
urls = [...new Set(urls)].filter(u => u.startsWith(SITE));

if (!urls.length) { console.log('IndexNow : aucune adresse à annoncer.'); process.exit(0); }
if (urls.length > 10000) urls = urls.slice(0, 10000);   // plafond du protocole

console.log(`IndexNow : ${urls.length} adresse(s)`);
urls.slice(0, 12).forEach(u => console.log('  · ' + u));
if (urls.length > 12) console.log(`  … et ${urls.length - 12} autre(s)`);

if (essai) { console.log('ESSAI — rien n\'est parti.'); process.exit(0); }

/* ----------------------------------------------------------------- l'envoi */
try {
  const r = await fetch(POINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOTE, key: cle, keyLocation: SITE + fichiersCle[0], urlList: urls }),
  });
  const corps = (await r.text()).trim();
  if (r.status === 200) console.log('ANNONCÉ (200) — les adresses sont prises en compte.');
  else if (r.status === 202) console.log('ACCEPTÉ (202) — le moteur valide la clé, les adresses suivront.');
  else console.log(`Refus du moteur : ${r.status}${corps ? ' — ' + corps.slice(0, 200) : ''}`);
} catch (e) {
  console.log('IndexNow injoignable (' + e.message + ') — sans conséquence, la publication est faite.');
}
