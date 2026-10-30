#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — relevé de fréquentation, pour le tableau de bord privé de Robin.
 *
 * Lit GoatCounter (visites, sources, pays, appareils, et les gestes des lecteurs
 * comptés par le script d'index.html : fiche/…, original/…, partage/… — liste en
 * tête de la fonction mesurer) et Brevo (courriels envoyés, ouvertures, clics par
 * article, inscrits). Écrit un fichier JSON par tableau dans frequentation/,
 * dossier ignoré par git : le dépôt est public, ces chiffres ne le sont pas.
 * Lecture seule : n'envoie rien, ne modifie rien chez GoatCounter ni chez Brevo.
 *
 * Usage :  node outils/frequentation.mjs                (30 derniers jours)
 *          node outils/frequentation.mjs --jours=7
 *          node outils/frequentation.mjs --depuis=2026-11-06 [--jusqua=2026-11-10]
 * Clés :   fichier .env.local à la racine du dépôt (jamais commité), une par ligne :
 *            GOATCOUNTER_CLE=…   (GoatCounter → nom d'utilisateur → API, droit « Read statistics »)
 *            BREVO_CLE_API=…     (Brevo → SMTP & API → Clés API)
 *          ou les mêmes noms en variables d'environnement. Une clé absente : la
 *          partie correspondante est sautée, sans erreur.
 * --------------------------------------------------------------------------- */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = join(RACINE, 'frequentation');
const GC_SITE = 'https://pausecardio.goatcounter.com';
const BREVO_LISTE = Number(process.env.BREVO_LISTE_ID || 3);

/* ------------------------------------------------------------------ clés */
const env = { ...process.env };
const FICHIER_CLES = join(RACINE, '.env.local');
if (existsSync(FICHIER_CLES)) {
  for (const ligne of readFileSync(FICHIER_CLES, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const CLE_GC = env.GOATCOUNTER_CLE || '';
const CLE_BREVO = env.BREVO_CLE_API || '';

/* ---------------------------------------------------------------- période */
const opt = nom => (process.argv.find(a => a.startsWith(`--${nom}=`)) || '').split('=')[1] || '';
const jourIso = d => d.toISOString().slice(0, 10);
const maintenant = new Date();
const finPeriode = opt('jusqua') ? new Date(opt('jusqua') + 'T23:59:59Z') : maintenant;
const debutPeriode = opt('depuis')
  ? new Date(opt('depuis') + 'T00:00:00Z')
  : new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() - (Number(opt('jours')) || 30) + 1));
// GoatCounter veut des heures rondes
const heureRonde = d => { const x = new Date(d); x.setUTCMinutes(0, 0, 0); return x; };
const debut = heureRonde(debutPeriode);
const fin = heureRonde(finPeriode > maintenant ? maintenant : finPeriode);
const duree = fin - debut;
const debutPrecedent = new Date(debut - duree);

/* ------------------------------------------------- les articles du site */
// titre et surspécialité de chaque ancre, pour nommer les lignes du tableau
// (même règle d'ancre que le script d'index.html, outils/bulletin.mjs et outils/pages-articles.mjs)
const SPECS = {
  rythmo: 'Rythmologie', interv: 'Interventionnel & structurel', imagerie: 'Imagerie cardiaque',
  ic: 'Insuffisance cardiaque', usic: 'USIC · Réanimation cardiologique', cmh: 'Cardiomyopathies & myocardites',
  prev: 'Prévention', sport: 'Cardiologie du sport', onco: 'Onco-cardiologie',
};
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—',
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ccedil: 'ç', ocirc: 'ô', icirc: 'î', uuml: 'ü', ouml: 'ö', auml: 'ä',
  middot: '·', hellip: '…', beta: 'β', alpha: 'α', ge: '≥', le: '≤', times: '×', minus: '−' };
const texte = h => (h || '').replace(/<[^>]*>/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&([a-zA-Z0-9]+);/g, (m, n) => ENT[n] ?? m)
  .replace(/\s+/g, ' ').trim();
const slug = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
const articles = new Map();
{
  const html = readFileSync(join(RACINE, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<article class="card"([^>]*)>([\s\S]*?)<\/article>/g)) {
    const titre = texte((m[2].match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1]);
    if (!titre) continue;
    let a = slug(titre), libre = a, n = 2;
    while (articles.has(libre)) libre = a + '-' + n++;
    const spec = (m[1].match(/data-spec="([^"]*)"/) || [])[1] || '';
    const paru = texte((m[2].match(/<div class="meta">([\s\S]*?)<\/div>/) || [])[1]).split('·')[1]?.trim() || '';
    articles.set(libre, { titre, surspecialite: SPECS[spec] || spec, paru });
  }
}
const titreDe = (ancre, secours = '') => articles.get(ancre)?.titre || secours.replace(/\s+—\s+Pause Cardio$/, '') || ancre;

/* ------------------------------------------------------------- GoatCounter */
const pause = ms => new Promise(r => setTimeout(r, ms));
async function gc(chemin, params = {}) {
  const url = new URL('/api/v0' + chemin, GC_SITE);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v);
  for (let essai = 0; essai < 4; essai++) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + CLE_GC, 'Content-Type': 'application/json' } });
    if (r.status === 429) { await pause(1000 * (Number(r.headers.get('X-Rate-Limit-Reset')) || 1) + 200); continue; }
    const t = await r.text();
    if (r.status === 401) throw new Error('GoatCounter refuse la clé (401) : vérifier GOATCOUNTER_CLE dans .env.local');
    if (r.status === 403) throw new Error('GoatCounter : la clé n’a pas le droit « Read statistics » (403)');
    if (!r.ok) throw new Error(`GoatCounter ${chemin} → ${r.status} ${t.slice(0, 200)}`);
    await pause(280);   // 4 requêtes par seconde au plus
    return JSON.parse(t);
  }
  throw new Error(`GoatCounter ${chemin} : trop de requêtes, réessayer dans une minute`);
}

