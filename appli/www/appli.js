/*
 * Réglages propres à l'application iPhone Pause Cardio (bêta).
 *
 * Ce fichier n'existe QUE dans l'application : il est glissé dans la page par le code natif
 * (ios/App/App/AppDelegate.swift, classe PauseCardioViewController) au moment où l'application
 * affiche https://pausecardio.fr. Le site lui-même, et l'appli installée depuis le navigateur,
 * ne le voient jamais : rien ici ne modifie leur rendu.
 *
 * Ce qu'il ajoute, tout sous la classe « pc-appli » posée sur <html> :
 *  - les marges de l'encoche et de la barre d'accueil (hauteur fournie par iOS) ;
 *  - une barre d'onglets en bas : Accueil, Favoris, Lus, Rechercher, Réglages ;
 *  - les surspécialités favorites (punaise dans la tête de chaque surspécialité), épinglées en tête ;
 *  - une feuille « Réglages » : notifications du samedi, surspécialités favorites, à propos ;
 *  - les notifications (module Firebase), actives seulement quand la version les embarque.
 *
 * Mémoire propre à l'appli (sur le téléphone, jamais envoyée) :
 *  pc-appli-suivies  liste des surspécialités favorites (codes data-spec)
 *  pc-appli-notif    « oui » si le lecteur a demandé les notifications
 */
