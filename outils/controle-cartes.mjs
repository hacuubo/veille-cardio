#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — contrôle qualité automatique des cartes (charte de rédaction).
 *
 * Vérifie que chaque carte d'index.html respecte les règles mécaniques de
 * outils/CHARTE-REDACTION.md et de outils/BRIEF-CARTE.md : structure, accroche,
 * date de parution, typographie française, formules interdites, cohérence des
 * chiffres entre accroche, résumé, résultat principal et fiche ; et, avec
 * --sources, fidélité des chiffres au résumé PubMed de l'article.
 *
 * Usage :  node outils/controle-cartes.mjs [--tout] [--depuis=AAAA-MM-JJ] [--jours=N]
 *                                          [--sources] [--strict] [--ancre=…]
 *   défaut     : les cartes ajoutées (data-ajout) dans les 8 derniers jours
 *   --tout     : toutes les cartes
 *   --sources  : cherche le résumé PubMed (DOI ou titre) et refuse tout chiffre
 *                de la carte absent du résumé (réseau nécessaire)
 *   --strict   : code de sortie 1 s'il reste au moins une ERREUR
 *
 * Sortie : une ligne par constat — ERREUR (bloquant) ou AVERTISSEMENT — puis un
 * bilan. Ce script est appelé par outils/faire-bulletin.sh avant tout bulletin
 * et par le workflow d'envoi : un courriel ne part pas si une carte de la
 * semaine est en ERREUR. Il ne réécrit rien.
 * --------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const args   = process.argv.slice(2);
const opt    = n => args.includes('--' + n);
const valeur = n => (args.find(a => a.startsWith('--' + n + '=')) || '').split('=').slice(1).join('=');

const SPECS   = ['rythmo', 'interv', 'imagerie', 'ic', 'usic', 'cmh', 'prev', 'sport', 'onco'];
const NIVEAUX = ['crit', 'warn', 'watch'];
const MOIS    = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const SIG     = 'Résumé à valider par le lecteur avant application clinique';

/* ------------------------------------------------------------ utilitaires */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', thinsp: '\u2009', ensp: '\u2002', emsp: '\u2003',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', ccedil: 'ç', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç', laquo: '«', raquo: '»',
  middot: '·', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', deg: '°', times: '×',
  le: '≤', ge: '≥', plusmn: '±', minus: '−', rarr: '→', sup2: '²', micro: 'µ', beta: 'β', alpha: 'α', oelig: 'œ', OElig: 'Œ' };
