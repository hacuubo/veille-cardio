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
 *   --json=F    : écrit aussi la moisson dans le fichier F (sert au journal de veille,
 *                 voir outils/journal.mjs)
 *
 * En fin de rapport, deux rapprochements automatiques :
 *   DEFINITIF?  une sortie PubMed ressemble à une carte déjà en ligne présentée en
 *               congrès et qui n'a pas encore de lien vers l'article (DOI ou PubMed) :
 *               c'est probablement sa publication définitive → mettre la carte à jour
 *               (outils/BRIEF-REVISION.md) plutôt que d'en créer une seconde ;
 *   RADAR?      une sortie PubMed ressemble à une « publication attendue » du Radar
 *               → la retirer du Radar et la traiter comme candidate.
 *
 * Aucune dépendance : Node 18+ suffit (fetch intégré).
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
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
  'JACC CardioOncol', 'Lancet Oncol', 'J Clin Oncol', 'JAMA Oncol', 'Ann Oncol',
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
  onco: {
    nom: 'Onco-cardiologie',
    termes: ['cardio-oncology', 'cardiotoxicity', 'anthracycline', 'trastuzumab',
             'immune checkpoint inhibitor myocarditis', 'cancer therapy-related cardiac dysfunction',
             'cancer survivors cardiovascular', 'cancer-associated venous thromboembolism',
             'CAR-T cardiac', 'radiotherapy cardiac', 'cardioprotection cancer'],
  },
};

/* ------------------------------------------------- ce qui est déjà sur le site */

const brut = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ').trim();
const cle = t => brut(t).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

