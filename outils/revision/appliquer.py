#!/usr/bin/env python3
"""Applique les textes validés (valide/<ancre>.json) aux cartes d'index.html.

Contrôles avant écriture : JSON complet, structure de fiche standard, balises équilibrées,
data-fr sans point final, chiffres de la réécriture tous présents dans la carte d'origine ou le
résumé PubMed (tolérance : corrections déclarées avec source, calculs déclarés dans notes).
Écrit revision/AAAA-MM-JJ/apres/<ancre>.html et revision/AAAA-MM-JJ/journal.md.
Usage : appliquer.py [--ecrire]"""
import json, re, sys, os, glob, html, unicodedata
# Usage : python3 outils/revision/appliquer.py <dossier de travail> <AAAA-MM-JJ> [--ecrire]
#   dossier de travail : contient valide/<ancre>.json, abs/<PMID>.txt et pmids.json
#   AAAA-MM-JJ         : dossier revision/<date>/ (avant/cartes.json créé par extraire.py)
RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
R = sys.argv[1]
IDX = os.path.join(RACINE, 'index.html')
REV = os.path.join(RACINE, 'revision', sys.argv[2])
ECRIRE = '--ecrire' in sys.argv
avant = {c['ancre']: c for c in json.load(open(REV + '/avant/cartes.json', encoding='utf-8'))}
pmids = json.load(open(R + '/pmids.json'))
page = open(IDX, encoding='utf-8').read()

def brut(h): return html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))
def nombres(t, fr):
    if fr:
        t = re.sub(r'(?<=\d)[\u00a0\u202f\u2009\u2008 ](?=\d{3}(?!\d))', '', t); t = t.replace(',', '.')
    else:
        t = re.sub(r'(?<=\d)[·](?=\d)', '.', t)
        t = re.sub(r'(?<=\d)[\u00a0\u202f\u2009\u2008 ,](?=\d{3}(?!\d))', '', t)
        t = re.sub(r'(?<![\d.])\.(?=\d)', '0.', t)
    return set(re.findall(r'\d+(?:\.\d+)?', t))
def equilibre(h):
    o = re.findall(r'<(div|p|ul|li|h4|b|i|span)\b', h); f = re.findall(r'</(div|p|ul|li|h4|b|i|span)>', h)
    return len(o) == len(f)

ok, refus, journal = [], [], []
for f in sorted(glob.glob(R + '/valide/*.json')):
    a = os.path.basename(f)[:-5]
    try: v = json.load(open(f, encoding='utf-8'))
    except Exception as e: refus.append((a, ['JSON illisible : %s' % e])); continue
    o = avant.get(a); pb = []
    if not o: refus.append((a, ['ancre inconnue'])); continue
    for k in ('fr', 'sum', 'fiche'):
        if not v.get(k): pb.append('champ vide : ' + k)
    fr = v.get('fr', '')
    if brut(fr).strip().endswith('.'): v['fr'] = fr.rstrip().rstrip('.')
    mots = [w for w in brut(v.get('fr','')).split() if re.search(r'[A-Za-zÀ-ÿ]', w)]
    if not (5 <= len(mots) <= 12): pb.append('accroche hors gabarit (%d mots)' % len(mots))
    fiche = v.get('fiche', '')
    for h4 in ('Question clinique', 'thode', 'sultats', 'Limites'):
        if h4 not in html.unescape(fiche): pb.append('fiche sans section ' + h4)
    if 'class="verdict"' not in fiche: pb.append('fiche sans En pratique')
    if 'class="sig"' not in fiche: pb.append('fiche sans ligne .sig')
    if not equilibre(fiche): pb.append('balises déséquilibrées dans la fiche')
    if re.search(r'<(a|script|img|h[1-3]|table)\b', fiche): pb.append('balise interdite dans la fiche')
    # garde-fou numérique
    src = ''
    p = pmids.get(a)
    if p and os.path.exists(f'{R}/abs/{p}.txt'): src = open(f'{R}/abs/{p}.txt', encoding='utf-8').read()
    autorises = nombres(brut(o['fr'] + ' ' + o['sum'] + ' ' + o['cle'] + ' ' + o['fiche'] + ' ' + o['meta']), True) | nombres(src, False)
    autorises |= {str(i) for i in range(0, 32)} | {'2024', '2025', '2026', '95', '100', '90', '1000'}
    for c in v.get('corrections', []) + v.get('a_verifier', []):
        autorises |= nombres(brut(c.get('apres', '') + ' ' + c.get('source', '') + ' ' + c.get('passage', '')), True)
    autorises |= nombres(brut(v.get('notes', '')), True)
    autorises |= nombres(brut(' '.join(v.get('controle', {}).get('modifications', []))), True)
    autorises |= nombres(brut(' '.join(c.get('passage', '') + ' ' + c.get('raison', '') for c in v.get('controle', {}).get('a_verifier', []))), True)
    texte = brut(v.get('fr', '') + ' ' + v.get('sum', '') + ' ' + v.get('cle', '') + ' ' + fiche)
    texte = re.sub(r'\b\d{1,2}\s+[a-zéû]+\s+20\d\d', ' ', texte)
    def connu(n):
        if n in autorises or n.rstrip('0').rstrip('.') in autorises: return True
        try: x = float(n)
        except ValueError: return False
        # proportion ↔ pourcentage (0,66 dans l'abstract, 66 % dans la carte)
        if any(f'{y:g}' in autorises or f'{y:.2f}'.rstrip('0').rstrip('.') in autorises for y in (x / 100, x * 100)): return True
        # arrondi d'une valeur de la source (77,2 % → « voisin de 77 % »)
        dec = len(n.split('.')[1]) if '.' in n else 0
        for a in autorises:
            if re.fullmatch(r'\d+\.\d+', a) and len(a.split('.')[1]) > dec and round(float(a), dec) == x: return True
        return False
    manquants = sorted(n for n in nombres(texte, True) if not connu(n))
    if manquants: pb.append('nombres absents des sources : ' + ', '.join(manquants))
    (refus if pb else ok).append((a, pb if pb else v))

