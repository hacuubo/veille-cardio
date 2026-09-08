# Journal de veille

Un fichier par jour de veille (`AAAA-MM-JJ.md`), écrit par la routine : ce qu'elle a
examiné, ce qu'elle a retenu, ce qu'elle a écarté et pourquoi. Il sert à vérifier après
coup une décision éditoriale, et à repérer une dérive de sélection.

- Le squelette vient de la moisson PubMed (`node outils/journal.mjs --squelette`), la
  routine remplit les colonnes Verdict et Motif de chaque candidat, puis la clôture
  (`--cloture`) ajoute ce qui se constate tout seul : cartes du jour, bilan du contrôle
  qualité, bulletin et courriel.
- Le dépôt est public : le journal ne contient que des titres d'articles, des liens
  PubMed et des décisions éditoriales. Jamais d'adresse, de nom ni de donnée personnelle.
- Il n'est pas affiché sur le site.
