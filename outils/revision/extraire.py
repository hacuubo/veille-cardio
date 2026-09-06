#!/usr/bin/env python3
"""Inventorie les cartes d'index.html pour une révision par lots.

Usage : python3 outils/revision/extraire.py <AAAA-MM-JJ> <dossier de travail>
Écrit revision/<date>/avant/<ancre>.html (version conservée) et avant/cartes.json, puis, dans le
dossier de travail, abs/<PMID>.txt (résumé PubMed trouvé par DOI ou titre), pmids.json et des lots
lots/lotNN/ de huit cartes par surspécialité, prêts pour outils/BRIEF-REVISION.md puis
outils/BRIEF-CONTROLE.md, et enfin appliquer.py."""
import re, json, html, unicodedata, os, sys, time, shutil, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DATE, W = sys.argv[1], sys.argv[2]
REV = os.path.join(RACINE, 'revision', DATE)
os.makedirs(REV + '/avant', exist_ok=True); os.makedirs(W + '/abs', exist_ok=True)
s = open(os.path.join(RACINE, 'index.html'), encoding='utf-8').read()

def slug(t):
    t = html.unescape(re.sub(r'<[^>]+>', '', t)).lower(); t = unicodedata.normalize('NFD', t); t = ''.join(c for c in t if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:64].rstrip('-')
def norm(t): t = html.unescape(re.sub(r'<[^>]+>', '', t)).lower(); return re.sub(r'[^a-z0-9]+', '', t)
def get(u):
    for _ in range(3):
        try: return urllib.request.urlopen(u, timeout=40).read().decode()
        except Exception: time.sleep(2)
    return ''
def doi_de(liens):
    for l in liens:
        m = re.search(r'PIIS?(\d{4}-\d{3}[\dX])\((\d\d)\)(\d{5}-[\dX])', l)
        if m: return f'10.1016/S{m.group(1)}({m.group(2)}){m.group(3)}'
        m = re.search(r'(10\.\d{4,9}/[^\s"?#]+)', l)
        if m: return m.group(1).rstrip('/.')
def fetch(pm):
    x = get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&id=' + pm)
    try: a = ET.fromstring(x).find('.//PubmedArticle')
    except Exception: return None
    if a is None: return None
    t = ''.join(a.find('.//ArticleTitle').itertext()); j = a.findtext('.//Journal/ISOAbbreviation')
    d = a.find('.//ArticleDate'); ds = f"{d.findtext('Year')}-{d.findtext('Month')}-{d.findtext('Day')}" if d is not None else '?'
    abst = '\n'.join((x.get('Label', '') + ': ' if x.get('Label') else '') + ''.join(x.itertext()) for x in a.findall('.//Abstract/AbstractText'))
    doi = next((i.text for i in a.findall('.//ArticleId') if i.get('IdType') == 'doi'), '')
    open(f'{W}/abs/{pm}.txt', 'w').write(f"PMID {pm}\nTITRE {t}\nREVUE {j}\nDATE_EPUB {ds}\nDOI https://doi.org/{doi}\n\nRESUME\n{abst or '(vide)'}\n")
    return (t, bool(abst))

pris, cartes = set(), []
for m in re.finditer(r'<article class="card[^"]*"([^>]*)>(.*?)</article>', s, re.S):
    attrs, corps = m.group(1), m.group(2)
    g = lambda r, src=corps: (re.search(r, src, re.S) or [None, ''])[1]
    titre = g(r'<h3[^>]*>(.*?)</h3>'); base = slug(titre); a = base; n = 2
    while a in pris: a = f'{base}-{n}'; n += 1
    pris.add(a)
    c = {'ancre': a, 'spec': g(r'data-spec="([^"]*)"', attrs), 'annee': g(r'data-year="([^"]*)"', attrs), 'niveau': g(r'data-lvl="([^"]*)"', attrs),
         'titre': titre, 'meta': g(r'<div class="meta">(.*?)</div>'), 'type': g(r'<span class="type">(.*?)</span>'), 'fr': g(r'data-fr="([^"]*)"', attrs),
         'sum': g(r'<p class="sum">(.*?)</p>'), 'cle': g(r'<div class="cle">(.*?)</div>'), 'fiche': g(r'<div class="fiche">(.*?)</div>\s*$') or g(r'<div class="fiche">(.*)'),
         'liens': re.findall(r'href="([^"]+)"', g(r'<div class="actions">(.*?)</div>'))}
    open(f'{REV}/avant/{a}.html', 'w', encoding='utf-8').write(m.group(0)); cartes.append(c)
json.dump(cartes, open(REV + '/avant/cartes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(cartes), 'cartes conservées dans', REV + '/avant')

ids = {}
for c in cartes:
    pm = next((re.search(r'pubmed\.ncbi\.nlm\.nih\.gov/(\d+)', l).group(1) for l in c['liens'] if 'pubmed.ncbi' in l), None)
    essais = ([doi_de(c['liens']) + '[doi]'] if doi_de(c['liens']) else []) + ['"' + re.sub(r'[^\w\s-]', ' ', html.unescape(re.sub(r'<[^>]+>', '', c['titre']))) + '"[title]']
    trouve = None
    for q in ([f'{pm}[uid]'] if pm else []) + essais:
        r = get('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmax=3&term=' + urllib.parse.quote(q)); time.sleep(0.4)
        for cand in re.findall(r'<Id>(\d+)</Id>', r or ''):
            f = fetch(cand); time.sleep(0.4)
            if f and norm(f[0])[:40] == norm(c['titre'])[:40]: trouve = cand if f[1] else None; break
        if trouve: break
    ids[c['ancre']] = trouve; c['pmid'] = trouve
    if not trouve: c['note_source'] = 'aucun résumé PubMed exploitable : langue seulement, fond intact'
json.dump(ids, open(W + '/pmids.json', 'w'), indent=1)
print(sum(1 for v in ids.values() if v), 'cartes avec résumé PubMed')

os.makedirs(W + '/lots', exist_ok=True); os.makedirs(W + '/out', exist_ok=True); os.makedirs(W + '/valide', exist_ok=True)
n = 0
for spec in ['rythmo', 'interv', 'imagerie', 'ic', 'usic', 'cmh', 'prev', 'sport', 'onco']:
    cs = [c for c in cartes if c['spec'] == spec]
    for i in range(0, len(cs), 8):
        n += 1; d = f'{W}/lots/lot{n:02d}'; os.makedirs(d + '/abs', exist_ok=True)
        json.dump(cs[i:i + 8], open(d + '/cartes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        for c in cs[i:i + 8]:
            if c['pmid']: shutil.copy(f"{W}/abs/{c['pmid']}.txt", d + '/abs/')
print(n, 'lots prêts dans', W + '/lots')
