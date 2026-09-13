#!/usr/bin/env python3
"""Applique la relecture de langue (outils/BRIEF-LANGUE.md) aux cartes d'index.html.

Le garde-fou est VOLONTAIREMENT plus dur que celui d'appliquer.py : la révision de fond
peut corriger un chiffre en citant sa source, la relecture de langue n'en a pas le droit.
Une carte est refusée dès qu'un nombre apparaît, disparaît ou change de valeur, dès que la
structure de la fiche bouge (nombre de puces, sections, mention finale), ou dès qu'une
formule interdite par la charte est introduite.

Usage : python3 outils/revision/langue-appliquer.py <dossier de travail> <AAAA-MM-JJ> [--ecrire]"""
import json, re, sys, os, glob, html, unicodedata

RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
R, DATE = sys.argv[1], sys.argv[2]
ECRIRE = '--ecrire' in sys.argv
IDX = os.path.join(RACINE, 'index.html')
REV = os.path.join(RACINE, 'revision', DATE)
SIG = 'Résumé à valider par le lecteur avant application clinique'

INTERDITS = [
    (r'\bvs\.?\b', '« vs »'),
    (r'Au cabinet', '« Au cabinet »'),
    (r'\bClaude\b', 'mention de Claude'),
    (r'\b(notre (centre|service|h[ôo]pital|bloc|r[ée]animation|[ée]quipe|cabinet)|chez nous|en France|dans nos murs)\b', 'référence géographique ou personnelle'),
    (r'\b(r[ée]volution(ne)?|enterr[ée]e?s?|game[- ]changer|spectaculaire|bouleverse|confirme d[ée]finitivement)\b', 'effet journalistique'),
    (r'\b(en termes de|au niveau de)\b', 'calque de l’anglais'),
    (r'\b[ée]vidence\b', '« évidence »'),
    (r'\b(supporte|supportent)\b', '« supporter »'),
    (r'\b(conditions? respiratoires?|conditions? cliniques?)\b', '« condition »'),
    (r'\bcontr[ôo]les?\b(?= (?:appari[ée]s|sains|historiques))', '« contrôles »'),
]

TAG = re.compile(r'<[^>]*>')


def brut(h):
    return html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))


def sur_texte(h, f):
    """applique f aux seuls nœuds de texte, jamais à l'intérieur d'une balise"""
    out, i = [], 0
    for m in TAG.finditer(h or ''):
        out.append(f(h[i:m.start()])); out.append(m.group(0)); i = m.end()
    out.append(f((h or '')[i:]))
    return ''.join(out)


def typographie(t):
    """insécables avant : ; ? ! % — la règle de la charte, posée ici et pas laissée au relecteur"""
    t = t.replace('&nbsp;', '\u00a0').replace('&#160;', '\u00a0').replace('\u202f', '\u00a0').replace('\u2009', '\u00a0')
    # Protéger les autres entités HTML : le « ; » qui les termine n'est pas une ponctuation.
    # Sans ça, « &ndash; » devient « &ndash&nbsp;; » et la page affiche du charabia.
    gardees = []
    def garder(m):
        gardees.append(m.group(0)); return '\ue000'
    t = re.sub(r'&[a-zA-Z][a-zA-Z0-9]*;|&#\d+;|&#x[0-9a-fA-F]+;', garder, t)
    t = re.sub(r'(?<=\d):(?=\d)', '\x00', t)                      # ratios « 1:1 » et heures
    t = re.sub(r'[ \u00a0]*([:;?!])', '\u00a0\\1', t)
    t = t.replace('\x00', ':')
    t = re.sub(r'(\d)[ \u00a0]*%', '\\1\u00a0%', t)
    t = re.sub(r'(\d)[ \u00a0]+(\d{3}\b)', '\\1\u00a0\\2', t)     # milliers
    t = re.sub(r'[ ]*\u00a0[ ]*', '\u00a0', t)
    it = iter(gardees)
    t = re.sub('\ue000', lambda _: next(it), t)
    return t.replace('\u00a0', '&nbsp;')


