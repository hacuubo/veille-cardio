#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — contrôle des liens d'index.html (articles originaux, analyses,
 * Radar). Lancé chaque mois par .github/workflows/controle-liens.yml, qui ouvre
 * une issue GitHub quand des liens sont morts.
 *
 * Usage :  node outils/controle-liens.mjs [--rapport=fichier.md] [--max=N] [--delai=15]
 *
 * Verdicts, par adresse :
 *   OK        réponse 2xx ou 3xx
 *   MORT      404, 410, ou domaine introuvable — à corriger
 *   INCERTAIN 403, 429, 5xx, délai dépassé : beaucoup d'éditeurs (NEJM, Elsevier…)
 *             refusent les robots ; ce n'est pas un lien mort, on ne le signale
 *             qu'à titre indicatif
 *
 * Code de sortie 1 s'il y a au moins un lien MORT. Ne réécrit rien.
 * --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const t = args.find(a => a.startsWith('--' + n + '=')); return t ? t.slice(n.length + 3) : d; };
const RAPPORT = opt('rapport', '');
const MAX = Number(opt('max', 0));
const DELAI = Number(opt('delai', 15)) * 1000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

const html = readFileSync(join(RACINE, 'index.html'), 'utf8');
const decoder = t => t.replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const brut = t => decoder(t.replace(/<[^>]+>/g, ' ')).replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

// où se trouve chaque lien : titre de la carte, ou « Radar »
const liens = new Map();          // url → { ou: [...] }
const noter = (url, ou) => { if (!liens.has(url)) liens.set(url, { ou: [] }); liens.get(url).ou.push(ou); };
for (const m of html.matchAll(/<article class="card"[^>]*>([\s\S]*?)<\/article>/g)) {
  const corps = m[1];
  const titre = brut((corps.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || '').slice(0, 80);
  for (const h of corps.matchAll(/href="(https?:\/\/[^"]+)"/g)) noter(decoder(h[1]), titre);
}
const radar = (html.match(/<ol[^>]*id="radar-fil"[^>]*>([\s\S]*?)<\/ol>/) || [])[1] || '';
for (const h of radar.matchAll(/href="(https?:\/\/[^"]+)"/g)) noter(decoder(h[1]), 'Radar');

let urls = [...liens.keys()];
if (MAX) urls = urls.slice(0, MAX);

async function sonder(url) {
  for (const methode of ['HEAD', 'GET']) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), DELAI);
    try {
      const r = await fetch(url, { method: methode, redirect: 'follow', signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'fr,en;q=0.8' } });
      clearTimeout(t);
      if (r.status === 404 || r.status === 410) return { verdict: 'MORT', detail: String(r.status) };
      if (r.ok || (r.status >= 300 && r.status < 400)) return { verdict: 'OK', detail: String(r.status) };
      if (methode === 'HEAD' && (r.status === 405 || r.status === 403 || r.status === 400)) continue;  // certains serveurs refusent HEAD
      return { verdict: 'INCERTAIN', detail: String(r.status) };
    } catch (e) {
      clearTimeout(t);
      const msg = String(e && (e.cause?.code || e.name || e.message) || e);
      if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return { verdict: 'MORT', detail: 'domaine introuvable' };
      if (methode === 'HEAD') continue;
      return { verdict: 'INCERTAIN', detail: /Abort/.test(msg) ? 'délai dépassé' : msg };
    }
  }
  return { verdict: 'INCERTAIN', detail: 'sans réponse' };
}

const resultats = [];
let i = 0;
async function ouvrier() {
  while (i < urls.length) {
    const url = urls[i++];
    const r = await sonder(url);
    resultats.push({ url, ...r, ou: liens.get(url).ou });
    process.stdout.write(`${r.verdict.padEnd(9)} ${r.detail.padEnd(20)} ${url}\n`);
  }
}
await Promise.all(Array.from({ length: 4 }, ouvrier));

const morts = resultats.filter(r => r.verdict === 'MORT');
const incertains = resultats.filter(r => r.verdict === 'INCERTAIN');
const ok = resultats.length - morts.length - incertains.length;
console.log(`\nBILAN ${resultats.length} lien(s) : ${ok} OK, ${morts.length} MORT(S), ${incertains.length} incertain(s)`);

if (RAPPORT) {
  const auj = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const ligne = r => `- ${r.url} (${r.detail}) — ${[...new Set(r.ou)].map(o => `« ${o} »`).join(', ')}`;
  const md = [`Contrôle des liens du ${auj} : ${resultats.length} liens, ${ok} OK, ${morts.length} mort(s), ${incertains.length} incertain(s).`, ''];
  if (morts.length) md.push('## Liens morts — à corriger dans index.html', '', ...morts.map(ligne), '');
  if (incertains.length) md.push('## Liens incertains — refus des robots ou délai dépassé, à vérifier seulement si un lecteur se plaint', '', ...incertains.map(ligne), '');
  md.push('Contrôle automatique mensuel (`outils/controle-liens.mjs`). Corriger un lien = remplacer l’adresse dans la carte, sans toucher au texte.');
  writeFileSync(RAPPORT, md.join('\n'), 'utf8');
  console.log(`Rapport écrit dans ${RAPPORT}`);
}
process.exit(morts.length ? 1 : 0);
