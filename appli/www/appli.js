/*
 * Réglages propres à l'application iPhone Pause Cardio (bêta).
 *
 * Ce fichier n'existe QUE dans l'application : il est glissé dans la page par le code natif
 * (ios/App/App/AppDelegate.swift, classe PauseCardioViewController) au moment où l'application
 * affiche https://pausecardio.fr. Le site lui-même, et l'appli installée depuis le navigateur,
 * ne le voient jamais : rien ici ne modifie leur rendu.
 *
 * Tout passe par la classe « pc-appli » posée sur <html>, pour que chaque règle soit lisible
 * et facile à retirer.
 */
(function () {
  if (window.__pcAppli) return;
  window.__pcAppli = true;

  var racine = document.documentElement;
  racine.classList.add('pc-appli', 'pc-appli-ios');

  var css = [
    /* marges de l'encoche et de la barre d'accueil */
    'html.pc-appli { --pc-haut: env(safe-area-inset-top, 0px); --pc-bas: env(safe-area-inset-bottom, 0px);',
    '  -webkit-tap-highlight-color: transparent; }',
    'html.pc-appli body { padding-top: var(--pc-haut); padding-bottom: var(--pc-bas); }',
    /* bandeau opaque sous l'heure et la batterie, pour que le texte ne défile pas dessous */
    'html.pc-appli body::before { content: ""; position: fixed; top: 0; left: 0; right: 0;',
    '  height: var(--pc-haut); background: var(--page, #f9f9f7); z-index: 150; pointer-events: none; }',
    /* les têtes de surspécialité restent collées sous ce bandeau, pas derrière lui */
    'html.pc-appli .spec-h { top: var(--pc-haut) !important; }',
    'html.pc-appli #toast { bottom: calc(26px + var(--pc-bas)) !important; }',
    /* l\'invitation « Ajouter l\'appli Pause Cardio » n\'a pas de sens dans l\'application */
    'html.pc-appli section.instal { display: none !important; }'
  ].join('\n');

  function poserStyle() {
    if (document.getElementById('pc-appli-style')) return;
    var s = document.createElement('style');
    s.id = 'pc-appli-style';
    s.textContent = css;
    (document.head || racine).appendChild(s);
  }

  // Le site déclare son viewport sans « viewport-fit=cover » : sans lui, iOS ne donne pas
  // la hauteur de l'encoche (env(safe-area-inset-top) vaut 0). On le complète dans l'appli seulement.
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
    document.addEventListener('DOMContentLoaded', function () { poserStyle(); completerViewport(); guet.disconnect(); });
  }
})();