def nombres(t):
    """multiensemble des nombres d'un texte français (virgule décimale, milliers espacés)"""
    t = html.unescape(t)
    t = re.sub(r'(?<=\d)[\u00a0\u202f\u2009 ](?=\d{3}(?!\d))', '', t)
    vals = []
    for n in re.findall(r'\d+(?:,\d+)?', t):
        x = n.replace(',', '.')
        vals.append(('%g' % float(x)) if '.' in x else str(int(x)))
    return sorted(vals)


def h4s(f):
    return [re.sub(r'[^a-z]', '', unicodedata.normalize('NFD', brut(x).lower()).encode('ascii', 'ignore').decode())
            for x in re.findall(r'<h4>(.*?)</h4>', f, re.S)]


def equilibre(h):
    o = re.findall(r'<(div|p|ul|ol|li|h4|b|i|span|em|strong)\b', h)
    f = re.findall(r'</(div|p|ul|ol|li|h4|b|i|span|em|strong)>', h)
    return len(o) == len(f)


avant = {c['ancre']: c for c in json.load(open(REV + '/avant/cartes.json', encoding='utf-8'))}
page = open(IDX, encoding='utf-8').read()
ok, refus, inchangees = [], [], []

for f in sorted(glob.glob(R + '/valide/*.json')):
    a = os.path.basename(f)[:-5]
    try:
        v = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        refus.append((a, ['JSON illisible : %s' % e])); continue
    o = avant.get(a)
    if not o:
        refus.append((a, ['ancre inconnue'])); continue

    pb = []
    # normalisation typographique, faite ici pour tout le monde de la même façon
    for k in ('fr', 'sum', 'cle', 'fiche'):
        if k not in v or v[k] is None:
            v[k] = o[k]
        v[k] = sur_texte(v[k], typographie) if k != 'fr' else typographie(v[k])
    v['fr'] = v['fr'].replace('"', '&quot;')

    # --- garde-fou numérique : identité stricte, champ par champ
    for k in ('fr', 'sum', 'cle', 'fiche'):
        av, ap = nombres(brut(o[k])), nombres(brut(v[k]))
        if av != ap:
            perdus = [n for n in av if ap.count(n) < av.count(n)]
            ajoutes = [n for n in ap if av.count(n) < ap.count(n)]
            pb.append(f'{k} : chiffres modifiés (disparus : {sorted(set(perdus)) or "—"} ; apparus : {sorted(set(ajoutes)) or "—"})')

    # --- structure de la fiche : ce n'est pas le travail du relecteur de langue
    fi, fo = v['fiche'], o['fiche']
    if h4s(fi) != h4s(fo):
        pb.append('sections de la fiche modifiées')
    if len(re.findall(r'<li\b', fi)) != len(re.findall(r'<li\b', fo)):
        pb.append('nombre de puces modifié (%d → %d)' % (len(re.findall(r'<li\b', fo)), len(re.findall(r'<li\b', fi))))
    if not re.search(r'<div class="verdict">\s*<b>En pratique', fi):
        pb.append('rubrique « En pratique » absente ou déformée')
    if SIG not in brut(fi):
        pb.append('mention finale absente ou modifiée')
    if not equilibre(fi):
        pb.append('balises déséquilibrées')
    if re.search(r'<(a|script|img|h[1-3]|table)\b', fi):
        pb.append('balise interdite dans la fiche')

    # --- accroche
    mots = [w for w in brut(v['fr']).split() if re.search(r'[A-Za-zÀ-ÿ]', w)]
    if not (5 <= len(mots) <= 12):
        pb.append('accroche de %d mots (attendu 6 à 10)' % len(mots))
    if brut(v['fr']).strip().endswith('.'):
        pb.append('accroche terminée par un point')

    # --- formules interdites introduites par la réécriture
    tout_ap, tout_av = brut(' '.join(v[k] for k in ('fr', 'sum', 'cle', 'fiche'))), brut(' '.join(o[k] for k in ('fr', 'sum', 'cle', 'fiche')))
    for rx, lib in INTERDITS:
        if re.search(rx, tout_ap, re.I) and not re.search(rx, tout_av, re.I):
            pb.append('formule interdite introduite : ' + lib)
    if re.search(r'\d\.\d', tout_ap) and not re.search(r'\d\.\d', tout_av):
        pb.append('point décimal introduit')
    if re.search(r'"[^"]+"', tout_ap) and not re.search(r'"[^"]+"', tout_av):
        pb.append('guillemets droits introduits')

    if pb:
        refus.append((a, pb))
    elif all(v[k] == o[k] for k in ('fr', 'sum', 'cle', 'fiche')):
        inchangees.append(a)
    else:
        ok.append((a, v))

