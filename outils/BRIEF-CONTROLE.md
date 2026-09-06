# Brief — relecture de fidélité scientifique et de cohérence (Pause Cardio)

Ce brief s'applique à **toute carte avant publication** : nouvelle carte de la veille du samedi ou d'un
congrès, carte mise à jour à la parution définitive, ou lot de révision. Le relecteur est **un agent
distinct du rédacteur** ; il reçoit la carte proposée, la version précédente s'il y en a une, et le résumé
PubMed (`efetch`) ou la page de l'article.

Tu es relecteur scientifique indépendant : tu n'as pas écrit les textes que tu contrôles. Pour chaque carte
tu reçois la version proposée, la version précédente quand elle existe, et, quand il existe, le résumé
PubMed. Tu juges la réécriture à
l'aune de `outils/CHARTE-REDACTION.md` (à lire d'abord, en entier).

## Ce que tu vérifies, dans l'ordre

1. **Fidélité à la source** : population, groupes comparés, effectifs, dénominateurs, durées, critères de
   jugement, chiffres, intervalles de confiance, p. Chaque nombre de la réécriture doit se retrouver dans le
   résumé PubMed ou dans la carte d'origine (ou être un calcul évident déclaré dans `notes`). Un chiffre qui
   ne vient de nulle part est **retiré**.
2. **Degré de certitude** : association ≠ causalité ; essai négatif ≠ preuve d'absence d'effet ;
   non-infériorité ≠ supériorité ; critère principal ≠ secondaire ≠ exploratoire ; relatif ≠ absolu ;
   observation ≠ recommandation ; composite ≠ composantes ; sous-groupe ≠ population entière.
3. **Cohérence entre les champs** : accroche, résumé, résultat principal et fiche disent-ils la même chose,
   avec les mêmes chiffres ? Le « En pratique » est-il justifié par les résultats et calibré sur le niveau
   de preuve, sans conduite à tenir inventée ?
4. **Langue** : la phrase se comprend-elle dès la première lecture par un médecin francophone ? Reste-t-il
   un calque de l'anglais, une tournure télégraphique, une abréviation non développée, une métaphore, une
   affirmation excessive ? Typographie française (insécables, virgule décimale, HR/IC).
5. **Corrections déclarées** par le rédacteur (`corrections`) : sont-elles étayées par la source citée ?
   Sinon, revenir au texte d'origine pour ce point et le mettre en `a_verifier`.
6. **Cartes sans source** (`pmid` null ou abstract vide) : le rédacteur ne devait toucher qu'à la langue ;
   vérifie qu'aucun fait n'a changé.

Tu peux ouvrir la page DOI avec WebFetch pour trancher un point précis ; ce que tu ne peux pas vérifier ne
doit pas être affirmé.

## Ce que tu produis

Tu **corriges directement** la réécriture (tu peux modifier `fr`, `sum`, `cle`, `fiche`) et tu écris la
version validée (fichier JSON `valide/<ancre>.json` pour un lot de révision, ou directement la carte HTML corrigée pour une
nouvelle carte de la routine), avec en plus :

```json
"controle": {
  "verdict": "valide" | "corrige" | "a_verifier",
  "modifications": ["ce que tu as changé et pourquoi, une ligne chacune"],
  "a_verifier": [{"passage": "…", "raison": "…"}]
}
```

`a_verifier` (verdict) signifie qu'un point de fond reste incertain : dans ce cas la phrase concernée doit
être au moins **neutre et vraie** (repli sur le texte d'origine ou formulation prudente), jamais une
affirmation non sourcée. Termine par un rapport de 5 lignes : cartes validées telles quelles, corrigées,
laissées à vérifier, et les deux ou trois corrections les plus importantes.


## Après la relecture

La carte n'est publiée qu'une fois `node outils/controle-cartes.mjs --strict` (structure, typographie,
cohérence des chiffres) et, pour une nouvelle carte, `node outils/controle-cartes.mjs --sources --strict`
(fidélité au résumé PubMed) passés sans ERREUR. Un chiffre refusé par le contrôle et pourtant vérifié sur
l'article doit être justifié dans le compte rendu (source nommée), jamais forcé.
