#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — journal de veille : ce que la routine a examiné, retenu et
 * écarté, et pourquoi. Un fichier par jour de veille dans journal/AAAA-MM-JJ.md,
 * versionné avec le site (le dépôt est public : titres d'articles et décisions
 * éditoriales seulement, jamais de donnée personnelle).
 *
 * Deux commandes :
 *
 *   node outils/journal.mjs --squelette --moisson=fichier.json [--date=AAAA-MM-JJ]
 *       Écrit journal/<date>.md à partir de la moisson (node outils/moisson.mjs
 *       --json=fichier.json) : un tableau par surspécialité avec chaque candidat
 *       NOUVEAU et deux colonnes à remplir, Verdict et Motif, plus les
 *       rapprochements DEFINITIF?/RADAR? et les rubriques à compléter.
 *       La routine remplit ensuite le fichier à la main (chaque ligne).
 *
 *   node outils/journal.mjs --cloture [--date=AAAA-MM-JJ]
 *       Complète le journal du jour avec ce qui se constate tout seul : cartes
 *       ajoutées ou modifiées aujourd'hui (data-ajout dans index.html), bilan du
 *       contrôle qualité (controle-cartes.mjs), bulletin et courriel du jour.
 *       Refuse (code 1) tant qu'un candidat n'a pas de verdict : rien ne doit
 *       être écarté par omission.
 *
 * Verdicts admis dans la colonne Verdict : « retenu » (avec le niveau : crit,
 * warn ou watch), « écarté », « déjà en ligne », « mis à jour » (publication
 * définitive d'une carte de congrès). Le motif tient en une phrase.
 * --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'journal');
