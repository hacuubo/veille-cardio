#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — chien de garde : vérifie, indépendamment de la routine, que ce
 * qui devait être publié aujourd'hui l'a bien été.
 *
 * Lancé par .github/workflows/chien-de-garde.yml chaque matin après l'heure
 * d'envoi (et à la main : Actions → « Chien de garde » → Run workflow).
 *
 * Usage :  node outils/chien-de-garde.mjs [--date=AAAA-MM-JJ]
 *
 * Ce qu'il attend, selon le MODE que donne outils/congres.mjs :
 *   SAMEDI            → bulletin/courriel-<aujourd'hui>.html présent sur main
 *                        (courriel des sorties ou « Semaine calme », il y en a
 *                        toujours un : c'est la règle « toutes les semaines sans
 *                        exception »)
 *   CLOTURE_HIER      → idem : le récapitulatif du congrès
 *   CONGRES_EN_COURS  → au moins un commit sur main aujourd'hui (le site est
 *                        mis à jour chaque matin de congrès, sans courriel)
 *   RIEN              → rien à vérifier
 *
 * Sortie : VERDICT OK ou VERDICT ALERTE <raison>, code 1 en cas d'alerte. Le
 * workflow envoie alors un e-mail d'alerte (mêmes secrets Gmail que le bulletin)
 * et échoue, ce qui déclenche aussi la notification GitHub.
 * --------------------------------------------------------------------------- */

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (process.argv.find(a => a.startsWith('--date=')) || '').slice(7);
const aujourdhui = arg || new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const calendrier = execFileSync('node', [join(RACINE, 'outils', 'congres.mjs'), '--date=' + aujourdhui], { encoding: 'utf8' });
const mode = (calendrier.match(/^MODE (\S+)(.*)$/m) || [, 'RIEN', ''])[1];
const sigle = ((calendrier.match(/^MODE \S+ (.*)$/m) || [, ''])[1]).replace(/ jour .*$/, '').trim();

const courriel = join(RACINE, 'bulletin', `courriel-${aujourdhui}.html`);
const problemes = [];

function commitsDuJour() {
  try {
    const log = execFileSync('git', ['log', '--since=' + aujourdhui + 'T00:00:00+02:00', '--format=%h %cI %s'], { cwd: RACINE, encoding: 'utf8' });
    // %cI donne l'heure du commit avec son fuseau ; on retient ceux dont le jour de Paris est aujourd'hui
    return log.split('\n').filter(Boolean).filter(l => {
      const iso = l.split(' ')[1];
      return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) === aujourdhui;
    });
  } catch (e) { return []; }
}

console.log(`AUJOURDHUI ${aujourdhui} · MODE ${mode}${sigle ? ' ' + sigle : ''}`);

if (mode === 'SAMEDI' || mode === 'CLOTURE_HIER') {
  const quoi = mode === 'SAMEDI' ? 'le courriel du samedi' : `le récapitulatif du congrès ${sigle}`;
  if (!existsSync(courriel)) {
    problemes.push(`${quoi} n'est pas sur main : bulletin/courriel-${aujourdhui}.html est absent. La routine n'a pas publié (ou n'a pas poussé) ; aucun envoi n'a pu partir.`);
  } else {
    console.log(`OK bulletin/courriel-${aujourdhui}.html présent`);
  }
} else if (mode === 'CONGRES_EN_COURS') {
  const commits = commitsDuJour();
  if (!commits.length) problemes.push(`congrès ${sigle} en cours et aucun commit sur main aujourd'hui : la mise à jour quotidienne du site n'a pas eu lieu.`);
  else console.log(`OK ${commits.length} commit(s) aujourd'hui : ${commits[0]}`);
} else {
  console.log('Rien à vérifier aujourd\'hui.');
}

if (problemes.length) {
  problemes.forEach(p => console.log('VERDICT ALERTE ' + p));
  process.exit(1);
}
console.log('VERDICT OK');
