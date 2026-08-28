#!/usr/bin/env node
/* -----------------------------------------------------------------------------
 * Pause Cardio — état des campagnes et de la liste des inscrits chez Brevo.
 * Diagnostic en lecture seule : n'envoie rien, ne modifie rien.
 *
 * Usage :  node outils/etat-brevo.mjs
 * Environnement : BREVO_CLE_API (requis), BREVO_LISTE_ID (défaut 3)
 * --------------------------------------------------------------------------- */

const cle   = process.env.BREVO_CLE_API || '';
const liste = Number(process.env.BREVO_LISTE_ID || 3);
if (!cle) { console.log('BREVO_CLE_API absente — rien à consulter.'); process.exit(0); }

const api = async chemin => {
  const r = await fetch('https://api.brevo.com/v3' + chemin, {
    headers: { 'api-key': cle, accept: 'application/json' },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${chemin} → ${r.status} ${t}`);
  return JSON.parse(t);
};

const l = await api(`/contacts/lists/${liste}`);
console.log(`LISTE ${liste} « ${l.name} » : ${l.totalSubscribers} inscrit(s), ${l.totalBlacklisted} désinscrit(s)`);

const c = await api('/emailCampaigns?limit=5&sort=desc');
for (const camp of c.campaigns ?? []) {
  const s = camp.statistics?.globalStats || {};
  console.log(`CAMPAGNE ${camp.id} « ${camp.name} » : statut=${camp.status}`
    + (camp.sentDate ? ` envoyée=${camp.sentDate}` : '')
    + ` · destinataires=${s.sent ?? '?'} délivrés=${s.delivered ?? '?'} ouverts=${s.uniqueViews ?? '?'}`);
}