for a, pb in refus: print('REFUS', a[:60], '—', ' ; '.join(pb))
print(f'{len(ok)} carte(s) prête(s), {len(refus)} refusée(s), {len(avant) - len(ok) - len(refus)} sans texte validé')

if ECRIRE and ok:
    os.makedirs(REV + '/apres', exist_ok=True)
    for a, v in ok:
        o = avant[a]; h = o['html']  if 'html' in o else None
        # retrouver la carte dans la page par son titre h3 exact
        m = re.search(r'<article class="card"[^>]*>(?:(?!</article>).)*?<h3[^>]*>' + re.escape(o['titre']) + r'</h3>(?:(?!</article>).)*</article>', page, re.S)
        if not m: print('!! carte introuvable', a); continue
        carte = m.group(0)
        n = carte
        n = re.sub(r'data-fr="[^"]*"', 'data-fr="' + v['fr'].replace('"', '&quot;') + '"', n, count=1)
        n = re.sub(r'<p class="sum">.*?</p>', lambda _: '<p class="sum">' + v['sum'] + '</p>', n, count=1, flags=re.S)
        if re.search(r'<div class="cle">', n):
            if v.get('cle'): n = re.sub(r'<div class="cle">.*?</div>', lambda _: '<div class="cle">' + v['cle'] + '</div>', n, count=1, flags=re.S)
            else: n = re.sub(r'\s*<div class="cle">.*?</div>', '', n, count=1, flags=re.S)
        elif v.get('cle'):
            n = re.sub(r'(<p class="sum">.*?</p>)', lambda mm: mm.group(1) + '\n      <div class="cle">' + v['cle'] + '</div>', n, count=1, flags=re.S)
        n = re.sub(r'<div class="fiche">.*</div>(\s*)$', lambda mm: '<div class="fiche">\n        ' + v['fiche'].strip() + '\n      </div>' + mm.group(1), n[:-len('</article>')], count=1, flags=re.S) + '</article>'
        if n.count('<article') != 1 or n.count('class="fiche"') != 1: print('!! réécriture incohérente', a); continue
        page = page[:m.start()] + n + page[m.end():]
        open(f'{REV}/apres/{a}.html', 'w', encoding='utf-8').write(n)
        journal.append((a, v))
    open(IDX, 'w', encoding='utf-8').write(page)
    with open(REV + '/journal.md', 'w', encoding='utf-8') as j:
        j.write(f'# Révision éditoriale du {sys.argv[2]}\n\nCharte : `outils/CHARTE-REDACTION.md`. Deux passes par carte (réécriture, puis contrôle de fidélité par un relecteur distinct), garde-fou automatique sur les chiffres. Versions précédentes dans `avant/`, versions publiées dans `apres/`.\n\n')
        corr = [(a, c) for a, v in journal for c in v.get('corrections', [])]
        av = [(a, c) for a, v in journal for c in v.get('a_verifier', []) + v.get('controle', {}).get('a_verifier', [])]
        j.write(f'Cartes révisées : {len(journal)} / {len(avant)}. Corrections factuelles documentées : {len(corr)}. Passages laissés à vérifier : {len(av)}.\n\n')
        j.write('## Corrections factuelles (avec source)\n\n')
        for a, c in corr: j.write(f"- **{a}** — avant : « {brut(c.get('avant',''))} » → après : « {brut(c.get('apres',''))} » — source : {c.get('source','')}\n")
        j.write('\n## Passages à vérifier (modification de fond suspendue)\n\n')
        for a, c in av: j.write(f"- **{a}** — « {brut(c.get('passage',''))} » — {c.get('raison','')}\n")
        j.write('\n## Verdicts du relecteur\n\n')
        for a, v in journal:
            ct = v.get('controle', {}); j.write(f"- **{a}** : {ct.get('verdict','?')}" + (' — ' + ' ; '.join(ct.get('modifications', [])[:3]) if ct.get('modifications') else '') + '\n')
    print('index.html écrit ;', len(journal), 'cartes appliquées ; journal :', REV + '/journal.md')
