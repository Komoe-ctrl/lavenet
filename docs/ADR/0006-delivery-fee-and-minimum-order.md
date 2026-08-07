# ADR 0006 — Frais de livraison et minimum de commande

## Statut

Acté — 2026-08-05, au démarrage du lot 3 (F-CMD). `docs/CAHIER-DES-CHARGES.md` §5.3
marque explicitement cette règle **« À VALIDER »** ; cette décision la referme.

## Contexte

Deux points laissés ouverts par le cahier des charges :

1. Le montant et la structure des frais de livraison à domicile.
2. Ce qui se passe si le panier est sous le minimum de commande pour la livraison à
   domicile — le cahier propose deux options concurrentes sans trancher : « frais de
   livraison appliqués **ou** dépôt en agence imposé ».

## Décision

**Frais de livraison** : forfait unique configurable (`DELIVERY_FEE_XOF`,
`libs/shared/domain/business-config.ts`), gratuit au-dessus de `FREE_DELIVERY_THRESHOLD_XOF`
— exactement la proposition par défaut du cahier des charges. Pas de tarification par
commune en V1 (la donnée `Address.commune` existe déjà si une V2 le justifie).

**Sous le minimum de commande** (`MIN_ORDER_XOF`) : la livraison à domicile est
**refusée côté serveur**, pas simplement surtaxée. Un panier sous le minimum ne peut pas
valider une commande en mode `HOME` ; le message d'erreur identifie le montant manquant et
propose explicitement le dépôt en agence comme alternative. Rejeté : appliquer
automatiquement des frais supplémentaires sans prévenir — un client ne doit jamais découvrir
un montant plus élevé qu'attendu seulement au moment de payer.

## Conséquences

- `DELIVERY_FEE_XOF`, `FREE_DELIVERY_THRESHOLD_XOF`, `MIN_ORDER_XOF` vivent uniquement dans
  `libs/shared/domain/business-config.ts` — l'API les utilise pour le calcul réel du total
  (lot 3, incrément 4) et le web pour l'affichage sur `/tarifs`. Jamais déclarés une seconde
  fois.
- Le contrôle du minimum de commande est une validation de checkout (incrément 4), pas une
  règle de panier : un panier sous le minimum reste modifiable normalement, seule la
  validation en mode `HOME` est bloquée.

## Alternative écartée

Appliquer des frais de livraison majorés automatiquement sous le minimum : rejeté pour la
raison ci-dessus (surprise tarifaire au paiement).