async function releveGoatCounter() {
  const periode = { start: debut.toISOString(), end: fin.toISOString() };

  const total = await gc('/stats/total', periode);
  const precedent = await gc('/stats/total', { start: debutPrecedent.toISOString(), end: debut.toISOString() });

  // toutes les pages et tous les événements de la période, par lots de 100
  const chemins = [];
  const vus = new Set();
  for (let tour = 0; tour < 30; tour++) {
    const r = await gc('/stats/hits', { ...periode, limit: 100, exclude_paths: [...vus].join(',') });
    const neufs = (r.hits || []).filter(h => !vus.has(h.path_id));
    neufs.forEach(h => { vus.add(h.path_id); chemins.push(h); });
    if (!r.more || !neufs.length) break;
  }

  const liste = async (page, limite = 100) => {
    try { return (await gc('/stats/' + page, { ...periode, limit: limite })).stats || []; }
    catch (e) { console.warn(`  (${page} indisponible : ${e.message})`); return []; }
  };
  const [sources, campagnes, systemes, navigateurs, tailles, pays] = [
    await liste('toprefs'), await liste('campaigns'), await liste('systems'),
    await liste('browsers'), await liste('sizes'), await liste('locations'),
  ];
  return { total, precedent, chemins, sources, campagnes, systemes, navigateurs, tailles, pays };
}

