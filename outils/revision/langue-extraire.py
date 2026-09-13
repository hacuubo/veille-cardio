#!/usr/bin/env python3
"""Prépare une reprise de langue par lots (outils/BRIEF-LANGUE.md).

Différence avec extraire.py : le relecteur de langue ne reçoit PAS la source.
On n'interroge donc pas PubMed — c'est délibéré, voir BRIEF-LANGUE.md.

Usage : python3 outils/revision/langue-extraire.py <AAAA-MM-JJ> <dossier de travail> [--taille=12]
Écrit revision/<date>/avant/<ancre>.html et avant/cartes.json (versions conservées),
puis <travail>/lots/lotNN/cartes.json — les seuls champs que le relecteur peut toucher,
plus le titre et la ligne .meta, qu'il lit sans y toucher."""
import re, json, html, unicodedata, os, sys

RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DATE, W = sys.argv[1], sys.argv[2]
TAILLE = next((int(a.split('=')[1]) for a in sys.argv[3:] if a.startswith('--taille=')), 12)
REV = os.path.join(RACINE, 'revision', DATE)
os.makedirs(REV + '/avant', exist_ok=True)
os.makedirs(W + '/valide', exist_ok=True)
s = open(os.path.join(RACINE, 'index.html'), encoding='utf-8').read()


def slug(t):
    t = html.unescape(re.sub(r'<[^>]+>', '', t)).lower()
    t = unicodedata.normalize('NFD', t)
    t = ''.join(c for c in t if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:64].rstrip('-')


def fiche_de(corps):
    i = corps.find('<div class="fiche">')
    if i < 0:
        return ''
    d = corps[i + len('<div class="fiche">'):].rstrip()
    return d[:-len('</div>')].strip() if d.endswith('</div>') else d


pris, cartes = set(), []
for m in re.finditer(r'<article class="card[^"]*"([^>]*)>(.*?)</article>', s, re.S):
    attrs, corps = m.group(1), m.group(2)
    g = lambda r, src=corps: (re.search(r, src, re.S) or [None, ''])[1]
    titre = g(r'<h3[^>]*>(.*?)</h3>')
    base = slug(titre); a = base; n = 2
    while a in pris:
        a = f'{base}-{n}'; n += 1
    pris.add(a)
    cartes.append({
        'ancre': a,
        'spec': g(r'data-spec="([^"]*)"', attrs),
        'niveau': g(r'data-lvl="([^"]*)"', attrs),
        'titre': titre,
        'meta': g(r'<div class="meta">(.*?)</div>'),
        'type': g(r'<span class="type">(.*?)</span>'),
        'fr': g(r'data-fr="([^"]*)"', attrs),
        'sum': g(r'<p class="sum">(.*?)</p>'),
        'cle': g(r'<div class="cle">(.*?)</div>'),
        'fiche': fiche_de(corps),
    })
    open(f'{REV}/avant/{a}.html', 'w', encoding='utf-8').write(m.group(0))

json.dump(cartes, open(REV + '/avant/cartes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(cartes), 'cartes conservées dans', REV + '/avant')

os.makedirs(W + '/lots', exist_ok=True)
# lots par surspécialité : le relecteur garde le même vocabulaire d'un bout à l'autre d'un lot
ordre = sorted(cartes, key=lambda c: (c['spec'], c['ancre']))
n = 0
for i in range(0, len(ordre), TAILLE):
    n += 1
    d = f'{W}/lots/lot{n:02d}'
    os.makedirs(d, exist_ok=True)
    json.dump(ordre[i:i + TAILLE], open(d + '/cartes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(n, 'lots de', TAILLE, 'cartes au plus dans', W + '/lots')
