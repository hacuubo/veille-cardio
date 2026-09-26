#!/usr/bin/env node
/**
 * Flux RSS des grandes revues — complément de la moisson PubMed (Pause Cardio)
 *
 * PubMed indexe parfois un article quelques jours après sa mise en ligne par la
 * revue. Les flux RSS des revues, eux, l'annoncent le jour même. Ce module lit les
 * flux listés dans outils/flux.json, garde les articles parus dans la fenêtre de
 * dates et qui parlent de cardiologie, et rend la liste à la moisson, qui écarte
 * ensuite ce que PubMed a déjà donné et ce qui est déjà sur le site.
 *
 * Utilisé par outils/moisson.mjs (import), mais se lance aussi seul pour vérifier
 * que les flux répondent :
 *   node outils/flux.mjs [--jours=8] [--depuis=AAAA-MM-JJ] [--jusqu=AAAA-MM-JJ] [--brut]
 *
 * Un flux qui ne répond pas (panne, blocage, adresse changée) est signalé sur une
 * ligne FLUX_MUET et ignoré : la moisson n'échoue jamais à cause d'un flux.
 * Aucune dépendance : Node 18+ suffit (fetch intégré).
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const LISTE = join(ICI, 'flux.json');
const AGENT = 'Mozilla/5.0 (compatible; PauseCardio/1.0; +https://pausecardio.fr)';
const DELAI_MS = 25000;

// ce qui, dans un flux de revue, n'est pas un article de recherche : étiquettes entre
// crochets (Lancet), titres de rubriques, réponses aux courriers
const RUBRIQUES = 'Correspondence|Comment|Editorial|Perspectives?|World Report|Obituary|Correction|Erratum|Department of Error|Series|Seminar|Review|Viewpoint|Insight|Podcast|Books?|Media|Clinical Picture|Case Report|News';
const BRUIT_FLUX = new RegExp('^\\s*(\\[(' + RUBRIQUES + ')\\]|(Audio Highlights|Corrections?|Erratum|Notice of Retraction|Retraction|Letter|Reply|In Reply|Podcast|Editorial|Perspective|Clinical Implications of Basic Research|Images in Clinical Medicine|Case Records|Clinical Problem-Solving|Interactive Medical Case|Medicine and Society|Author Interview|Highlights from|In This Issue|Table of Contents|Masthead|Cover|Issue Information|JAMA Editors|Editors\' Summary)\\b)', 'i');
const REPONSE = /(\u2014|\u2013|-|:)\s*(Authors?\u2019?'?\s*)?[Rr]eply\s*$|^In Reply\b|Authors[\u2019']? reply\s*$/;
// NEJM et NEJM Evidence signent le type d'article dans le DOI : NEJMoa (article original),
// NEJMsr (special report), EVIDoa — le reste (NEJMe éditorial, NEJMc courrier, NEJMp
// perspective, NEJMra revue, NEJMcp pratique clinique, NEJMicm image…) n'est pas une sortie
const DOI_NEJM_HORS_RECHERCHE = /^10\.1056\/(?!NEJMoa|NEJMsr|EVIDoa|EVIDsr)[A-Za-z]+/;
// de quoi reconnaître un article de cardiologie quand aucun terme de surspécialité n'accroche
const CARDIO = /\b(cardi|heart|coronar|atrial|ventric|valv|aort|myocard|pericard|endocard|arrhythm|fibrillation|tachycard|bradycard|pacemaker|defibrillat|ablation|stent|angioplast|revascular|thromb|anticoagul|antiplatelet|aspirin|hypertens|blood pressure|cholesterol|lipoprotein|statin|pcsk9|lipid|troponin|natriuretic|ejection fraction|cardiomyopath|amyloid|ecmo|resuscitation|cardiac arrest|sudden death|stroke|vascular|athero|angina|infarct)/i;

/* ------------------------------------------------------------- lecture XML */