const args = process.argv.slice(2);
const opt = (n, d) => { const t = args.find(a => a.startsWith('--' + n + '=')); return t ? t.slice(n.length + 3) : d; };
const aujourdhui = opt('date', new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
const FICHIER = join(DOSSIER, `${aujourdhui}.md`);
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const enFrancais = iso => { const [a, m, j] = iso.split('-').map(Number); return `${j} ${MOIS[m - 1]} ${a}`; };
const cellule = t => String(t || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------- squelette */
if (args.includes('--squelette')) {
  const chemin = opt('moisson', '');
  if (!chemin || !existsSync(chemin)) { console.error('--moisson=fichier.json manquant (produit par node outils/moisson.mjs --json=…)'); process.exit(2); }
  if (existsSync(FICHIER) && !args.includes('--forcer')) { console.error(`${FICHIER} existe déjà (ajouter --forcer pour l'écraser)`); process.exit(2); }
  const m = JSON.parse(readFileSync(chemin, 'utf8'));
  const l = [];
  l.push(`# Journal de veille — ${enFrancais(aujourdhui)}`, '');
  l.push(`Moisson PubMed du ${m.depuis} au ${m.jusqu}. Chaque candidat NOUVEAU reçoit un verdict : retenu (crit / warn / watch), écarté, déjà en ligne, ou mis à jour. Un candidat écarté l'est en connaissance de cause, avec son motif.`, '');
  let total = 0;
  for (const s of m.specs) {
    const neufs = s.articles.filter(a => !a.deja);
    l.push(`## ${s.nom} — ${neufs.length} candidat(s), ${s.articles.length - neufs.length} déjà en ligne`, '');
    if (!neufs.length) { l.push('(rien)', ''); continue; }
    l.push('| ★ | Revue · date | Titre | PMID | Verdict | Motif |', '|---|---|---|---|---|---|');
    for (const a of neufs) {
      total++;
      l.push(`| ${a.fort ? '★' : ''} | ${cellule(a.revue)} · ${cellule(a.date)} | ${cellule(a.titre)} | [${a.pmid}](https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/) |  |  |`);
    }
    l.push('');
  }
  l.push('## Rapprochements automatiques (publications définitives, publications attendues)', '');
  if (!m.definitifs.length && !m.attendues.length) l.push('(aucun)', '');
  for (const d of m.definitifs) l.push(`- DEFINITIF? carte « ${cellule(d.carte)} » (${d.congres}) ← PMID ${d.pmid} ${cellule(d.titre)} — ${d.pourquoi}. Suite donnée : `);
  for (const a of m.attendues) l.push(`- RADAR? « ${cellule(a.attendu)} » ← PMID ${a.pmid} ${cellule(a.titre)} — ${a.pourquoi}. Suite donnée : `);
  if (m.definitifs.length || m.attendues.length) l.push('');
  l.push('## Compléments hors PubMed', '', 'Congrès de niveau 2 de la semaine, communiqués, relais (TCTMD, ACC.org) : ce qui a été regardé et ce qui en a été retenu.', '', '- ', '');
  l.push('## Radar', '', 'Lignes « publications attendues » retirées ou ajoutées.', '', '- ', '');
  l.push('## Calendrier des congrès', '', 'Lignes A_VERIFIER traitées (dates trouvées, ou report).', '', '- ', '');
  l.push(`<!-- CLOTURE : les rubriques suivantes sont complétées par node outils/journal.mjs --cloture -->`, '');
  mkdirSync(DOSSIER, { recursive: true });
  writeFileSync(FICHIER, l.join('\n'), 'utf8');
  console.log(`SQUELETTE ${FICHIER} — ${total} candidat(s) à juger`);
  process.exit(0);
}

/* --------------------------------------------------------------- clôture */
if (args.includes('--cloture')) {
  if (!existsSync(FICHIER)) { console.error(`${FICHIER} introuvable : faire d'abord --squelette`); process.exit(2); }
  let texte = readFileSync(FICHIER, 'utf8');
  // chaque candidat doit avoir un verdict
  const sansVerdict = [];
  for (const ligne of texte.split('\n')) {
    if (!/^\| .*\| \[\d+\]\(https:\/\/pubmed/.test(ligne)) continue;
    const cases = ligne.split('|').map(x => x.trim());
    if (!cases[5]) sansVerdict.push(cases[3].slice(0, 80));
  }
  if (sansVerdict.length) {
    console.log(`SANS_VERDICT ${sansVerdict.length} candidat(s) sans verdict — à juger avant clôture :`);
    sansVerdict.forEach(t => console.log('  - ' + t));
    process.exit(1);
  }
  texte = texte.replace(/<!-- CLOTURE[\s\S]*$/, '').trimEnd() + '\n\n';
  const html = readFileSync(join(RACINE, 'index.html'), 'utf8');
  const brut = t => t.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const ajoutees = [];
  for (const c of html.matchAll(/<article class="card"([^>]*)>([\s\S]*?)<\/article>/g)) {
    if (!c[1].includes(`data-ajout="${aujourdhui}"`)) continue;
    const spec = (c[1].match(/data-spec="([^"]+)"/) || [])[1], lvl = (c[1].match(/data-lvl="([^"]+)"/) || [])[1];
    ajoutees.push(`- [${spec} · ${lvl}] ${brut((c[2].match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || '')}`);
  }
  texte += `## Cartes ajoutées ou reprises aujourd'hui (data-ajout = ${aujourdhui})\n\n` + (ajoutees.length ? ajoutees.join('\n') : '(aucune)') + '\n\n';
  let bilan = '';
  try { bilan = execFileSync('node', [join(RACINE, 'outils', 'controle-cartes.mjs')], { encoding: 'utf8' }); }
  catch (e) { bilan = (e.stdout || '') + (e.stderr || ''); }
  const lignes = bilan.split('\n').filter(x => /^(ERREUR|AVERTISSEMENT|BILAN)/.test(x));
  texte += '## Contrôle qualité automatique\n\n```\n' + (lignes.join('\n') || bilan.trim()) + '\n```\n\n';
  const bul = readdirSync(join(RACINE, 'bulletin')).filter(f => f.includes(aujourdhui));
  texte += '## Bulletin et courriel\n\n' + (bul.length ? bul.map(f => `- bulletin/${f}`).join('\n') : '- aucun fichier daté d\'aujourd\'hui (jour sans courriel, ou envoi non prévu)') + '\n';
  writeFileSync(FICHIER, texte, 'utf8');
  console.log(`CLOTURE ${FICHIER} — ${ajoutees.length} carte(s) du jour, ${lignes.filter(x => x.startsWith('ERREUR')).length} erreur(s) au contrôle`);
  process.exit(0);
}

console.error('Usage : node outils/journal.mjs --squelette --moisson=fichier.json | --cloture   [--date=AAAA-MM-JJ]');
process.exit(2);
