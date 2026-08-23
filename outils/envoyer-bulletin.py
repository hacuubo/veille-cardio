#!/usr/bin/env python3
# -----------------------------------------------------------------------------
# Pause Cardio — envoi du bulletin hebdomadaire par e-mail.
#
#   python3 outils/envoyer-bulletin.py            # envoie le dernier bulletin
#   python3 outils/envoyer-bulletin.py --pdf bulletin/exemple.pdf
#   python3 outils/envoyer-bulletin.py --essai    # affiche le message sans l'envoyer
#
# Réglages, lus dans les variables d'environnement (dans GitHub : Settings →
# Secrets and variables → Actions) :
#   GMAIL_ADRESSE                   adresse Gmail qui envoie (ex. robin.bouchau@gmail.com)
#   GMAIL_MOT_DE_PASSE_APPLICATION  « mot de passe d'application » Gmail (16 lettres)
#   BULLETIN_DESTINATAIRES          adresses séparées par des virgules ; si vide,
#                                   le bulletin part vers GMAIL_ADRESSE
#
# Les destinataires ne sont jamais écrits dans le dépôt (qui est public) et sont
# mis en copie cachée : personne ne voit la liste des autres lecteurs.
# -----------------------------------------------------------------------------

import argparse, glob, html, os, re, smtplib, ssl, sys
from email.message import EmailMessage
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
        'août', 'septembre', 'octobre', 'novembre', 'décembre']


def en_francais(iso):
    a, m, j = (int(x) for x in iso.split('-'))
    return f"{j} {MOIS[m - 1]} {a}"


def sans_balises(txt):
    return html.unescape(re.sub(r'<[^>]*>', '', txt)).replace('\xa0', ' ').strip()


def lire_entrees(chemin_html):
    """Relit le bulletin HTML pour reconstituer la liste des nouveautés."""
    if not chemin_html.exists():
        return []
    source = chemin_html.read_text(encoding='utf-8')
    entrees = []
    for classes, bloc in re.findall(r'<article class="(e[^"]*)">(.*?)</article>', source, re.S):
        def prendre(motif, groupe=1):
            m = re.search(motif, bloc, re.S)
            return m.group(groupe) if m else ''
        entrees.append({
            'spec':    sans_balises(prendre(r'<span class="spec"[^>]*>(.*?)</span>')),
            'couleur': prendre(r'<span class="spec" style="color:(#[0-9a-fA-F]{6})"'),
            'niveau':  sans_balises(prendre(r'<span class="niv"[^>]*>(.*?)</span>')),
            'couleur_niveau': prendre(r'<span class="niv" style="background:(#[0-9a-fA-F]{6})"'),
            'titre':   sans_balises(prendre(r'<h3>(.*?)</h3>')),
            'lien':    prendre(r'<h3><a href="([^"]+)"'),
            'meta':    sans_balises(prendre(r'<div class="meta">(.*?)</div>')),
            'une':     'une' in classes.split(),      # les « ★ à la une »
        })
    return entrees


def corps_html(entrees, date_iso, nom_pdf):
    lignes = []
    for e in entrees:
        etoile = '<span style="color:#d03b3b;font-weight:700">&#9733; </span>' if e['une'] else ''
        titre = html.escape(e['titre'])
        if e['lien']:
            titre = f'<a href="{html.escape(e["lien"], quote=True)}" style="color:#111;text-decoration:none">{titre}</a>'
        lignes.append(f'''
        <tr><td style="padding:11px 0;border-bottom:1px solid #e4e3dc">
          <div style="font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:{e['couleur'] or '#898781'}">
            {html.escape(e['spec'])}
            <span style="display:inline-block;background:{e['couleur_niveau'] or '#898781'};color:#fff;border-radius:99px;padding:1px 8px;margin-left:6px;font-size:11px;letter-spacing:.02em">{html.escape(e['niveau'])}</span>
          </div>
          <div style="font-size:16px;font-weight:700;line-height:1.3;margin-top:3px;color:#111">{etoile}{titre}</div>
          <div style="font-size:13px;color:#52514e;margin-top:2px">{html.escape(e['meta'])}</div>
        </td></tr>''')

    n = len(entrees)
    nb_une = sum(1 for e in entrees if e['une'])
    chapeau = (f"{n} nouveauté{'s' if n > 1 else ''} cette semaine"
               + (f", dont {nb_une} susceptible{'s' if nb_une > 1 else ''} de changer votre pratique."
                  if nb_une else " — aucune ne modifie la pratique dans l’immédiat."))

    return f'''<!DOCTYPE html><html lang="fr"><body style="margin:0;background:#f9f9f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f7;padding:22px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fcfcfb;border:1px solid rgba(11,11,11,.10);border-radius:14px;padding:24px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111">
  <tr><td>
    <div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#898781;font-weight:700">Bulletin hebdomadaire &middot; Centre de Cardiologie de Rodez</div>
    <div style="font-size:24px;font-weight:800;margin-top:4px;letter-spacing:-.01em">PAUSE CARDIO <span style="color:#d03b3b">&#10084;</span></div>
    <div style="font-size:14px;color:#52514e;margin-top:4px">Nouveautés de la semaine du {en_francais(date_iso)}</div>
    <div style="font-size:15px;color:#333;margin:16px 0 4px">{chapeau}</div>
  </td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{''.join(lignes)}</table></td></tr>
  <tr><td style="padding-top:18px;font-size:14px;color:#52514e">
    Le détail — résumés, chiffres et « Au cabinet » — est dans le PDF joint (<b>{html.escape(nom_pdf)}</b>),
    à lire ou à transférer tel quel.<br><br>
    Tableau de bord complet :
    <a href="https://hacuubo.github.io/veille-cardio/" style="color:#2a78d6">hacuubo.github.io/veille-cardio</a>
    &middot; <a href="https://hacuubo.github.io/veille-cardio/bulletin/" style="color:#2a78d6">bulletins précédents</a>
  </td></tr>
  <tr><td style="padding-top:16px;margin-top:16px;border-top:1px solid #e4e3dc;font-size:12px;color:#898781;line-height:1.5">
    Fiches rédigées par Claude — à valider par le lecteur avant toute application clinique.
  </td></tr>
</table>
</td></tr></table>
</body></html>'''