function decoder(h) {
  return (h || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&([a-zA-Z0-9]+);/g, (m, n) => ENT[n] ?? m);
}
const brut = h => decoder((h || '').replace(/<[^>]*>/g, ' ')).replace(/[ \t\r\n]+/g, ' ').trim();
const sansAccent = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function decaler(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function slug(titre) {
  return sansAccent(brut(titre).toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
}
/** nombres d'un texte français (virgule décimale, milliers par espace) */
function nombresFr(t) {
  // en français la virgule est le séparateur décimal : ne jamais la retirer ici,
  // seulement les espaces de milliers (y compris insécables et fines).
  t = t.replace(/(?<=\d)[\s\u00a0\u202f\u2009](?=\d{3}(?!\d))/g, '').replace(/,/g, '.');
  return new Set(t.match(/\d+(?:\.\d+)?/g) || []);
}
/**
 * Nombres écrits en toutes lettres dans un résumé anglais : PubMed commence
 * volontiers une phrase par « Eighty-seven randomised trials were included ».
 * Sans cette lecture, le contrôle de fidélité refusait des chiffres pourtant
 * exacts et bloquait la publication (constaté le 11/09/2026).
 */
const UNITES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19 };
const DIZAINES = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function nombresEnLettres(t) {
  const out = new Set();
  const mot = '(?:' + [...Object.keys(UNITES), ...Object.keys(DIZAINES), 'hundred', 'thousand', 'and'].join('|') + ')';
  const re = new RegExp(`\\b${mot}(?:[\\s-]+${mot})*\\b`, 'gi');
  for (const m of t.matchAll(re)) {
    let total = 0, courant = 0, vu = false;
    for (const w of m[0].toLowerCase().split(/[\s-]+/)) {
      if (w === 'and') continue;
      if (w in UNITES) { courant += UNITES[w]; vu = true; }
      else if (w in DIZAINES) { courant += DIZAINES[w]; vu = true; }
      else if (w === 'hundred') { courant = (courant || 1) * 100; vu = true; }
      else if (w === 'thousand') { total += (courant || 1) * 1000; courant = 0; vu = true; }
    }
    if (vu && total + courant > 0) out.add(String(total + courant));
  }
  return out;
}

/** nombres d'un résumé anglais (point décimal, milliers par virgule/espace, « ·» du Lancet, « .45 ») */
function nombresEn(t) {
  t = t.replace(/(?<=\d)·(?=\d)/g, '.').replace(/(?<=\d)[\s\u00a0\u202f\u2009,](?=\d{3}(?!\d))/g, '').replace(/(?<![\d.])\.(?=\d)/g, '0.');
  return new Set(t.match(/\d+(?:\.\d+)?/g) || []);
}
function connu(n, autorises) {
  const norm = x => String(x).replace(/\.0+$/, '');
  if (autorises.has(n) || autorises.has(norm(n))) return true;
  const x = Number(n); if (Number.isNaN(x)) return false;
  for (const y of [x / 100, x * 100]) if (autorises.has(norm(y.toFixed(2))) || autorises.has(String(y))) return true;
  const dec = n.includes('.') ? n.split('.')[1].length : 0;
  for (const a of autorises) if (/^\d+\.\d+$/.test(a) && a.split('.')[1].length > dec && Number(Number(a).toFixed(dec)) === x) return true;
  return false;
}

/* ------------------------------------------------------------ lecture des cartes */
const html = readFileSync(join(RACINE, 'index.html'), 'utf8');
const cartes = [];
const re = /<article class="card[^"]*"([^>]*)>([\s\S]*?)<\/article>/g;
let m, pris = new Set();
while ((m = re.exec(html))) {
  const [, attrs, corps] = m;
  const attr = n => (attrs.match(new RegExp(n + '="([^"]*)"')) || [])[1] ?? '';
  const bloc = r => (corps.match(r) || [])[1] ?? '';
  const titre = bloc(/<h3[^>]*>([\s\S]*?)<\/h3>/);
  let base = slug(titre), ancre = base, k = 2;
  while (pris.has(ancre)) ancre = `${base}-${k++}`;
  pris.add(ancre);
  cartes.push({
    ancre, classes: (attrs.match(/^\s*$/) ? '' : ''), attrs,
    ajout: attr('data-ajout'), spec: attr('data-spec'), annee: attr('data-year'), niveau: attr('data-lvl'),
    fr: decoder(attr('data-fr')), kw: attr('data-kw'), titre, type: bloc(/<span class="type">([\s\S]*?)<\/span>/),
    meta: bloc(/<div class="meta">([\s\S]*?)<\/div>/), sum: bloc(/<p class="sum">([\s\S]*?)<\/p>/),
    cle: bloc(/<div class="cle">([\s\S]*?)<\/div>/), actions: bloc(/<div class="actions">([\s\S]*?)<\/div>/),
    fiche: bloc(/<div class="fiche">([\s\S]*)<\/div>\s*$/),
    brutTout: corps,
  });
}
// cartes hors norme : classe différente de « card »
const classesInconnues = [...html.matchAll(/<article class="([^"]*)"/g)].map(x => x[1]).filter(c => c !== 'card');

