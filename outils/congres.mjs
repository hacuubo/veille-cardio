#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — lecture du calendrier des congrès (outils/congres.json).
 *
 * La routine du matin l'appelle AVANT toute recherche web : il lui dit, sans
 * interprétation, dans quel mode elle se trouve et ce qu'il reste à vérifier.
 *
 * Usage :  node outils/congres.mjs [--date=AAAA-MM-JJ]
 *
 * Sortie (une information par ligne, faciles à lire par un humain ou un script) :
 *   AUJOURDHUI <date> <jour>
 *   MODE CONGRES_EN_COURS <sigle> jour k/n     un congrès de niveau 1 est en cours
 *   MODE CLOTURE_HIER <sigle>                  il s'est terminé hier → récapitulatif
 *   MODE SAMEDI                                veille hebdomadaire + courriel
 *   MODE RIEN                                  rien à faire aujourd'hui
 *   NIVEAU2_EN_COURS <sigle>                   pour info (repris par la veille du samedi)
 *   PROCHAIN <sigle> | <ville> | <debut> → <fin> | niveau <n>   (les 6 à venir)
 *   A_VERIFIER <consigne>                      dates manquantes, non confirmées,
 *                                              ou édition suivante à chercher
 * --------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const { congres } = JSON.parse(readFileSync(join(ICI, 'congres.json'), 'utf8'));

const arg = (process.argv.find(a => a.startsWith('--date=')) || '').slice(7);
const aujourdhui = arg || new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const d = new Date(aujourdhui + 'T12:00:00Z');
const jour = JOURS[d.getUTCDay()];
const hier = new Date(d); hier.setUTCDate(d.getUTCDate() - 1);
const hierIso = hier.toISOString().slice(0, 10);
const nbJours = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);

const dates = congres.filter(c => c.debut && c.fin);
const enCours = dates.filter(c => c.debut <= aujourdhui && aujourdhui <= c.fin);
const clotHier = dates.filter(c => c.fin === hierIso);

console.log(`AUJOURDHUI ${aujourdhui} ${jour}`);

const n1 = enCours.find(c => c.niveau === 1);
const c1 = clotHier.find(c => c.niveau === 1);
if (n1) {
  console.log(`MODE CONGRES_EN_COURS ${n1.sigle} jour ${nbJours(n1.debut, aujourdhui) + 1}/${nbJours(n1.debut, n1.fin) + 1}`);
  if (jour === 'samedi') console.log('SAMEDI_DANS_CONGRES oui — pas de courriel hebdomadaire, le récapitulatif le remplacera');
} else if (c1) {
  console.log(`MODE CLOTURE_HIER ${c1.sigle}`);
} else if (jour === 'samedi') {
  console.log('MODE SAMEDI');
} else {
  console.log('MODE RIEN');
}
enCours.filter(c => c.niveau === 2).forEach(c => console.log(`NIVEAU2_EN_COURS ${c.sigle}`));
clotHier.filter(c => c.niveau === 2).forEach(c => console.log(`NIVEAU2_CLOTURE_HIER ${c.sigle}`));

const prochains = dates.filter(c => c.debut > aujourdhui).sort((a, b) => a.debut.localeCompare(b.debut)).slice(0, 6);
prochains.forEach(c => console.log(`PROCHAIN ${c.sigle} | ${c.ville || '?'} | ${c.debut} → ${c.fin} | niveau ${c.niveau}${c.confirme ? '' : ' | À CONFIRMER'}`));

/* ---- ce qu'il reste à vérifier ---- */
const aVerifier = [];
for (const c of congres) {
  if (!c.debut || !c.fin) aVerifier.push(`${c.sigle} : dates inconnues — les relever (${c.source})`);
  else if (!c.confirme && c.debut > aujourdhui) aVerifier.push(`${c.sigle} : dates non confirmées sur le site officiel (${c.source})`);
}
// édition suivante à chercher : la dernière édition connue d'une famille est passée
const familles = new Map();
for (const c of congres) {
  const prev = familles.get(c.famille);
  if (!prev || (c.fin || '') > (prev.fin || '')) familles.set(c.famille, c);
}
for (const [fam, c] of familles) {
  if (c.fin && c.fin < aujourdhui) {
    const annee = Number(c.fin.slice(0, 4)) + 1;
    aVerifier.push(`famille ${fam} : chercher les dates de l'édition ${annee} (site officiel) et l'ajouter à outils/congres.json`);
  }
}
if (jour === 'samedi' && aujourdhui.slice(5, 7) === '01' && Number(aujourdhui.slice(8, 10)) <= 7) {
  aVerifier.push('premier samedi de janvier : revérifier toutes les dates de l\'année sur les sites officiels');
}
aVerifier.forEach(v => console.log('A_VERIFIER ' + v));
