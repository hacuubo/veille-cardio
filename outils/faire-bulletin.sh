#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Pause Cardio — fabrique le bulletin PDF de la semaine.
#
#   bash outils/faire-bulletin.sh
#
# 1. compare index.html aux articles déjà signalés (bulletin/etat.json) ;
# 2. s'il y a du nouveau : écrit bulletin/bulletin-AAAA-MM-JJ.html,
#    l'imprime en PDF, met à jour la page d'archives et le lien en tête du site ;
# 3. s'il n'y a rien de neuf : ne produit rien et le dit.
# -----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

SORTIE="$(node outils/bulletin.mjs "$@")"
echo "$SORTIE"

# Rien de neuf, ou simple initialisation : pas de PDF à imprimer.
case "$SORTIE" in
  RIEN*|INIT*|RAPPEL*) exit 0 ;;
esac

if [[ "$SORTIE" == APERCU* ]]; then
  SRC="bulletin/apercu.html"
else
  SRC="$(ls -t bulletin/bulletin-*.html | head -1)"
fi
PDF="${SRC%.html}.pdf"

# Navigateur utilisé pour l'impression (Chrome/Chromium en mode sans fenêtre).
NAV=""
for c in "${CHROME_BIN:-}" /opt/pw-browsers/chromium-*/chrome-linux/chrome \
         "$(command -v chromium || true)" "$(command -v chromium-browser || true)" \
         "$(command -v google-chrome || true)"; do
  [[ -n "$c" && -x "$c" ]] && { NAV="$c"; break; }
done
if [[ -z "$NAV" ]]; then
  echo "ERREUR : aucun navigateur Chrome/Chromium trouvé pour imprimer le PDF." >&2
  exit 1
fi

"$NAV" --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
       --print-to-pdf-no-header --run-all-compositor-stages-before-draw \
       --virtual-time-budget=4000 \
       --print-to-pdf="$PDF" "file://$PWD/$SRC" >/dev/null 2>&1

[[ -s "$PDF" ]] || { echo "ERREUR : le PDF n'a pas été produit." >&2; exit 1; }
echo "PDF $PDF ($(du -h "$PDF" | cut -f1))"