/* ------------------------------------------------------------ sélection */
function dateParution(c) {
  const t = sansAccent(brut(c.meta).toLowerCase()), m = t.match(/(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})/);
  if (!m || !MOIS.includes(m[2])) return '';
  return `${m[3]}-${String(MOIS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
const depuis = valeur('depuis') || (valeur('jours') ? decaler(aujourdhui(), -Number(valeur('jours'))) : decaler(aujourdhui(), -8));
const recente = c => (c.ajout && c.ajout >= depuis) || (dateParution(c) && dateParution(c) >= depuis);
let cible = opt('tout') ? cartes : cartes.filter(recente);
if (valeur('ancre')) cible = cartes.filter(c => c.ancre.startsWith(valeur('ancre')));

/* ------------------------------------------------------------ contrôles */
const erreurs = [], avert = [];
const E = (c, msg) => erreurs.push(`ERREUR ${c.ancre} : ${msg}`);
const A = (c, msg) => avert.push(`AVERTISSEMENT ${c.ancre} : ${msg}`);

const INTERDITS = [
  [/\bvs\.?\b/i, '« vs » — écrire « contre »'],
  [/Au cabinet/i, '« Au cabinet » — la rubrique s’appelle « En pratique »'],
  [/r[ée]dig[ée]e? par Claude|par Claude|\bClaude\b/i, 'mention de Claude — interdite dans le contenu'],
  [/\b(Rodez|Aveyron|notre centre|notre cabinet|chez nous)\b/i, 'référence géographique ou personnelle'],
  [/\b(r[ée]volution(ne)?|enterr[ée]e?s?|game[- ]changer|spectaculaire|bouleverse|confirme d[ée]finitivement)\b/i, 'effet journalistique ou conclusion excessive'],
  [/\b(en termes de|au niveau de)\b/i, 'calque de l’anglais'],
  [/\b[ée]vidence\b/i, '« évidence » — écrire « preuve » ou « données »'],
  [/\b(supporte|supportent)\b/i, '« supporter » — écrire « étayer »'],
  [/\b(conditions? cardiaques?|conditions? cliniques?)\b/i, '« condition » — écrire « affection »'],
  [/\bcontr[ôo]les?\b(?= (?:appari[ée]s|sains|historiques))/i, '« contrôles » — écrire « témoins »'],
];

for (const c of cible) {
  const textes = { accroche: c.fr, resume: brut(c.sum), resultat: brut(c.cle), fiche: brut(c.fiche) };
  const tout = Object.values(textes).join(' ');

  // -- attributs
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.ajout)) (recente(c) ? E : A)(c, 'data-ajout manquant ou mal formé');
  if (!SPECS.includes(c.spec)) E(c, `data-spec inconnu : « ${c.spec} »`);
  if (!NIVEAUX.includes(c.niveau)) E(c, `data-lvl inconnu : « ${c.niveau} »`);
  if (!/^20\d\d$/.test(c.annee)) E(c, 'data-year manquant');
  if (brut(c.kw).split(/\s+/).length < 8) A(c, 'data-kw trop court (moins de 8 mots-clés)');
  if (!c.titre.trim()) E(c, 'titre <h3> manquant');

  // -- accroche
  const mots = c.fr.split(/\s+/).filter(w => /[A-Za-zÀ-ÿ]/.test(w));
  if (!c.fr) E(c, 'accroche data-fr vide');
  else {
    if (mots.length < 5 || mots.length > 12) E(c, `accroche de ${mots.length} mots (attendu 6 à 10)`);
    if (/\.$/.test(c.fr.trim())) E(c, 'accroche terminée par un point');
    if (/\d\s*%?$/.test(c.fr.trim())) A(c, 'accroche terminée par un chiffre laissé en suspens');
    if (/ [:?!%]/.test(c.fr) || /[A-Za-zÀ-ÿ0-9)][:?!%]/.test(c.fr)) E(c, 'accroche : espace insécable manquante avant « : », « ? », « ! » ou « % »');
  }

  // -- date de parution dans .meta (jour + mois + année)
  const meta = sansAccent(brut(c.meta).toLowerCase());
  const md = meta.match(/(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})/);
  const mm = meta.match(/\b([a-z]+)\s+(\d{4})\b/);
  if (!md || !MOIS.includes(md[2])) {
    if (mm && MOIS.includes(mm[1])) (recente(c) ? E : A)(c, 'ligne .meta sans jour de parution — une sortie de la semaine doit porter le jour');
    else (recente(c) ? E : A)(c, 'ligne .meta sans date de parution lisible (jour mois année)');
  }
  if (!/<b>[^<]+<\/b>/.test(c.meta)) A(c, 'ligne .meta : la revue devrait être en <b>');

  // -- résumé
  const phrases = textes.resume.split(/[.!?](?:\s|$)/).filter(p => p.trim().length > 2);
  if (!textes.resume) E(c, 'résumé .sum vide');
  else {
    if (textes.resume.split(/\s+/).length < 15) E(c, 'résumé trop court (moins de 15 mots)');
    if (phrases.length > 5) A(c, `résumé de ${phrases.length} phrases (attendu 2 à 4)`);
    if (/^\d[\d\s ,]*\s+(patients?|participants?|sujets?)\b[^.]*:/.test(textes.resume)) A(c, 'résumé commençant par un effectif suivi de deux-points : style télégraphique');
  }

  // -- fiche
  const f = c.fiche;
  if (!f.trim()) E(c, 'fiche de lecture absente');
  else {
    const h4 = [...f.matchAll(/<h4>([\s\S]*?)<\/h4>/g)].map(x => sansAccent(brut(x[1]).toLowerCase()));
    for (const [att, lib] of [['question clinique', 'Question clinique'], ['methode', 'Méthode'], ['resultats', 'Résultats'], ['limites', 'Limites']])
      if (!h4.some(h => h.startsWith(att))) E(c, `fiche sans section « ${lib} »`);
    if (!/<div class="verdict">\s*<b>En pratique/.test(f)) E(c, 'fiche sans rubrique « En pratique » (div.verdict commençant par <b>En pratique)');
    if (!brut(f).includes(SIG)) E(c, 'fiche sans la mention « ' + SIG + ' »');
    if (/<a\b|<script|<img|<h[1-3]\b|<table/.test(f)) E(c, 'balise interdite dans la fiche (lien, script, image, titre h1-h3, table)');
    const ouv = (f.match(/<(div|p|ul|li|h4|b|i|span)\b/g) || []).length, fer = (f.match(/<\/(div|p|ul|li|h4|b|i|span)>/g) || []).length;
    if (ouv !== fer) E(c, `balises déséquilibrées dans la fiche (${ouv} ouvertes, ${fer} fermées)`);
    const verdict = brut((f.match(/<div class="verdict">([\s\S]*?)<\/div>/) || [])[1] || '').replace(/^En pratique\s*:\s*/, '');
    if (verdict && verdict.split(/\s+/).length < 12) A(c, '« En pratique » très court (moins de 12 mots)');
    if (verdict && verdict.split(/[.!?](?:\s|$)/).filter(p => p.trim().length > 2).length > 5) A(c, '« En pratique » de plus de 5 phrases');
  }

  // -- liens
  if (!/<a [^>]*href="https?:\/\//.test(c.actions)) E(c, 'aucun lien vers l’article original');

  // -- langue et typographie (sur tous les textes)
  for (const [k, t] of Object.entries(textes)) {
    if (!t) continue;
    for (const [rx, lib] of INTERDITS) if (rx.test(t)) E(c, `${k} : ${lib}`);
    if (/\d\.\d/.test(t)) A(c, `${k} : point décimal (« 0.72 ») — écrire la virgule`);
    const sansUrl = t.replace(/https?:\/\/\S+/g, '').replace(/\b\d+:\d+\b/g, '');   // heures et ratios « 1:1 »
    if (/ :/.test(sansUrl) || /[A-Za-zÀ-ÿ0-9)»]:/.test(sansUrl)) A(c, `${k} : espace insécable manquante avant « : »`);
    if (/[^\u00a0\u202f]%/.test(t)) A(c, `${k} : « % » sans espace insécable`);
    if (/\bHR\s*=?\s*\d/.test(t) && !/IC\s*95/.test(t) && k !== 'accroche') A(c, `${k} : un HR sans intervalle de confiance`);
    if (/"[^"]+"/.test(t)) A(c, `${k} : guillemets droits — écrire « »`);
  }

  // -- cohérence des chiffres entre présentations
  const nFiche = nombresFr(textes.fiche), nSum = nombresFr(textes.resume), nCle = nombresFr(textes.resultat), nFr = nombresFr(textes.accroche);
  const petits = n => Number(n) <= 12 || /^(19|20)\d\d$/.test(n);
  for (const n of nCle) if (!petits(n) && !connu(n, new Set([...nFiche, ...nSum]))) E(c, `résultat principal : le chiffre ${n} n’apparaît ni dans la fiche ni dans le résumé`);
  for (const n of nSum) if (!petits(n) && !connu(n, new Set([...nFiche, ...nCle]))) A(c, `résumé : le chiffre ${n} n’apparaît pas dans la fiche`);
  for (const n of nFr) if (!petits(n) && !connu(n, new Set([...nFiche, ...nSum, ...nCle]))) E(c, `accroche : le chiffre ${n} n’apparaît nulle part ailleurs sur la carte`);
}

/* ------------------------------------------------------------ fidélité au résumé PubMed */
if (opt('sources') && cible.length) {
  // PubMed tolère 3 appels par seconde et coupe au-delà : sans ce frein, la
  // plupart des recherches échouaient en silence sur un site de 150 cartes, et
  // la fidélité n'était plus contrôlée du tout (constaté le 11/09/2026).
  let dernierAppel = 0;
  const get = async u => {
    for (let essai = 0; essai < 3; essai++) {
      const attente = 350 - (Date.now() - dernierAppel);
      if (attente > 0) await new Promise(r => setTimeout(r, attente));
      dernierAppel = Date.now();
      try { const r = await fetch(u); if (r.ok) return await r.text(); } catch (e) { /* réseau : on retente */ }
      await new Promise(r => setTimeout(r, 800 * (essai + 1)));
    }
    return '';
  };
  const doiDe = liens => {
    for (const l of liens) {
      let x = l.match(/PIIS?(\d{4}-\d{3}[\dX])\((\d\d)\)(\d{5}-[\dX])/); if (x) return `10.1016/S${x[1]}(${x[2]})${x[3]}`;
      x = l.match(/(10\.\d{4,9}\/[^\s"?#]+)/); if (x) return x[1].replace(/[/.]+$/, '');
    }
    return null;
  };
  const norm = t => sansAccent(brut(t).toLowerCase()).replace(/[^a-z0-9]/g, '');
  for (const c of cible) {
    const liens = [...c.actions.matchAll(/href="([^"]+)"/g)].map(x => x[1]);
    let pmid = (liens.map(l => (l.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/) || [])[1]).find(Boolean)) || null;
    const essais = [];
    const doi = doiDe(liens); if (doi) essais.push(doi + '[doi]');
    const titreNu = brut(c.titre).replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    essais.push('"' + titreNu + '"[title]');
    essais.push(titreNu.split(' ').filter(w => w.length > 3).slice(0, 12).map(w => w + '[title]').join(' AND '));
    let resume = '';
    // Le DOI identifie l'article sans ambiguïté ; la recherche par titre, elle,
    // peut tomber sur un homonyme — deux méta-analyses de la même question
    // portent parfois le même titre à un mot près. On exige donc, dans ce
    // second cas, que le titre corresponde presque en entier.
    for (const [i, q] of (pmid ? [] : essais).entries()) {
      const parDoi = i === 0 && !!doi;
      const r = await get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmax=3&term=' + encodeURIComponent(q));
      for (const id of [...r.matchAll(/<Id>(\d+)<\/Id>/g)].map(x => x[1])) {
        const x = await get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&id=' + id);
        const t = (x.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/) || [])[1] || '';
        const a = norm(t), b = norm(c.titre);
        const assezProche = parDoi
          ? a.slice(0, 40) === b.slice(0, 40)
          : (a === b || (a.length >= 60 && b.length >= 60 && (a.startsWith(b) || b.startsWith(a))));
        if (assezProche) { pmid = id; resume = x; break; }
      }
      if (pmid) break;
    }
    if (pmid && !resume) resume = await get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&id=' + pmid);
    const abstract = [...resume.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map(x => x[1].replace(/<[^>]+>/g, ' ')).join(' ');
    if (!abstract) { A(c, 'aucun résumé PubMed trouvé (recommandation, communiqué ou titre non indexé) : fidélité non contrôlable automatiquement'); continue; }
    const clair = decoder(abstract);
    const autorises = new Set([...nombresEn(clair), ...nombresEnLettres(clair), ...Array.from({ length: 32 }, (_, i) => String(i)), '95', '100', '2024', '2025', '2026']);
    const texte = [c.fr, brut(c.sum), brut(c.cle), brut(c.fiche)].join(' ').replace(/\b\d{1,2}\s+[a-zéû]+\s+20\d\d/g, ' ');
    const manquants = [...nombresFr(texte)].filter(n => !/^(19|20)\d\d$/.test(n) && !connu(n, autorises)).sort();
    if (manquants.length) E(c, `chiffres absents du résumé PubMed ${pmid} : ${manquants.join(', ')} — vérifier sur l’article ou retirer`);
    else console.log(`SOURCE ${c.ancre} : tous les chiffres se retrouvent dans le résumé PubMed ${pmid}`);
  }
}

/* ------------------------------------------------------------ bilan */
for (const l of erreurs) console.log(l);
for (const l of avert) console.log(l);
if (classesInconnues.length) console.log(`AVERTISSEMENT structure : ${classesInconnues.length} carte(s) avec une classe autre que « card » (${[...new Set(classesInconnues)].join(', ')})`);
const portee = opt('tout') ? `${cible.length} cartes (toutes)` : `${cible.length} carte(s) ajoutée(s) depuis le ${depuis}`;
console.log(`BILAN ${portee} : ${erreurs.length} erreur(s), ${avert.length} avertissement(s)`);
if (opt('strict') && erreurs.length) process.exit(1);