for a, pb in refus:
    print('REFUS', a[:58], '—', ' ; '.join(pb))
print(f'{len(ok)} carte(s) réécrite(s), {len(inchangees)} laissée(s) telle(s) quelle(s), {len(refus)} refusée(s), '
      f'{len(avant) - len(ok) - len(inchangees) - len(refus)} sans retour du relecteur')

if not (ECRIRE and ok):
    sys.exit(1 if refus else 0)

os.makedirs(REV + '/apres', exist_ok=True)
applique = []
for a, v in ok:
    o = avant[a]
    m = re.search(r'<article class="card"[^>]*>(?:(?!</article>).)*?<h3[^>]*>' + re.escape(o['titre']) + r'</h3>(?:(?!</article>).)*</article>', page, re.S)
    if not m:
        print('!! carte introuvable :', a); continue
    n = m.group(0)
    n = re.sub(r'data-fr="[^"]*"', lambda _: 'data-fr="' + v['fr'] + '"', n, count=1)
    n = re.sub(r'<p class="sum">.*?</p>', lambda _: '<p class="sum">' + v['sum'] + '</p>', n, count=1, flags=re.S)
    if v['cle'] and '<div class="cle">' in n:
        n = re.sub(r'<div class="cle">.*?</div>', lambda _: '<div class="cle">' + v['cle'] + '</div>', n, count=1, flags=re.S)
    i = n.find('<div class="fiche">')
    n = n[:i] + '<div class="fiche">\n        ' + v['fiche'].strip() + '\n      </div>\n    </article>'
    if n.count('<article') != 1 or n.count('class="fiche"') != 1:
        print('!! réécriture incohérente :', a); continue
    page = page[:m.start()] + n + page[m.end():]
    open(f'{REV}/apres/{a}.html', 'w', encoding='utf-8').write(n)
    applique.append((a, v))

open(IDX, 'w', encoding='utf-8').write(page)

corr = [(a, c) for a, v in applique for c in v.get('langue', {}).get('corrections', [])]
dout = [(a, c) for a, v in applique for c in v.get('langue', {}).get('doutes_de_fond', [])]
with open(REV + '/journal.md', 'w', encoding='utf-8') as j:
    j.write(f'# Reprise de langue du {DATE}\n\n')
    j.write('Troisième passe de la chaîne qualité (`outils/BRIEF-LANGUE.md`) appliquée au stock de cartes.\n'
            'Le relecteur n’a pas reçu les résumés PubMed : son travail porte sur la langue, pas sur les chiffres.\n'
            'Garde-fou automatique : toute carte dont un nombre, une section, une puce ou la mention finale\n'
            'avait changé a été refusée sans être appliquée. Versions conservées dans `avant/`, publiées dans `apres/`.\n\n')
    j.write(f'Cartes réécrites : {len(applique)} / {len(avant)}. '
            f'Laissées telles quelles : {len(inchangees)}. Refusées par le garde-fou : {len(refus)}.\n\n')
    j.write(f'## Corrections de langue ({len(corr)})\n\n')
    for a, c in corr:
        j.write(f'- **{a}** — {c}\n')
    j.write(f'\n## Doutes de fond signalés, laissés en l’état ({len(dout)})\n\n')
    if not dout:
        j.write('_Aucun._\n')
    for a, c in dout:
        j.write(f"- **{a}** — « {brut(c.get('passage',''))} » — {c.get('raison','')}\n")
    if refus:
        j.write(f'\n## Cartes refusées par le garde-fou ({len(refus)})\n\n')
        for a, pb in refus:
            j.write(f'- **{a}** — {" ; ".join(pb)}\n')
print('index.html écrit ;', len(applique), 'cartes appliquées ; journal :', REV + '/journal.md')