/* ------------------------------------------------------------------ Brevo */
async function brevo(chemin) {
  const r = await fetch('https://api.brevo.com/v3' + chemin, { headers: { 'api-key': CLE_BREVO, accept: 'application/json' } });
  const t = await r.text();
  if (r.status === 401) throw new Error('Brevo refuse la clé (401) : vérifier BREVO_CLE_API dans .env.local');
  if (!r.ok) throw new Error(`Brevo ${chemin} → ${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

async function releveBrevo() {
  const liste = await brevo(`/contacts/lists/${BREVO_LISTE}`);
  const r = await brevo('/emailCampaigns?status=sent&limit=50&sort=desc&excludeHtmlContent=true');
  const courriels = [];
  for (const c of r.campaigns || []) {
    if (!c.sentDate || new Date(c.sentDate) < debut || new Date(c.sentDate) > finPeriode) continue;
    const d = await brevo(`/emailCampaigns/${c.id}?excludeHtmlContent=true`);
    const st = d.statistics || {};
    // globalStats est parfois rendu à zéro alors que la campagne est partie (constaté le
    // 01/09/2026, voir outils/etat-brevo.mjs) : on additionne alors les statistiques par liste
    const parListe = st.campaignStats || [];
    const g = st.globalStats || {};
    const val = ch => g[ch] || parListe.reduce((t, x) => t + (x?.[ch] || 0), 0) || 0;
    // clics par lien : { "https://pausecardio.fr/?utm…#ancre": n } ; ancien format en liste toléré
    const liens = Array.isArray(st.linksStats)
      ? st.linksStats.map(l => [l.url || l.link, l.nbClick ?? l.clicks ?? 0])
      : Object.entries(st.linksStats || {});
    courriels.push({
      id: c.id, sujet: c.subject || c.name, date: c.sentDate.slice(0, 10),
      envoyes: val('sent'), delivres: val('delivered'), ouvreurs: val('uniqueViews'),
      cliqueurs: val('clickers') || val('uniqueClicks'), desinscriptions: val('unsubscriptions'),
      liens: liens.map(([url, n]) => ({ url, ancre: decodeURIComponent(String(url).split('#')[1] || ''), clics: Number(n) || 0 })),
    });
  }
  return { inscrits: liste.totalSubscribers ?? liste.uniqueSubscribers ?? 0, desinscrits: liste.totalBlacklisted ?? 0, nomListe: liste.name, courriels };
}

/* -------------------------------------------------------------- assemblage */
const SORTES = ['fiche', 'original', 'analyse', 'partage', 'favori', 'lu', 'vers-site'];
const NOMS_SCHEMA = { g: 'moteur', c: 'campagne', h: 'site', o: 'autre' };

function assembler(g, b) {
  const tableaux = {};
  const parSorte = {};       // sorte → { ancre → visiteurs }
  const autres = {};         // tiroir/…, recherche/…, appli/…, inscription, semaine/…
  const pages = [];
  for (const h of g?.chemins || []) {
    const p = h.path.replace(/^\//, '');
    if (!h.event) { pages.push({ page: h.path, titre: h.title || '', visiteurs: h.count }); continue; }
    const [sorte, ...reste] = p.split('/');
    const cle = reste.join('/');
    if (SORTES.includes(sorte) && cle) {
      (parSorte[sorte] ||= {})[cle] = ((parSorte[sorte] ||= {})[cle] || 0) + h.count;
      if (!articles.has(cle) && h.title) articles.set(cle, { titre: h.title, surspecialite: '', paru: '' });
    } else autres[p] = (autres[p] || 0) + h.count;
  }
  // visites des pages d'article (/fiche/<ancre>/) : l'arrivée par les moteurs de recherche
  const pagesFiche = {};
  for (const p of pages) {
    const m = p.page.match(/^\/fiche\/([^/]+)\/?$/);
    if (!m) continue;
    pagesFiche[m[1]] = (pagesFiche[m[1]] || 0) + p.visiteurs;
    if (!articles.has(m[1]) && p.titre) articles.set(m[1], { titre: titreDe('', p.titre), surspecialite: '', paru: '' });
  }
  // clics depuis les courriels, par article
  const clicsCourriel = {};
  for (const c of b?.courriels || []) for (const l of c.liens) if (l.ancre) clicsCourriel[l.ancre] = (clicsCourriel[l.ancre] || 0) + l.clics;

  const n = (sorte, a) => parSorte[sorte]?.[a] || 0;
  const ancres = new Set([...SORTES.flatMap(s => Object.keys(parSorte[s] || {})), ...Object.keys(pagesFiche), ...Object.keys(clicsCourriel)]);
  tableaux.articles = [...ancres].map(a => ({
    ancre: a, titre: titreDe(a), surspecialite: articles.get(a)?.surspecialite || '',
    fiches_ouvertes: n('fiche', a), clics_original: n('original', a), clics_analyse: n('analyse', a),
    partages: n('partage', a), favoris: n('favori', a), lus: n('lu', a),
    visites_page_article: pagesFiche[a] || 0, passages_vers_site: n('vers-site', a), clics_courriel: clicsCourriel[a] || 0,
  })).map(r => ({ ...r, score: r.fiches_ouvertes + r.visites_page_article + r.clics_courriel + 2 * (r.clics_original + r.partages + r.favoris) }))
    .sort((x, y) => y.score - x.score);

  const somme = sorte => Object.values(parSorte[sorte] || {}).reduce((t, x) => t + x, 0);
  const sommeAutres = prefixe => Object.entries(autres).filter(([k]) => k === prefixe || k.startsWith(prefixe + '/')).reduce((t, [, v]) => t + v, 0);
  const nbCourriels = b?.courriels?.length || 0;
  tableaux.resume = [{
    debut: jourIso(debut), fin: jourIso(fin), releve_le: maintenant.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    visiteurs: g?.total?.total ?? null, visiteurs_periode_precedente: g?.precedent?.total ?? null,
    evolution_pct: g?.total && g?.precedent?.total ? Math.round(100 * (g.total.total - g.precedent.total) / g.precedent.total) : null,
    fiches_ouvertes: somme('fiche'), clics_original: somme('original'), clics_analyse: somme('analyse'),
    partages: somme('partage'), favoris: somme('favori'), lus: somme('lu'),
    visites_pages_article: Object.values(pagesFiche).reduce((t, x) => t + x, 0),
    inscriptions_site: sommeAutres('inscription'),
    appli_lancements: autres['appli/lancement'] || 0, appli_installations: autres['appli/installee'] || 0,
    recherches: sommeAutres('recherche'), recherches_sans_resultat: sommeAutres('recherche-vide'),
    inscrits: b?.inscrits ?? null, desinscrits: b?.desinscrits ?? null,
    courriels_envoyes: b ? nbCourriels : null,
    taux_ouverture_moyen: nbCourriels ? Math.round(100 * b.courriels.reduce((t, c) => t + (c.delivres ? c.ouvreurs / c.delivres : 0), 0) / nbCourriels) : null,
    taux_clic_moyen: nbCourriels ? Math.round(100 * b.courriels.reduce((t, c) => t + (c.delivres ? c.cliqueurs / c.delivres : 0), 0) / nbCourriels) : null,
  }];

  // visiteurs par jour, période en cours et précédente alignées jour à jour
  const jours = (g?.total?.stats || []).map(s => ({ jour: s.day, visiteurs: s.daily || 0 }));
  const avant = (g?.precedent?.stats || []).map(s => s.daily || 0);
  tableaux.visites_jour = jours.map((j, i) => ({ ...j, periode_precedente: avant[i] ?? null }));

  tableaux.sources = (g?.sources || []).map(s => ({
    source: s.name || '(accès direct)', sorte: s.name ? (NOMS_SCHEMA[s.ref_scheme] || 'autre') : 'direct', visiteurs: s.count,
  }));
  tableaux.campagnes = (g?.campagnes || []).map(s => ({ campagne: s.name, visiteurs: s.count }));
  tableaux.appareils = [
    ...(g?.systemes || []).map(s => ({ categorie: 'Système', nom: s.name || '(inconnu)', visiteurs: s.count })),
    ...(g?.navigateurs || []).map(s => ({ categorie: 'Navigateur', nom: s.name || '(inconnu)', visiteurs: s.count })),
    ...(g?.tailles || []).map(s => ({ categorie: 'Écran', nom: s.name || '(inconnu)', visiteurs: s.count })),
  ];
  tableaux.pays = (g?.pays || []).map(s => ({ pays: s.name || '(inconnu)', visiteurs: s.count }));
  tableaux.pages = pages.filter(p => !p.page.startsWith('/fiche/')).sort((x, y) => y.visiteurs - x.visiteurs);
  tableaux.tiroirs = Object.entries(autres).filter(([k]) => k.startsWith('tiroir/'))
    .map(([k, v]) => ({ surspecialite: SPECS[k.slice(7)] || k.slice(7), ouvertures: v })).sort((x, y) => y.ouvertures - x.ouvertures);
  tableaux.recherches = Object.entries(autres).filter(([k]) => /^recherche(-vide)?\//.test(k))
    .map(([k, v]) => ({ terme: k.replace(/^recherche(-vide)?\//, ''), trouve: k.startsWith('recherche-vide/') ? 'non' : 'oui', visiteurs: v }))
    .sort((x, y) => y.visiteurs - x.visiteurs);
  tableaux.courriels = (b?.courriels || []).map(c => ({
    date: c.date, sujet: c.sujet, envoyes: c.envoyes, delivres: c.delivres, ouvreurs: c.ouvreurs, cliqueurs: c.cliqueurs,
    desinscriptions: c.desinscriptions,
    taux_ouverture: c.delivres ? Math.round(100 * c.ouvreurs / c.delivres) : null,
    taux_clic: c.delivres ? Math.round(100 * c.cliqueurs / c.delivres) : null,
    visiteurs_amenes: (g?.campagnes || []).find(s => s.name === 'bulletin-' + c.date)?.count ?? null,
  })).sort((x, y) => y.date.localeCompare(x.date));
  return tableaux;
}

/* ------------------------------------------------------------------ main */
if (!CLE_GC && !CLE_BREVO) {
  console.log('Aucune clé trouvée : créer .env.local à la racine avec GOATCOUNTER_CLE=… et BREVO_CLE_API=…');
  process.exit(1);
}
console.log(`PERIODE ${jourIso(debut)} → ${jourIso(fin)} (comparée à ${jourIso(debutPrecedent)} → ${jourIso(debut)})`);
let g = null, b = null;
if (CLE_GC) { try { g = await releveGoatCounter(); console.log(`GOATCOUNTER ${g.total.total} visiteurs, ${g.chemins.length} pages et gestes distincts`); } catch (e) { console.log('GOATCOUNTER ERREUR ' + e.message); } }
else console.log('GOATCOUNTER clé absente — partie sautée');
if (CLE_BREVO) { try { b = await releveBrevo(); console.log(`BREVO ${b.inscrits} inscrits, ${b.courriels.length} courriel(s) sur la période`); } catch (e) { console.log('BREVO ERREUR ' + e.message); } }
else console.log('BREVO clé absente — partie sautée');
if (!g && !b) process.exit(1);

const tableaux = assembler(g, b);
mkdirSync(SORTIE, { recursive: true });
for (const [nom, lignes] of Object.entries(tableaux)) writeFileSync(join(SORTIE, nom + '.json'), JSON.stringify(lignes, null, 1));
const r = tableaux.resume[0];
console.log(`ECRIT ${Object.keys(tableaux).length} fichiers dans frequentation/`);
console.log(`RESUME visiteurs=${r.visiteurs} (avant ${r.visiteurs_periode_precedente}) fiches=${r.fiches_ouvertes} originaux=${r.clics_original} partages=${r.partages} inscrits=${r.inscrits}`);
