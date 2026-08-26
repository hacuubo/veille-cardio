#!/usr/bin/env node
/**
 * Moisson hebdomadaire — Pause Cardio
 *
 * Interroge PubMed surspécialité par surspécialité, sur une fenêtre de dates, et
 * dresse la liste des sorties candidates en signalant celles qui sont déjà sur le
 * site. Sert de filet : la sélection éditoriale reste humaine (et assistée), mais
 * elle ne part plus de la mémoire — elle part d'une récolte systématique.
 *
 * Usage :  node outils/moisson.mjs [--jours=8] [--depuis=AAAA-MM-JJ] [--jusqu=AAAA-MM-JJ]
 *                                  [--spec=rythmo] [--tout] [--max=60]
 *   --jours=N   : fenêtre glissante, N jours en arrière (défaut 8)
 *   --depuis=   : date de début explicite (prioritaire sur --jours)
 *   --jusqu=    : date de fin (défaut : aujourd'hui)
 *   --spec=     : ne moissonner qu'une surspécialité
 *   --tout      : affiche aussi les articles déjà en ligne (sinon comptés seulement)
 *   --brut      : n'écarte rien (éditoriaux, courriers, travaux précliniques compris)
 *   --max=N     : nombre de résultats par requête (défaut 60)
 *
 * Aucune dépendance : Node 18+ suffit (fetch intégré).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE   = join(RACINE, 'index.html');
const ETAT   = join(RACINE, 'bulletin', 'etat.json');
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

/* --------------------------------------------------------------- paramètres */

const args = process.argv.slice(2);
const opt = (nom, defaut) => {
  const t = args.find(a => a.startsWith('--' + nom + '='));
  return t ? t.slice(nom.length + 3) : defaut;
};
const TOUT = args.includes('--tout');
const BRUT = args.includes('--brut');

// ce qui n'a pas sa place dans une veille clinique
const BRUIT = /(Editorial|^Comment$|Comment,|Letter|Published Erratum|Retract|News|Biography|Autobiography|Historical Article|Portrait)/i;
const PRECLINIQUE = /\b(mice|mouse|murine|rats?|in vitro|zebrafish|knockout|cell line|organoids?|porcine|swine)\b/i;
// ce qui, au contraire, doit remonter en tête de liste
const FORTS = /(Randomized Controlled Trial|Practice Guideline|Guideline|Meta-Analysis|Consensus Development Conference|Clinical Trial, Phase III)/i;
const MAX  = Number(opt('max', 60));
const SEUL = opt('spec', '');

const jour = ms => new Date(ms).toISOString().slice(0, 10);
const JUSQU  = opt('jusqu', jour(Date.now()));
const DEPUIS = opt('depuis',
  jour(new Date(JUSQU + 'T12:00:00').getTime() - Number(opt('jours', 8)) * 86400000));

/* ------------------------------------------------------------ les requêtes */

// revues où une sortie majeure ne peut pas passer inaperçue
const MAJEURES = [
  'N Engl J Med', 'Lancet', 'JAMA', 'JAMA Cardiol', 'Circulation',
  'Eur Heart J', 'J Am Coll Cardiol', 'NEJM Evid', 'BMJ', 'Nat Med',
];
// revues de surspécialité : on n'y retient que les essais, recos et méta-analyses
const SPECIALISEES = [
  'Circ Heart Fail', 'Circ Arrhythm Electrophysiol', 'Circ Cardiovasc Interv',
  'Circ Cardiovasc Imaging', 'Circ Cardiovasc Qual Outcomes',
  'JACC Heart Fail', 'JACC Cardiovasc Interv', 'JACC Cardiovasc Imaging',
  'JACC Clin Electrophysiol', 'JACC Adv', 'Eur Heart J Cardiovasc Imaging',
  'Eur Heart J Acute Cardiovasc Care', 'Eur J Heart Fail', 'Eur J Prev Cardiol',
  'Heart Rhythm', 'Europace', 'EuroIntervention', 'Heart', 'J Card Fail',
  'Resuscitation', 'Intensive Care Med', 'Crit Care', 'Br J Sports Med',
  'J Cardiovasc Magn Reson', 'J Am Soc Echocardiogr',
];
const TYPES_FORTS = [
  'randomized controlled trial[pt]', 'guideline[pt]', 'practice guideline[pt]',
  'meta-analysis[pt]', 'consensus development conference[pt]',
];

