#!/usr/bin/env node
// Notification « nouvelles sorties » de l'application Pause Cardio.
//
// Compose le message à partir de la liste du dernier courriel publiée par le site
// (https://pausecardio.fr/bulletin/semaine.json) et l'envoie, par Firebase Cloud Messaging,
// à tous les téléphones abonnés au sujet « hebdo » (ceux qui ont activé les notifications
// dans les Réglages de l'appli). Aucune adresse, aucun identifiant de téléphone n'est stocké :
// c'est Firebase qui tient la liste des abonnés au sujet.
//
// Usage :
//   node appli/outils/notifier.mjs            envoi réel
//   node appli/outils/notifier.mjs --essai    affiche le message sans rien envoyer
//   node appli/outils/notifier.mjs --test     envoi réel, titre préfixé « [Test] »
//   --sujet=hebdo                             sujet visé (par défaut « hebdo »)
//   --forcer                                  envoie même une semaine calme
//
// Secret : FIREBASE_SERVICE_ACCOUNT = contenu du fichier JSON du compte de service Firebase.
// Sans lui, le script s'arrête proprement (« envoi ignoré »).

import crypto from 'node:crypto';

const args = process.argv.slice(2);
const essai = args.includes('--essai');
const test = args.includes('--test');
const forcer = args.includes('--forcer');
const sujet = (args.find(a => a.startsWith('--sujet=')) || '--sujet=hebdo').slice(8);
const SITE = 'https://pausecardio.fr/';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

async function lireSemaine() {
  const r = await fetch(SITE + 'bulletin/semaine.json?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('semaine.json illisible (' + r.status + ')');
  return r.json();
}

function composer(s) {
  const nb = Number(s.nb) || (Array.isArray(s.ancres) ? s.ancres.length : 0);
  const campagne = 'notif-' + (s.date || new Date().toISOString().slice(0, 10));
  const lien = SITE + '?utm_source=notification&utm_campaign=' + campagne;
  let titre, corps;
  if (s.congres) {
    titre = 'Récapitulatif ' + s.congres;
    corps = nb > 1 ? `Les ${nb} sorties du congrès sont rassemblées dans Pause Cardio.`
      : 'La sortie du congrès est en ligne dans Pause Cardio.';
  } else if (s.rappel || nb === 0) {
    titre = 'Semaine calme';
    corps = 'Aucune sortie d’ampleur n’est parue cette semaine. Les dernières fiches restent en ligne.';
  } else {
    titre = nb > 1 ? `${nb} nouvelles sorties cette semaine` : 'Une nouvelle sortie cette semaine';
    let quand = '';
    if (s.lundi) {
      const [, m, j] = s.lundi.split('-').map(Number);
      quand = ` de la semaine du lundi ${j === 1 ? '1er' : j} ${MOIS[m - 1]}`;
    }
    corps = (nb > 1 ? `Les fiches${quand} sont en ligne.` : `La fiche${quand} est en ligne.`)
      + ' Lecture en deux minutes.';
  }
  if (test) titre = '[Test] ' + titre;
  return { titre, corps, lien, calme: !s.congres && (s.rappel || nb === 0) };
}

function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }

async function jeton(compte) {
  const t = Math.floor(Date.now() / 1000);
  const corps = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: compte.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: t, exp: t + 3600,
  });
  const signature = crypto.sign('RSA-SHA256', Buffer.from(corps), compte.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: corps + '.' + signature,
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error('jeton Google refusé : ' + JSON.stringify(j));
  return j.access_token;
}

async function principal() {
  const semaine = await lireSemaine();
  const m = composer(semaine);
  console.log('SUJET    ' + sujet);
  console.log('TITRE    ' + m.titre);
  console.log('TEXTE    ' + m.corps);
  console.log('LIEN     ' + m.lien);
  if (m.calme && !forcer) { console.log('CALME    semaine sans sortie : pas de notification (--forcer pour envoyer)'); return; }
  if (essai) { console.log('ESSAI    rien n’est envoyé'); return; }

  const brut = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  if (!brut.trim()) { console.log('IGNORE   secret FIREBASE_SERVICE_ACCOUNT absent : envoi ignoré'); return; }
  const compte = JSON.parse(brut);
  const acces = await jeton(compte);
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${compte.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + acces, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        topic: sujet,
        notification: { title: m.titre, body: m.corps },
        data: { lien: m.lien },
        apns: { payload: { aps: { sound: 'default' } } },
      },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Firebase a refusé l’envoi : ' + JSON.stringify(j));
  console.log('ENVOYE   ' + (j.name || 'ok'));
}

principal().catch(e => { console.error('ERREUR   ' + e.message); process.exit(1); });