(function () {
  if (window.__pcAppli) return;
  window.__pcAppli = true;

  var racine = document.documentElement;
  racine.classList.add('pc-appli', 'pc-appli-ios');
  if (window.__pcHautNatif) racine.style.setProperty('--pc-haut-natif', window.__pcHautNatif + 'px');
  if (window.__pcBasNatif) racine.style.setProperty('--pc-bas-natif', window.__pcBasNatif + 'px');

  var ONGLETS = 54;   // hauteur de la barre d'onglets, en pixels

  var css = [
    'html.pc-appli {',
    '  --pc-haut: max(env(safe-area-inset-top, 0px), var(--pc-haut-natif, 0px));',
    '  --pc-bas: max(env(safe-area-inset-bottom, 0px), var(--pc-bas-natif, 0px));',
    '  -webkit-tap-highlight-color: transparent; touch-action: manipulation; -webkit-text-size-adjust: 100%; }',
    'html.pc-appli body { padding-top: var(--pc-haut); padding-bottom: calc(' + ONGLETS + 'px + var(--pc-bas)); }',
    /* bandeau opaque sous l'heure et la batterie */
    'html.pc-appli body::before { content: ""; position: fixed; top: 0; left: 0; right: 0;',
    '  height: var(--pc-haut); background: var(--page, #f9f9f7); z-index: 150; pointer-events: none; }',
    'html.pc-appli .spec-h { top: var(--pc-haut) !important; }',
    'html.pc-appli #toast { bottom: calc(' + (ONGLETS + 16) + 'px + var(--pc-bas)) !important; }',
    /* ce qui fait doublon avec l'appli */
    'html.pc-appli section.instal, html.pc-appli .pc-masque { display: none !important; }',

    /* barre d'onglets */
    '.pc-onglets { position: fixed; left: 0; right: 0; bottom: 0; z-index: 170; display: flex;',
    '  padding: 4px 4px var(--pc-bas); height: calc(' + ONGLETS + 'px + var(--pc-bas)); box-sizing: border-box;',
    '  background: color-mix(in srgb, var(--surface-1, #fff) 92%, transparent);',
    '  -webkit-backdrop-filter: saturate(180%) blur(18px); backdrop-filter: saturate(180%) blur(18px);',
    '  border-top: 1px solid var(--border, rgba(0,0,0,.12)); }',
    '.pc-onglets button { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;',
    '  gap: 2px; border: 0; background: none; color: var(--text-muted, #8a897f); font: inherit; font-size: 10.5px;',
    '  font-weight: 600; letter-spacing: .01em; padding: 2px 0; min-height: 44px; }',
    '.pc-onglets button svg { width: 24px; height: 24px; }',
    '.pc-onglets button[aria-current="true"] { color: var(--brand, #d03b3b); }',
    '.pc-onglets .pc-pastille { position: absolute; margin-left: 22px; margin-top: -2px; min-width: 16px; height: 16px;',
    '  padding: 0 4px; border-radius: 8px; background: var(--brand, #d03b3b); color: #fff; font-size: 10px;',
    '  line-height: 16px; text-align: center; box-sizing: border-box; }',
    '.pc-onglets .pc-icone { position: relative; display: flex; }',

    /* étoile « suivre » dans la tête de surspécialité */
    '.pc-suivre { flex: none; width: 36px; height: 36px; margin: -6px -4px -6px 2px; border: 0; background: none;',
    '  color: var(--text-muted, #8a897f); padding: 0; display: flex; align-items: center; justify-content: center; }',
    '.pc-suivre svg { width: 19px; height: 19px; }',
    '.pc-suivre[aria-pressed="true"] svg { fill: currentColor; }',
    '.pc-suivre[aria-pressed="true"] { color: var(--brand, #d03b3b); }',

    /* feuille Réglages */
    '.pc-reglages { position: fixed; inset: 0; z-index: 190; background: rgba(0,0,0,.32); display: flex; align-items: flex-end;',
    '  opacity: 0; transition: opacity .2s ease; }',
    '.pc-reglages[hidden] { display: none; }',
    '.pc-reglages.ouvert { opacity: 1; }',
    '.pc-feuille { width: 100%; max-height: calc(100% - var(--pc-haut) - 10px); overflow-y: auto; -webkit-overflow-scrolling: touch;',
    '  background: var(--page, #f9f9f7); color: var(--text-primary, #141412); border-radius: 16px 16px 0 0;',
    '  padding: 0 18px calc(24px + var(--pc-bas)); box-sizing: border-box; transform: translateY(24px);',
    '  transition: transform .25s cubic-bezier(.2,.8,.2,1); }',
    '.pc-reglages.ouvert .pc-feuille { transform: none; }',
    '.pc-feuille-h { position: sticky; top: 0; display: flex; align-items: center; padding: 16px 0 10px;',
    '  background: var(--page, #f9f9f7); z-index: 1; }',
    '.pc-feuille-h h2 { font-size: 20px; margin: 0; flex: 1; }',
    '.pc-feuille-h button { border: 0; background: none; color: var(--brand, #d03b3b); font: inherit;',
    '  font-size: 16px; font-weight: 600; padding: 8px 0 8px 12px; }',
    '.pc-bloc { margin-top: 18px; }',
    '.pc-bloc h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted, #8a897f);',
    '  margin: 0 0 8px 2px; }',
    '.pc-carte { background: var(--surface-1, #fff); border: 1px solid var(--border, rgba(0,0,0,.1));',
    '  border-radius: 12px; overflow: hidden; }',
    '.pc-ligne { display: flex; align-items: center; gap: 12px; padding: 12px 14px; min-height: 48px; box-sizing: border-box; }',
    '.pc-ligne + .pc-ligne { border-top: 1px solid var(--border, rgba(0,0,0,.08)); }',
    '.pc-ligne .pc-txt { flex: 1; font-size: 15.5px; line-height: 1.3; }',
    '.pc-ligne .pc-txt small { display: block; font-size: 12.5px; color: var(--text-secondary, #5f5e58); margin-top: 2px; }',
    '.pc-ligne .pc-point { width: 10px; height: 10px; border-radius: 50%; flex: none; }',
    '.pc-ligne a { color: inherit; text-decoration: none; flex: 1; font-size: 15.5px; }',
    '.pc-note { font-size: 12.5px; color: var(--text-secondary, #5f5e58); margin: 8px 4px 0; line-height: 1.4; }',
    '.pc-etat { font-size: 12.5px; color: var(--text-secondary, #5f5e58); margin: 8px 4px 0; min-height: 1em; }',
    /* interrupteur */
    '.pc-inter { position: relative; flex: none; width: 51px; height: 31px; }',
    '.pc-inter input { position: absolute; inset: 0; opacity: 0; margin: 0; z-index: 1; }',
    '.pc-inter span { position: absolute; inset: 0; border-radius: 16px; background: var(--border, #d6d5ce); transition: background .2s; }',
    '.pc-inter span::after { content: ""; position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%;',
    '  background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,.25); transition: transform .2s; }',
    '.pc-inter input:checked + span { background: #34c759; }',
    '.pc-inter input:checked + span::after { transform: translateX(20px); }',
    '.pc-inter input:disabled + span { opacity: .45; }',

    /* petit message */
    '.pc-toast { position: fixed; left: 50%; bottom: calc(' + (ONGLETS + 16) + 'px + var(--pc-bas)); z-index: 195;',
    '  transform: translate(-50%, 8px); opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;',
    '  background: var(--text-primary, #141412); color: var(--page, #fff); padding: 9px 16px; border-radius: 999px;',
    '  font-size: 13px; font-weight: 600; max-width: 86vw; text-align: center; }',
    '.pc-toast.on { opacity: 1; transform: translate(-50%, 0); }'
  ].join('\n');

  function poserStyle() {
    if (document.getElementById('pc-appli-style')) return;
    var s = document.createElement('style');
    s.id = 'pc-appli-style';
    s.textContent = css;
    (document.head || racine).appendChild(s);
  }

  // Le site déclare son viewport sans « viewport-fit=cover » : on le complète dans l'appli
  // (la hauteur exacte de l'encoche est de toute façon fournie par iOS, --pc-haut-natif).
  function completerViewport() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) return false;
    if (!/viewport-fit/.test(m.content)) m.content = m.content + ', viewport-fit=cover';
    return true;
  }

  poserStyle();
  if (!completerViewport()) {
    var guet = new MutationObserver(function () {
      if (document.head) poserStyle();
      if (completerViewport()) guet.disconnect();
    });
    guet.observe(racine, { childList: true, subtree: true });
  }

  // ---------- petits outils ----------
  function lireListe(cle) {
    try { var v = JSON.parse(localStorage.getItem(cle) || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function garderListe(cle, liste) { try { localStorage.setItem(cle, JSON.stringify(liste)); } catch (e) {} }
  function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }
  function garder(cle, v) { try { if (v == null) localStorage.removeItem(cle); else localStorage.setItem(cle, v); } catch (e) {} }

  var minuterie = null;
  function annoncer(texte) {
    var t = document.querySelector('.pc-toast');
    if (!t) { t = document.createElement('div'); t.className = 'pc-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = texte;
    t.classList.add('on');
    clearTimeout(minuterie);
    minuterie = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  function haut() {
    var v = parseFloat(getComputedStyle(racine).getPropertyValue('--pc-haut-natif')) || 0;
    return v;
  }
  function allerA(el) {
    if (!el) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var y = el.getBoundingClientRect().top + window.pageYOffset - haut() - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  // ---------- surspécialités favorites (épinglées en tête) ----------
  // une punaise, pour ne pas confondre avec l'étoile « favori » des articles
  var EPINGLE = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" fill="none" '
    + 'stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'
    + '<path d="M9 3.5h6l-1 6.2 3.6 3.6v1.2H6.4v-1.2L10 9.7z"/><path d="M12 14.5v6"/></svg>';
  var suivies = new Set(lireListe('pc-appli-suivies'));

  function sections() { return Array.prototype.slice.call(document.querySelectorAll('section.spec')); }
  function nomSpec(sec) { var h = sec.querySelector('.spec-h h2'); return h ? h.textContent.trim() : sec.dataset.spec; }
  function couleurSpec(sec) { var d = sec.querySelector('.spec-h .dot'); return d ? d.style.background : ''; }

  var rangement = null;
  // Le site range les surspécialités de la plus fournie à la moins fournie, à chaque filtrage :
  // on remonte ensuite les suivies en tête, sans changer l'ordre du site entre elles.
  function ranger() {
    var secs = sections();
    if (secs.length < 2) return;
    var voulu = secs.filter(function (s) { return suivies.has(s.dataset.spec); })
      .concat(secs.filter(function (s) { return !suivies.has(s.dataset.spec); }));
    var pareil = voulu.every(function (s, i) { return s === secs[i]; });
    if (pareil) return;
    var parent = secs[0].parentNode, suite = secs[secs.length - 1].nextSibling;
    if (rangement) rangement.disconnect();
    voulu.forEach(function (s) { parent.insertBefore(s, suite); });
    if (rangement) rangement.observe(parent, { childList: true });
  }

  function peindreSuivies() {
    sections().forEach(function (sec) {
      var oui = suivies.has(sec.dataset.spec);
      sec.classList.toggle('pc-suivie', oui);
      var b = sec.querySelector('.pc-suivre');
      if (b) {
        b.setAttribute('aria-pressed', oui ? 'true' : 'false');
        if (!b.firstChild) b.innerHTML = EPINGLE;
        b.setAttribute('aria-label', (oui ? 'Retirer des favorites : ' : 'Épingler en tête : ') + nomSpec(sec));
      }
    });
    document.querySelectorAll('.pc-reglages input[data-spec]').forEach(function (i) { i.checked = suivies.has(i.dataset.spec); });
  }

  function basculerSuivie(code, oui) {
    if (oui) suivies.add(code); else suivies.delete(code);
    garderListe('pc-appli-suivies', Array.from(suivies));
    peindreSuivies();
    ranger();
    if (lire('pc-appli-notif') === 'oui') abonnerSpec(code, oui);
  }

  function poserEtoiles() {
    sections().forEach(function (sec) {
      var tete = sec.querySelector('.spec-h');
      if (!tete || tete.querySelector('.pc-suivre')) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pc-suivre';
      b.addEventListener('click', function (e) {
        e.stopPropagation();   // l'étoile ne doit pas ouvrir ou fermer le tiroir
        var oui = !suivies.has(sec.dataset.spec);
        basculerSuivie(sec.dataset.spec, oui);
        annoncer(oui ? nomSpec(sec) + ' : épinglée en tête de liste' : nomSpec(sec) + ' : retirée des favorites');
      });
      var chev = tete.querySelector('.spec-chev');
      tete.insertBefore(b, chev || null);
    });
    peindreSuivies();
    var secs = sections();
    if (secs.length) {
      rangement = new MutationObserver(ranger);
      rangement.observe(secs[0].parentNode, { childList: true });
      ranger();
    }
  }

  // ---------- notifications (module Firebase) ----------
  function moduleNotif() {
    var C = window.Capacitor;
    return C && C.Plugins && C.Plugins.FirebaseMessaging ? C.Plugins.FirebaseMessaging : null;
  }
  function notifDisponibles() { return !!(moduleNotif() && window.__pcPushConfig === true); }

  function abonner(sujet, oui) {
    var M = moduleNotif();
    if (!M) return Promise.resolve();
    var p = oui ? M.subscribeToTopic({ topic: sujet }) : M.unsubscribeFromTopic({ topic: sujet });
    return p.catch(function () {});
  }
  function abonnerSpec(code, oui) { return abonner('spec-' + code, oui); }

  function activerNotif() {
    var M = moduleNotif();
    if (!notifDisponibles()) return Promise.resolve('indisponible');
    return M.requestPermissions().then(function (r) {
      if (!r || r.receive !== 'granted') return 'refus';
      return M.getToken().then(function () {
        var travaux = [abonner('hebdo', true)];
        suivies.forEach(function (code) { travaux.push(abonnerSpec(code, true)); });
        return Promise.all(travaux).then(function () { garder('pc-appli-notif', 'oui'); return 'ok'; });
      });
    }).catch(function () { return 'erreur'; });
  }
  function couperNotif() {
    var travaux = [abonner('hebdo', false)];
    sections().forEach(function (sec) { travaux.push(abonnerSpec(sec.dataset.spec, false)); });
    garder('pc-appli-notif', null);
    return Promise.all(travaux);
  }

  // au lancement : si le lecteur les a demandées, on vérifie que l'abonnement tient toujours
  function entretenirNotif() {
    var M = moduleNotif();
    if (!M) return;
    try {
      M.addListener('notificationActionPerformed', function (ev) {
        var d = (ev && ev.notification && ev.notification.data) || {};
        if (d.lien && /^https:\/\/pausecardio\.fr\//.test(d.lien)) location.href = d.lien;
      });
    } catch (e) {}
    if (lire('pc-appli-notif') !== 'oui' || !notifDisponibles()) return;
    M.checkPermissions().then(function (r) {
      if (r && r.receive === 'granted') return M.getToken().then(function () {
        abonner('hebdo', true);
        suivies.forEach(function (code) { abonnerSpec(code, true); });
      });
    }).catch(function () {});
  }

  // ---------- feuille Réglages ----------
  var feuille = null;
  function batirReglages() {
    var voile = document.createElement('div');
    voile.className = 'pc-reglages';
    voile.hidden = true;
    var lignesSpecs = sections().map(function (sec) {
      return '<label class="pc-ligne"><span class="pc-point" style="background:' + couleurSpec(sec) + '"></span>'
        + '<span class="pc-txt">' + nomSpec(sec) + '</span>'
        + '<span class="pc-inter"><input type="checkbox" role="switch" data-spec="' + sec.dataset.spec + '"><span></span></span></label>';
    }).join('');
    voile.innerHTML =
      '<div class="pc-feuille" role="dialog" aria-modal="true" aria-label="Réglages">'
      + '<div class="pc-feuille-h"><h2>Réglages</h2><button type="button" class="pc-fermer">Terminé</button></div>'
      + '<div class="pc-bloc"><h3>Notifications</h3><div class="pc-carte">'
      + '<label class="pc-ligne"><span class="pc-txt">Nouvelles sorties<small>Une notification le samedi matin, quand paraissent les sorties de la semaine.</small></span>'
      + '<span class="pc-inter"><input type="checkbox" role="switch" class="pc-notif"><span></span></span></label>'
      + '</div><p class="pc-etat pc-notif-etat"></p></div>'
      + '<div class="pc-bloc"><h3>Surspécialités favorites</h3><div class="pc-carte">' + lignesSpecs + '</div>'
      + '<p class="pc-note">Les surspécialités favorites s’affichent en tête de liste. On peut aussi les épingler en touchant la punaise à droite de leur titre.</p></div>'
      + '<div class="pc-bloc"><h3>À propos</h3><div class="pc-carte">'
      + '<div class="pc-ligne"><a href="https://pausecardio.fr/methode/">Comment Pause Cardio est fabriqué</a><span aria-hidden="true">›</span></div>'
      + '<div class="pc-ligne"><span class="pc-txt">Version bêta<small>Fiches rédigées à l’aide de l’IA — résumés à valider par le lecteur avant toute application clinique.</small></span></div>'
      + '</div></div>'
      + '</div>';
    document.body.appendChild(voile);

    voile.addEventListener('click', function (e) { if (e.target === voile) fermerReglages(); });
    voile.querySelector('.pc-fermer').addEventListener('click', fermerReglages);
    voile.querySelectorAll('input[data-spec]').forEach(function (i) {
      i.addEventListener('change', function () { basculerSuivie(i.dataset.spec, i.checked); });
    });

    var inter = voile.querySelector('.pc-notif'), etat = voile.querySelector('.pc-notif-etat');
    function dire(t) { etat.textContent = t; }
    function peindreNotif() {
      if (!notifDisponibles()) {
        inter.checked = false; inter.disabled = true;
        dire('Les notifications arrivent dans une prochaine version de l’application.');
        return;
      }
      inter.disabled = false;
      inter.checked = lire('pc-appli-notif') === 'oui';
      dire(inter.checked ? 'Activées sur ce téléphone.' : '');
    }
    inter.addEventListener('change', function () {
      if (inter.checked) {
        inter.disabled = true; dire('Activation…');
        activerNotif().then(function (r) {
          inter.disabled = false;
          if (r === 'ok') { inter.checked = true; dire('Activées sur ce téléphone.'); }
          else if (r === 'refus') { inter.checked = false; dire('L’iPhone refuse les notifications pour Pause Cardio : ouvrez Réglages › Notifications › Pause Cardio pour les autoriser.'); }
          else { inter.checked = false; dire('L’activation n’a pas abouti. Réessayez dans un instant.'); }
        });
      } else {
        couperNotif().then(function () { dire('Désactivées.'); });
      }
    });
    voile.pcPeindre = peindreNotif;
    return voile;
  }
  function ouvrirReglages() {
    if (!feuille) feuille = batirReglages();
    peindreSuivies();
    feuille.pcPeindre();
    feuille.hidden = false;
    requestAnimationFrame(function () { feuille.classList.add('ouvert'); });
    peindreOnglets();
  }
  function fermerReglages() {
    if (!feuille || feuille.hidden) return;
    feuille.classList.remove('ouvert');
    setTimeout(function () { feuille.hidden = true; peindreOnglets(); }, 220);
  }
  function reglagesOuverts() { return feuille && !feuille.hidden; }

  // ---------- barre d'onglets ----------
  var ICONES = {
    accueil: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
    favoris: '<path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/>',
    lus: '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.4l2.6 2.6 5-5.2"/>',
    recherche: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.5 15.5 20.5 20.5"/>',
    reglages: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'
  };
  var LIBELLES = { accueil: 'Accueil', favoris: 'Favoris', lus: 'Lus', recherche: 'Rechercher', reglages: 'Réglages' };

  function puce(f) { return document.querySelector('.chip[data-f="' + f + '"]'); }
  function puceActive(f) { var p = puce(f); return !!(p && p.getAttribute('aria-pressed') === 'true'); }
  function champ() { return document.getElementById('q'); }
  function effacerRecherche() {
    var q = champ();
    if (q && q.value) { var b = document.getElementById('qclear'); if (b) b.click(); else { q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); } }
  }
  function vueTout() {
    if (puceActive('fav')) puce('fav').click();
    if (puceActive('lus')) puce('lus').click();
  }

  function ongletCourant() {
    if (reglagesOuverts()) return 'reglages';
    var q = champ();
    if (q && q.value.trim()) return 'recherche';
    if (puceActive('fav')) return 'favoris';
    if (puceActive('lus')) return 'lus';
    return 'accueil';
  }
  function peindreOnglets() {
    var courant = ongletCourant();
    document.querySelectorAll('.pc-onglets button').forEach(function (b) {
      b.setAttribute('aria-current', b.dataset.onglet === courant ? 'true' : 'false');
    });
    var nf = document.getElementById('nfav'), nl = document.getElementById('nlus');
    pastille('favoris', nf ? parseInt(nf.textContent, 10) || 0 : 0);
    pastille('lus', nl ? parseInt(nl.textContent, 10) || 0 : 0);
  }
  function pastille(onglet, n) {
    var b = document.querySelector('.pc-onglets button[data-onglet="' + onglet + '"] .pc-icone');
    if (!b) return;
    var p = b.querySelector('.pc-pastille');
    if (!n) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('span'); p.className = 'pc-pastille'; b.appendChild(p); }
    p.textContent = n > 99 ? '99+' : String(n);
  }

  function choisir(onglet) {
    if (onglet === 'reglages') { if (reglagesOuverts()) fermerReglages(); else ouvrirReglages(); return; }
    fermerReglages();
    if (onglet === 'accueil') {
      effacerRecherche(); vueTout();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (onglet === 'favoris' || onglet === 'lus') {
      effacerRecherche();
      var f = onglet === 'favoris' ? 'fav' : 'lus';
      if (!puceActive(f)) puce(f).click();
      allerA(document.getElementById('resbar') || document.getElementById('filters'));
    } else if (onglet === 'recherche') {
      vueTout();
      var q = champ();
      if (q) { allerA(q.closest('.searchbar') || q); q.focus(); }
    }
    peindreOnglets();
  }

  function poserOnglets() {
    if (document.querySelector('.pc-onglets')) return;
    var nav = document.createElement('nav');
    nav.className = 'pc-onglets';
    nav.setAttribute('aria-label', 'Navigation');
    nav.innerHTML = ['accueil', 'favoris', 'lus', 'recherche', 'reglages'].map(function (o) {
      return '<button type="button" data-onglet="' + o + '"><span class="pc-icone"><svg viewBox="0 0 24 24" fill="none" '
        + 'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + ICONES[o] + '</svg></span>' + LIBELLES[o] + '</button>';
    }).join('');
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-onglet]');
      if (b) choisir(b.dataset.onglet);
    });
    document.body.appendChild(nav);

    // la rangée « Lecture » du site (Mes favoris, Lus) fait doublon avec les onglets
    var f = puce('fav');
    if (f && f.closest('.row')) f.closest('.row').classList.add('pc-masque');

    // l'onglet suit l'état du site : puces, recherche, compteurs
    var veille = new MutationObserver(peindreOnglets);
    ['fav', 'lus'].forEach(function (k) { var p = puce(k); if (p) veille.observe(p, { attributes: true, attributeFilter: ['aria-pressed'] }); });
    ['nfav', 'nlus'].forEach(function (id) { var n = document.getElementById(id); if (n) veille.observe(n, { childList: true, characterData: true, subtree: true }); });
    var q = champ();
    if (q) q.addEventListener('input', peindreOnglets);
    peindreOnglets();
  }

  // ---------- mise en place, une fois la page du site construite ----------
  var fait = false;
  function demarrer() {
    if (fait || !document.body || !document.querySelector('section.spec')) return;
    fait = true;
    poserStyle();
    completerViewport();
    poserEtoiles();
    poserOnglets();
    entretenirNotif();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(demarrer, 0); });
  } else {
    setTimeout(demarrer, 0);
  }
})();