const revues = liste => '(' + liste.map(r => `"${r}"[ta]`).join(' OR ') + ')';

const SPECS = {
  rythmo: {
    nom: 'Rythmologie',
    termes: ['atrial fibrillation', 'atrial flutter', 'catheter ablation', 'pulsed field ablation',
             'ventricular tachycardia', 'left atrial appendage', 'pacemaker', 'cardiac resynchronization',
             'implantable cardioverter', 'conduction system pacing', 'syncope', 'anticoagulation'],
  },
  interv: {
    nom: 'Interventionnel & structurel',
    termes: ['percutaneous coronary intervention', 'coronary stent', 'TAVI', 'transcatheter aortic valve',
             'mitral valve repair', 'transcatheter edge-to-edge', 'coronary artery bypass',
             'fractional flow reserve', 'antiplatelet', 'acute coronary syndrome', 'valvular heart disease'],
  },
  imagerie: {
    nom: 'Imagerie cardiaque',
    termes: ['coronary computed tomography', 'cardiac magnetic resonance', 'echocardiography',
             'stress echocardiography', 'coronary artery calcium', 'strain imaging', 'cardiac imaging'],
  },
  ic: {
    nom: 'Insuffisance cardiaque',
    termes: ['heart failure', 'ejection fraction', 'natriuretic peptide', 'SGLT2 inhibitor',
             'sacubitril', 'finerenone', 'cardiac rehabilitation', 'left ventricular assist'],
  },
  usic: {
    nom: 'USIC · Réanimation cardiologique',
    termes: ['cardiogenic shock', 'cardiac arrest', 'extracorporeal membrane oxygenation',
             'mechanical circulatory support', 'cardiac intensive care', 'vasopressor',
             'post-cardiac arrest', 'myocardial infarction complicated'],
  },
  cmh: {
    nom: 'Cardiomyopathies & myocardites',
    termes: ['hypertrophic cardiomyopathy', 'dilated cardiomyopathy', 'transthyretin amyloidosis',
             'cardiac amyloidosis', 'myocarditis', 'pericarditis', 'myosin inhibitor',
             'arrhythmogenic cardiomyopathy', 'Fabry disease'],
  },
  prev: {
    nom: 'Prévention',
    termes: ['LDL cholesterol', 'lipoprotein(a)', 'statin', 'PCSK9', 'hypertension',
             'blood pressure', 'GLP-1 receptor agonist', 'obesity', 'type 2 diabetes cardiovascular',
             'cardiovascular prevention', 'smoking cessation', 'colchicine'],
  },
  sport: {
    nom: 'Cardiologie du sport · CFX/VO₂ max',
    termes: ['athlete', 'sports cardiology', 'cardiopulmonary exercise testing', 'exercise capacity',
             'sudden cardiac death young', 'preparticipation screening', 'endurance exercise'],
  },
};

/* ------------------------------------------------- ce qui est déjà sur le site */

const brut = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ').trim();
const cle = t => brut(t).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

const connus = new Set();
if (existsSync(SITE)) {
  const html = readFileSync(SITE, 'utf8');
  for (const m of html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)) connus.add(cle(m[1]));
}
if (existsSync(ETAT)) {
  try { (JSON.parse(readFileSync(ETAT, 'utf8')).connus || []).forEach(k => connus.add(k)); }
  catch (e) { /* état illisible : on continue sans */ }
}
/**
 * Un même article ne porte pas toujours le même titre ici et sur PubMed : les
 * recommandations traînent un sous-titre à rallonge (« A Report of the ACC/AHA… »).
 * On compare donc aussi les 60 premiers caractères, préfixe contre préfixe.
 */
const PREFIXE = 60;
const prefixes = new Set([...connus].map(k => k.slice(0, PREFIXE)));
const dejaVu = titre => {
  const k = cle(titre);
  return connus.has(k) || (k.length >= PREFIXE && prefixes.has(k.slice(0, PREFIXE)));
};

/* ------------------------------------------------------------ appels PubMed */