const decode = t => String(t || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

const champ = (bloc, noms) => {
  for (const n of noms) {
    const m = bloc.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`, 'i'));
    if (m && decode(m[1])) return decode(m[1]);
  }
  return '';
};

const MOIS_EN = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7,
  aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const deuxChiffres = n => String(n).padStart(2, '0');
/** Ramène une date de flux (ISO, RFC 822, « Available online 23 September 2026 ») à AAAA-MM-JJ. */
function dateISO(t) {
  if (!t) return '';
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/);
  if (m && MOIS_EN[m[2].toLowerCase()]) return `${m[3]}-${deuxChiffres(MOIS_EN[m[2].toLowerCase()])}-${deuxChiffres(m[1])}`;
  m = t.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MOIS_EN[m[1].toLowerCase()]) return `${m[3]}-${deuxChiffres(MOIS_EN[m[1].toLowerCase()])}-${deuxChiffres(m[2])}`;
  return '';
}

/** Découpe un flux RSS 2.0, RSS 1.0 (RDF) ou Atom en articles {titre, lien, doi, date}. */
export function analyserFlux(xml) {
  const blocs = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(m => m[2]);
  const articles = [];
  for (const b of blocs) {
    const titre = champ(b, ['title']);
    if (!titre) continue;
    let lien = champ(b, ['link']) || ((b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '');
    if (!lien) lien = (b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || '';
    lien = decode(lien).replace(/[?&](af=R|rss=[^&]*|dgcid=[^&]*)/g, '').replace(/[?&]$/, '');
    let doi = champ(b, ['prism:doi']) || champ(b, ['dc:identifier']).replace(/^doi:\s*/i, '');
    if (!/^10\.\d{4,}\//.test(doi)) doi = (decode(b).match(/\b(10\.\d{4,}\/[^\s"<>]+)/) || [])[1] || '';
    if (!doi) doi = (lien.match(/doi\/(?:full|abs|pdf)?\/?(10\.\d{4,}\/[^\s?#]+)/i) || [])[1] || '';
    doi = doi.replace(/[).,;]+$/, '');
    const date = dateISO(champ(b, ['dc:date', 'prism:publicationDate', 'pubDate', 'published', 'updated', 'dc:date.published']))
      || dateISO((decode(b).match(/Publication date:\s*(?:Available online\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i) || [])[1] || '');
    articles.push({ titre, lien, doi, date, description: champ(b, ['description', 'summary', 'content:encoded']).slice(0, 400) });
  }
  return articles;
}

/* ----------------------------------------------------------------- lecture */

async function lire(url) {
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const r = await fetch(url, { headers: { 'user-agent': AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' }, signal: ctrl.signal });
    const texte = await r.text();
    // Circulation renvoie un flux valide sous un code 404 quand une variante d'adresse est vide :
    // on juge sur le contenu, pas sur le code
    if (!/<(item|entry)[\s>]/i.test(texte)) return { erreur: `HTTP ${r.status}, aucun article dans la réponse` };
    return { xml: texte };
  } catch (e) {
    return { erreur: e.name === 'AbortError' ? `pas de réponse en ${DELAI_MS / 1000} s` : (e.message || String(e)) };
  } finally { clearTimeout(minuterie); }
}

/**
 * Lit tous les flux et rend { articles, muets } :
 *   articles : parus entre depuis et jusqu (ou sans date lisible), sans les éditoriaux et
 *              courriers, sans doublon (DOI puis titre), avec la surspécialité devinée
 *              d'après `specs` ({code: {nom, termes}}) — 'cardio' quand seul le vocabulaire
 *              général accroche ; les articles hors cardiologie sont écartés, sauf --brut ;
 *   muets    : flux qui n'ont pas répondu, avec la raison.
 */
export async function lireFlux({ depuis, jusqu, specs = {}, brut = false } = {}) {
  const liste = JSON.parse(readFileSync(LISTE, 'utf8')).flux;
  const resultats = await Promise.all(liste.map(async f => ({ f, ...(await lire(f.url)) })));
  const muets = [], vus = new Map(), articles = [];
  const termes = Object.entries(specs).map(([code, s]) => ({ code, nom: s.nom,
    re: new RegExp('\\b(' + s.termes.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')).join('|') + ')', 'i') }));
  for (const r of resultats) {
    if (r.erreur) { muets.push({ nom: r.f.nom, url: r.f.url, raison: r.erreur }); continue; }
    for (const a of analyserFlux(r.xml)) {
      if (!brut && (BRUIT_FLUX.test(a.titre) || REPONSE.test(a.titre) || DOI_NEJM_HORS_RECHERCHE.test(a.doi))) continue;
      if (a.date && depuis && a.date < depuis) continue;
      if (a.date && jusqu && a.date > jusqu) continue;
      const texte = a.titre + ' ' + a.description;
      const spec = termes.find(t => t.re.test(texte));
      const code = spec ? spec.code : (CARDIO.test(a.titre) ? 'cardio' : '');
      if (!code && !brut) continue;
      const k = a.doi ? 'doi:' + a.doi.toLowerCase() : 'titre:' + a.titre.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (vus.has(k)) continue;
      vus.set(k, true);
      articles.push({ revue: r.f.revue, flux: r.f.nom, titre: a.titre, lien: a.lien, doi: a.doi, date: a.date, spec: code || 'hors-cardio' });
    }
  }
  articles.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.revue.localeCompare(b.revue));
  return { articles, muets, nombreFlux: liste.length };
}

/* ------------------------------------------------- lancement direct (essai) */

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const opt = (nom, defaut) => { const t = args.find(a => a.startsWith('--' + nom + '=')); return t ? t.slice(nom.length + 3) : defaut; };
  const jour = ms => new Date(ms).toISOString().slice(0, 10);
  const jusqu = opt('jusqu', jour(Date.now()));
  const depuis = opt('depuis', jour(new Date(jusqu + 'T12:00:00').getTime() - Number(opt('jours', 8)) * 86400000));
  const { articles, muets, nombreFlux } = await lireFlux({ depuis, jusqu, brut: args.includes('--brut') });
  console.log(`FLUX du ${depuis} au ${jusqu} — ${nombreFlux} flux lus, ${muets.length} muet(s), ${articles.length} article(s) de cardiologie dans la fenêtre`);
  for (const m of muets) console.log(`FLUX_MUET ${m.nom} — ${m.raison} — ${m.url}`);
  for (const a of articles) {
    console.log(`\n   ${a.revue} · ${a.date || 'date illisible'} · ${a.flux}`);
    console.log(`            ${a.titre}`);
    console.log(`            ${a.doi ? 'https://doi.org/' + a.doi : a.lien}`);
  }
}
