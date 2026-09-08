#!/usr/bin/env python3
# -----------------------------------------------------------------------------
# Pause Cardio — envoie un e-mail d'alerte au propriétaire du site (chien de
# garde, contrôle des liens…). Mêmes réglages que l'envoi du bulletin :
#   GMAIL_ADRESSE, GMAIL_MOT_DE_PASSE_APPLICATION (secrets GitHub).
# Sans eux, le script affiche le message et se termine sans erreur : le
# workflow qui l'appelle échoue de toute façon, et GitHub notifie.
#
#   python3 outils/alerte-courriel.py --sujet "…" --corps fichier.txt
# -----------------------------------------------------------------------------
import argparse, os, smtplib, ssl, sys
from email.message import EmailMessage


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sujet', required=True)
    ap.add_argument('--corps', required=True, help="fichier texte à envoyer tel quel")
    a = ap.parse_args()
    corps = open(a.corps, encoding='utf-8').read().strip() or '(sans détail)'

    expediteur = os.environ.get('GMAIL_ADRESSE', '').strip()
    motdepasse = os.environ.get('GMAIL_MOT_DE_PASSE_APPLICATION', '').replace(' ', '').strip()
    if not expediteur or not motdepasse:
        print("Identifiants Gmail absents : alerte non envoyée par e-mail (le workflow échoue et GitHub notifie).")
        print(a.sujet); print(corps)
        return 0

    msg = EmailMessage()
    msg['Subject'] = a.sujet
    msg['From'] = f"Pause Cardio <{expediteur}>"
    msg['To'] = expediteur
    msg.set_content(corps + "\n\nJournal du workflow : "
                    + os.environ.get('GITHUB_SERVER_URL', 'https://github.com') + '/'
                    + os.environ.get('GITHUB_REPOSITORY', '') + '/actions/runs/'
                    + os.environ.get('GITHUB_RUN_ID', ''))
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ssl.create_default_context()) as smtp:
        smtp.login(expediteur, motdepasse)
        smtp.send_message(msg)
    print(f"Alerte envoyée : {a.sujet}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