let dernier = 0;
async function pubmed(chemin, params) {
  const attente = 380 - (Date.now() - dernier);        // PubMed tolère 3 appels/seconde
  if (attente > 0) await new Promise(r => setTimeout(r, attente));
  dernier = Date.now();
  const url = `${EUTILS}/${chemin}?` + new URLSearchParams(params);
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.text();
    } catch (e) { /* réseau : on retente */ }
    await new Promise(r => setTimeout(r, 900 * (essai + 1)));
  }
  throw new Error('PubMed injoignable : ' + chemin);
}

async function chercher(terme) {
  const xml = await pubmed('esearch.fcgi', {
    db: 'pubmed', retmax: String(MAX), sort: 'date', term: terme,
    datetype: 'edat', mindate: DEPUIS.replace(/-/g, '/'), maxdate: JUSQU.replace(/-/g, '/'),
  });
  return [...xml.matchAll(/<Id>(\d+)<\/Id>/g)].map(m => m[1]);
}

async function detailler(pmids) {
  if (!pmids.length) return [];
  const txt = await pubmed('esummary.fcgi', {
    db: 'pubmed', retmode: 'json', id: pmids.join(','),
  });
  const res = JSON.parse(txt).result || {};
  return (res.uids || []).map(id => {
    const r = res[id] || {};
    const doi = (r.articleids || []).find(a => a.idtype === 'doi');
    return {
      pmid: id,
      titre: r.title || '',
      revue: r.source || '',
      date: r.pubdate || '',
      types: (r.pubtype || []).join(', '),
      doi: doi ? doi.value : '',
    };
  });
}

/* ------------------------------------------------------------------ moisson */

const parSpec = [];
let totalNouveaux = 0, totalConnus = 0;
const vus = new Set();

for (const [code, spec] of Object.entries(SPECS)) {
  if (SEUL && SEUL !== code) continue;
  const termes = '(' + spec.termes.map(t => `"${t}"[tiab]`).join(' OR ') + ')';
  const requetes = [
    `${termes} AND ${revues(MAJEURES)}`,
    `${termes} AND ${revues(SPECIALISEES)} AND (${TYPES_FORTS.join(' OR ')})`,
  ];
  const pmids = new Set();
  for (const r of requetes) (await chercher(r)).forEach(id => pmids.add(id));

  let articles = (await detailler([...pmids].filter(id => !vus.has(id))))
    .map(a => ({ ...a, deja: dejaVu(a.titre), fort: FORTS.test(a.types) }));
  articles.forEach(a => vus.add(a.pmid));
  if (!BRUT) articles = articles.filter(a => !BRUIT.test(a.types) && !PRECLINIQUE.test(a.titre));
  articles.sort((a, b) =>
    Number(a.deja) - Number(b.deja) || Number(b.fort) - Number(a.fort) || a.revue.localeCompare(b.revue));

  totalNouveaux += articles.filter(a => !a.deja).length;
  totalConnus   += articles.filter(a => a.deja).length;
  parSpec.push({ code, nom: spec.nom, articles });
}

/* ------------------------------------------------------------------ rapport */

const ligne = '─'.repeat(72);
console.log(ligne);
console.log(`MOISSON PubMed du ${DEPUIS} au ${JUSQU}`);
console.log(`${totalNouveaux} sortie(s) à examiner · ${totalConnus} déjà sur le site`);
console.log(ligne);

for (const s of parSpec) {
  const neufs = s.articles.filter(a => !a.deja);
  console.log(`\n## ${s.nom}  —  ${neufs.length} à examiner, ${s.articles.length - neufs.length} déjà en ligne`);
  const montres = TOUT ? s.articles : neufs;
  if (!montres.length) { console.log('   (rien)'); continue; }
  for (const a of montres) {
    console.log(`\n   ${a.deja ? 'déjà   ' : 'NOUVEAU'} ${a.fort ? '★' : ' '} ${a.revue} · ${a.date}`);
    console.log(`            ${a.titre}`);
    console.log(`            ${a.types}`);
    console.log(`            PMID ${a.pmid}${a.doi ? ' · https://doi.org/' + a.doi : ''}`);
  }
}

console.log(`\n${ligne}`);
console.log('Rappel de méthode : tout candidat écarté doit l\'être en connaissance de cause.');
console.log('Un suivi à long terme d\'un essai pivot n\'est jamais « veille » : au minimum « à connaître ».');
console.log(ligne);