const connus = new Set();
// cartes présentées en congrès dont l'article n'est pas encore en lien (DOI, PubMed
// ou site d'une revue) : leur publication définitive est à guetter
const enAttente = [];
// « publications attendues » de l'encart Radar (lignes li.pub) : idem
const attendues = [];
const SIGLE_CONGRES = /^(ESC|ACC|AHA|TCT|EuroPCR|HRS|EHRA|HFA)\s+\d{4}$/;
const LIEN_ARTICLE = /doi\.org|pubmed\.ncbi|nejm\.org|jamanetwork\.com|thelancet\.com|academic\.oup\.com|ahajournals\.org|jacc\.org|sciencedirect\.com|onlinelibrary\.wiley\.com|bmj\.com|nature\.com|springer\.com|evidence\.nejm\.org/i;
if (existsSync(SITE)) {
  const html = readFileSync(SITE, 'utf8');
  for (const m of html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)) connus.add(cle(m[1]));
  for (const m of html.matchAll(/<article class="card"([^>]*)>([\s\S]*?)<\/article>/g)) {
    const corps = m[2];
    const titre = brut((corps.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || '');
    const meta = brut(((corps.match(/<div class="meta">([\s\S]*?)<\/div>/) || [])[1] || '').replace(/&middot;/g, '·'));
    const bouts = meta.split(/\s*[·\u00b7]\s*/).filter(Boolean);
    const congres = bouts.length > 2 && SIGLE_CONGRES.test(bouts[bouts.length - 1]) ? bouts[bouts.length - 1] : '';
    const liens = [...corps.matchAll(/href="([^"]+)"/g)].map(x => x[1]);
    if (congres && titre && !liens.some(l => LIEN_ARTICLE.test(l))) enAttente.push({ titre, congres });
  }
  const radar = (html.match(/<ol[^>]*id="radar-fil"[^>]*>([\s\S]*?)<\/ol>/) || [])[1] || '';
  for (const m of radar.matchAll(/<li class="pub"[^>]*>([\s\S]*?)<\/li>/g)) {
    const nom = brut((m[1].match(/<b>([\s\S]*?)<\/b>/) || [])[1] || '');
    if (nom) attendues.push({ nom, texte: brut(m[1]) });
  }
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

/* ------------------------------------------ rapprochement avec ce qui est attendu */

const VIDES = new Set(['with', 'without', 'versus', 'from', 'after', 'among', 'patients', 'trial', 'study',
  'randomized', 'randomised', 'clinical', 'effect', 'effects', 'outcomes', 'therapy', 'treatment', 'results',
  'analysis', 'controlled', 'multicentre', 'multicenter', 'open', 'label', 'phase', 'the', 'and', 'for', 'in']);
const mots = t => new Set(brut(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !VIDES.has(w)));
// sigles d'essai (POET, PVI-SHAM-AF, SELECT-2…) : majuscules, chiffres et tirets, 3 signes ou plus
const SIGLES_BANALS = new Set(['ESC', 'ACC', 'AHA', 'HRS', 'EHRA', 'TCT', 'HFA', 'NEJM', 'JAMA', 'JACC', 'EHJ',
  'ECG', 'MRI', 'IRM', 'PCI', 'TAVI', 'TAVR', 'ICD', 'CRT', 'LDL', 'HDL', 'DOAC', 'NOAC', 'DAPT', 'PET', 'CT',
  'STEMI', 'NSTEMI', 'ACS', 'HFrEF', 'HFpEF', 'LVEF', 'CMR', 'AF', 'VT', 'HCM', 'ATTR', 'ECMO', 'COVID', 'FFR', 'CTCA', 'CCTA']);
// POET-II, POET II et POET 2 désignent le même essai : on compare sur la racine
const racine = x => x.replace(/-+$/, '').replace(/[-\s]?(I{1,3}|IV|V|\d+)$/, '');
const sigles = t => new Set([...brut(t).matchAll(/\b([A-Z][A-Z0-9-]{2,})\b/g)].map(x => racine(x[1]))
  .filter(x => /[A-Z]{3}/.test(x) && !SIGLES_BANALS.has(x)));
function ressemble(titrePubmed, reference) {
  const a = mots(titrePubmed), b = mots(reference);
  let commun = 0; for (const w of a) if (b.has(w)) commun++;
  const jaccard = a.size && b.size ? commun / (a.size + b.size - commun) : 0;
  const sa = sigles(titrePubmed), sb = sigles(reference);
  const sigleCommun = [...sa].find(x => sb.has(x)) || '';
  if (sigleCommun) return `sigle ${sigleCommun}`;
  if (jaccard >= 0.4) return `titres proches (${Math.round(jaccard * 100)} % de mots communs)`;
  return '';
}

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

/* ----------------------- publications définitives et publications attendues */

// pour chaque carte en attente, une recherche ciblée sur son titre, sans fenêtre de
// dates : la publication définitive peut être parue n'importe quand
async function chercherTitre(titre) {
  // d'abord par sigle d'essai (POET II, ENRICH-AF…), puis par les premiers mots du titre
  const requetes = [...sigles(titre)].map(x => `${x}[tiab]`);
  const cles = [...mots(titre)].slice(0, 4);
  if (cles.length >= 3) requetes.push(cles.map(w => `${w}[tiab]`).join(' AND '));
  const ids = new Set();
  for (const term of requetes) {
    const xml = await pubmed('esearch.fcgi', { db: 'pubmed', retmax: '8', sort: 'date', term });
    [...xml.matchAll(/<Id>(\d+)<\/Id>/g)].forEach(m => ids.add(m[1]));
  }
  // éditoriaux et commentaires citent l'essai sans être sa publication
  return (await detailler([...ids])).filter(a => !BRUIT.test(a.types));
}
const tous = parSpec.flatMap(s => s.articles);
const vusIci = new Set(tous.map(a => a.pmid));
for (const c of enAttente) {
  try {
    for (const a of await chercherTitre(c.titre)) if (!vusIci.has(a.pmid)) { vusIci.add(a.pmid); tous.push(a); }
  } catch (e) { /* PubMed injoignable pour cette carte : la moisson générale suffit */ }
}
const definitifs = [], parues = [];
for (const a of tous) {
  for (const c of enAttente) {
    const pourquoi = cle(a.titre) === cle(c.titre) ? 'titre identique' : ressemble(a.titre, c.titre);
    if (pourquoi) definitifs.push({ a, c, pourquoi });
  }
  for (const att of attendues) {
    const pourquoi = ressemble(a.titre, att.nom) || (a.titre.toLowerCase().includes(att.nom.toLowerCase()) ? 'nom présent dans le titre' : '');
    if (pourquoi) parues.push({ a, att, pourquoi });
  }
}
if (enAttente.length || attendues.length) {
  console.log(`\n## Publications définitives et publications attendues  —  ${enAttente.length} carte(s) de congrès sans lien d'article, ${attendues.length} attente(s) au Radar`);
  if (!definitifs.length && !parues.length) console.log('   (aucun rapprochement dans cette moisson)');
  for (const d of definitifs) {
    console.log(`\n   DEFINITIF? carte « ${d.c.titre.slice(0, 90)} » (${d.c.congres}) — ${d.pourquoi}`);
    console.log(`            ← ${d.a.revue} · ${d.a.date} · ${d.a.titre}`);
    console.log(`            PMID ${d.a.pmid}${d.a.doi ? ' · https://doi.org/' + d.a.doi : ''} → mettre la carte à jour (BRIEF-REVISION), ne pas en créer une seconde`);
  }
  for (const p of parues) {
    console.log(`\n   RADAR? attendu « ${p.att.nom} » — ${p.pourquoi}`);
    console.log(`            ← ${p.a.revue} · ${p.a.date} · ${p.a.titre}`);
    console.log(`            PMID ${p.a.pmid}${p.a.doi ? ' · https://doi.org/' + p.a.doi : ''} → retirer la ligne du Radar, traiter comme candidate`);
  }
}

const JSON_SORTIE = opt('json', '');
if (JSON_SORTIE) {
  writeFileSync(JSON_SORTIE, JSON.stringify({
    depuis: DEPUIS, jusqu: JUSQU, genere: new Date().toISOString(),
    specs: parSpec.map(s => ({ code: s.code, nom: s.nom, articles: s.articles })),
    definitifs: definitifs.map(d => ({ carte: d.c.titre, congres: d.c.congres, pourquoi: d.pourquoi, pmid: d.a.pmid, doi: d.a.doi, titre: d.a.titre, revue: d.a.revue })),
    attendues: parues.map(p => ({ attendu: p.att.nom, pourquoi: p.pourquoi, pmid: p.a.pmid, doi: p.a.doi, titre: p.a.titre, revue: p.a.revue })),
  }, null, 1), 'utf8');
  console.log(`\nMoisson écrite dans ${JSON_SORTIE}`);
}

console.log(`\n${ligne}`);
console.log('Rappel de méthode : tout candidat écarté doit l\'être en connaissance de cause.');
console.log('Un suivi à long terme d\'un essai pivot n\'est jamais « veille » : au minimum « à connaître ».');
console.log(ligne);
