#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — envoie le bulletin de la semaine aux inscrits, via Brevo.
 *
 * Prend le dernier bulletin/courriel-AAAA-MM-JJ.html (ou celui passé en
 * argument), en fait une campagne Brevo adressée à la liste des inscrits,
 * et l'envoie immédiatement. Brevo remplace {{ unsubscribe }} par le lien
 * de désinscription propre à chaque destinataire.
 *
 * Usage :  node outils/envoyer-courriel.mjs [bulletin/courriel-....html] [--essai]
 *   --essai : montre ce qui partirait (sujet, liste, taille) sans rien envoyer.
 *
 * Réglages, lus dans l'environnement (jamais écrits dans le dépôt) :
 *   BREVO_CLE_API   la clé API Brevo — absente, l'envoi est ignoré sans erreur
 *   BREVO_LISTE_ID  numéro de la liste destinataire (défaut : 3,
 *                   « Bulletin Pause Cardio »)
 * --------------------------------------------------------------------------- */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE  = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'bulletin');

const args   = process.argv.slice(2);
const essai  = args.includes('--essai');
const donne  = args.find(a => !a.startsWith('--'));

const fichier = donne
  ? join(RACINE, donne)
  : (() => {
      const c = readdirSync(DOSSIER)
        .filter(f => /^courriel-\d{4}-\d{2}-\d{2}\.html$/.test(f))
        .sort().pop();
      return c ? join(DOSSIER, c) : null;
    })();

if (!fichier) {
  console.log('Aucun courriel de bulletin trouvé — rien à envoyer.');
  process.exit(0);
}
if (/courriel-apercu/.test(fichier) && !donne && !essai) {
  // en mode automatique l'aperçu ne part jamais ; nommé explicitement, c'est un envoi voulu
  console.error('Refus : courriel-apercu.html ne part pas en mode automatique.');
  process.exit(1);
}

const html  = readFileSync(fichier, 'utf8');
const sujet = (html.match(/<title>([^<]*)<\/title>/) || [, 'Pause Cardio — bulletin de la semaine'])[1]
  .replace(/&mdash;/g, '—').trim();
const liste = Number(process.env.BREVO_LISTE_ID || 3);
const cle   = process.env.BREVO_CLE_API || '';

console.log(`Courriel : ${basename(fichier)} (${(html.length / 1024).toFixed(1)} ko)`);
console.log(`Sujet    : ${sujet}`);
console.log(`Liste    : ${liste}`);

if (essai) { console.log('ESSAI — rien n\'est parti.'); process.exit(0); }
if (!cle)  { console.log('BREVO_CLE_API absente — envoi ignoré.'); process.exit(0); }

const api = async (chemin, corps) => {
  const r = await fetch('https://api.brevo.com/v3' + chemin, {
    method: 'POST',
    headers: { 'api-key': cle, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(corps ?? {}),
  });
  const texte = await r.text();
  if (!r.ok) throw new Error(`${chemin} → ${r.status} ${texte}`);
  return texte ? JSON.parse(texte) : {};
};

const campagne = await api('/emailCampaigns', {
  name: sujet,
  subject: sujet,
  sender: { name: 'Pause Cardio', email: 'contact@pausecardio.fr' },
  htmlContent: html,
  recipients: { listIds: [liste] },
});
console.log(`Campagne créée (id ${campagne.id}), envoi…`);
await api(`/emailCampaigns/${campagne.id}/sendNow`);
console.log('ENVOYÉ.');