def corps_texte(entrees, date_iso):
    lignes = [f"Pause Cardio — nouveautés de la semaine du {en_francais(date_iso)}", ""]
    for e in entrees:
        lignes.append(('★ ' if e['une'] else '- ') + f"[{e['spec']} · {e['niveau']}] {e['titre']}")
        if e['meta']:
            lignes.append(f"  {e['meta']}")
        if e['lien']:
            lignes.append(f"  {e['lien']}")
        lignes.append("")
    lignes += ["Le détail est dans le PDF joint.",
               "Tableau de bord : https://hacuubo.github.io/veille-cardio/",
               "Bulletins précédents : https://hacuubo.github.io/veille-cardio/bulletin/", "",
               "Fiches rédigées par Claude — à valider avant toute application clinique."]
    return "\n".join(lignes)


def main():
    ap = argparse.ArgumentParser(description="Envoie le bulletin de la semaine par e-mail.")
    ap.add_argument('--pdf', default='', help="PDF à envoyer (par défaut : le plus récent)")
    ap.add_argument('--essai', action='store_true', help="affiche le message sans l'envoyer")
    a = ap.parse_args()

    if a.pdf:
        pdf = Path(a.pdf) if Path(a.pdf).is_absolute() else RACINE / a.pdf
    else:
        candidats = sorted(glob.glob(str(RACINE / 'bulletin' / 'bulletin-*.pdf')))
        if not candidats:
            print("Aucun bulletin à envoyer.")
            return 0
        pdf = Path(candidats[-1])
    if not pdf.exists():
        print(f"ERREUR : {pdf} est introuvable.", file=sys.stderr)
        return 1

    date_iso = (re.search(r'(\d{4}-\d{2}-\d{2})', pdf.name) or [None, ''])[1]
    if not date_iso:                                   # exemple.pdf, essai manuel…
        import datetime
        date_iso = datetime.date.today().isoformat()
    entrees = lire_entrees(pdf.with_suffix('.html'))

    n = len(entrees)
    nb_une = sum(1 for e in entrees if e['une'])
    if n:
        sujet = f"Pause Cardio · {n} nouveauté{'s' if n > 1 else ''} — {en_francais(date_iso)}"
        if nb_une:
            sujet += f" (dont {nb_une} ★ changement de pratique)"
    else:
        sujet = f"Pause Cardio · bulletin du {en_francais(date_iso)}"

    expediteur = os.environ.get('GMAIL_ADRESSE', '').strip()
    motdepasse = os.environ.get('GMAIL_MOT_DE_PASSE_APPLICATION', '').replace(' ', '').strip()
    brut = os.environ.get('BULLETIN_DESTINATAIRES', '').strip() or expediteur
    destinataires = [d.strip() for d in re.split(r'[,;\s]+', brut) if d.strip()]

    if not a.essai and (not expediteur or not motdepasse):
        print("Identifiants Gmail absents (GMAIL_ADRESSE / GMAIL_MOT_DE_PASSE_APPLICATION) : envoi ignoré.")
        return 0
    if not destinataires:
        print("Aucun destinataire : envoi ignoré.")
        return 0

    msg = EmailMessage()
    msg['Subject'] = sujet
    msg['From'] = f"Pause Cardio <{expediteur or 'veille@exemple.fr'}>"
    msg['To'] = expediteur or destinataires[0]        # les autres lecteurs restent en copie cachée
    msg['Reply-To'] = expediteur or destinataires[0]
    msg.set_content(corps_texte(entrees, date_iso))
    msg.add_alternative(corps_html(entrees, date_iso, pdf.name), subtype='html')
    msg.add_attachment(pdf.read_bytes(), maintype='application', subtype='pdf', filename=pdf.name)

    if a.essai:
        print(f"--- ESSAI (aucun envoi) ---\nSujet      : {sujet}\n"
              f"Pièce jointe : {pdf.name} ({pdf.stat().st_size // 1024} Ko)\n"
              f"Destinataires : {', '.join(destinataires)}\n"
              f"Nouveautés   : {n}")
        for e in entrees:
            print(('  ★ ' if e['une'] else '  - ') + f"[{e['spec']} · {e['niveau']}] {e['titre']}")
        return 0

    with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ssl.create_default_context()) as smtp:
        smtp.login(expediteur, motdepasse)
        smtp.send_message(msg, from_addr=expediteur, to_addrs=destinataires)
    print(f"Bulletin envoyé à {len(destinataires)} destinataire(s) : {pdf.name}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
