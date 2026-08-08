# ADR 0007 — TVA au checkout : montants TTC, pas de ligne dédiée en V1

## Statut

Acté — 2026-08-08, au démarrage de l'incrément 4 du lot 3 (F-CMD-05/07,
récapitulatif et validation de commande). `docs/CAHIER-DES-CHARGES.md` §8 marque
explicitement cette règle **« À VALIDER »** ; cette décision la referme.

## Contexte

Question ouverte #7 du cahier : « TVA : les montants sont-ils TTC uniquement, ou
faut-il détailler la TVA sur la facture ? ». F-CMD-05 lui-même ne liste que
« sous-total, remise, frais de livraison, total TTC » — aucune ligne TVA. Par
ailleurs CLAUDE.md §4 règle 1 impose une contrainte de schéma indépendante de cette
question produit : _« Le taux de TVA est stocké en points de base (`vatRateBps`,
`Int`, 0 par défaut) et figé sur la commande — même à zéro. »_

## Décision

**Pas de TVA appliquée ni affichée en V1** : LaveNet est une entreprise de
démonstration sans immatriculation fiscale réelle, et F-CMD-05 ne demande qu'un
total TTC. `VAT_RATE_BPS = 0` (`libs/shared/domain/business-config.ts`) — inventer
un taux (p. ex. 18 %, le taux standard ivoirien) reviendrait à affirmer un fait
fiscal sur une entreprise fictive, ce que ce projet évite déjà pour les coordonnées
de contact publiques.

**Mais les colonnes existent quand même**, conformément à CLAUDE.md §4 règle 1 :
`Order.vatRateBps` et `Order.vatAmountXof` sont figées au checkout comme les autres
totaux (`subtotalXof`, `discountXof`, `deliveryFeeXof`, `totalXof`) — jamais
`null` une fois la commande validée, toujours `0` tant que `VAT_RATE_BPS` reste à 0. `computeOrderTotals` (`libs/shared/domain/money.ts`) les calcule à chaque
checkout à partir de la constante, pas d'une valeur codée en dur côté service.

Conséquence : le jour où une vraie TVA doit s'appliquer, il suffit de changer
`VAT_RATE_BPS` — aucune migration de schéma, aucun changement de forme de
réponse API, le récapitulatif peut alors afficher une ligne TVA non nulle sans
rupture de contrat.

## Conséquences

- `Order.vatRateBps` / `Order.vatAmountXof` : `Int?`, `null` en `DRAFT`, figés à
  `0` (pas absents) à la validation — même convention que `subtotalXof` et les
  autres totaux.
- Le récapitulatif (F-CMD-05) affiche un total TTC unique, sans détail de TVA
  distinct, tant que `VAT_RATE_BPS` vaut 0.
- Si ce projet devait un jour représenter une entreprise réellement immatriculée,
  cet ADR devrait être rouvert avec le taux réel et sa base légale.

## Alternative écartée

Détailler une TVA à 18 % (taux standard ivoirien) dès maintenant : rejeté —
inventerait un fait fiscal pour une entité qui n'existe pas, pour un besoin que
F-CMD-05 ne formule pas.
