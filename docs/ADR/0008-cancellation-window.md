# ADR 0008 — Délai d'annulation client

## Statut

Acté — 2026-08-08, au démarrage du lot 4 (F-STA). `docs/CAHIER-DES-CHARGES.md` §8
question 2 marque explicitement ce point **« À VALIDER »** ; cette décision la referme.

## Contexte

Le cahier des charges liste F-CMD-08 (« Annulation par le client tant que la commande n'a
pas été récupérée ») comme un `Must`, mais laisse ouvert : « Délai d'annulation gratuite
après validation ? ». Deux lectures possibles :

1. Annulation libre tant que le statut le permet (`DRAFT`/`PENDING_PICKUP`, cf. la machine
   à états), sans fenêtre de temps distincte.
2. Une fenêtre de grâce (ex. 30 minutes après validation), au-delà de laquelle
   l'annulation devient impossible même si la commande n'a pas encore été récupérée.

## Décision

**Pas de fenêtre de temps.** L'annulation reste possible tant que
`canTransition(status, 'CANCELLED')` l'autorise — c'est-à-dire tant que le statut est
`DRAFT` ou `PENDING_PICKUP` — sans condition supplémentaire liée à l'ancienneté de la
commande. Dès que le statut passe à `PICKED_UP` (le livreur a récupéré le linge),
l'annulation redevient impossible, quelle que soit l'heure de validation.

Retenu parce que la V1 n'a aucun paiement réel en amont (F-PAY est simulé/sandbox) : il
n'y a pas de remboursement à arbitrer, donc pas de raison métier de limiter la fenêtre
au-delà de ce que la machine à états impose déjà. Une fenêtre de grâce ajouterait une
règle et un test sans bénéfice observable tant que l'argent ne bouge pas réellement.

## Conséquences

- `POST /orders/:id/cancel` (F-CMD-08) délègue entièrement la question « peut-on annuler
  maintenant » à `canTransition`, sans horodatage de validation à comparer.
- Si un paiement réel (Mobile Money/carte, V2 documenté non codé, cahier §11) est ajouté
  plus tard, cette décision devra être révisée : annuler après un paiement effectivement
  débité change la question (remboursement), pas seulement le statut.

## Alternative écartée

Fenêtre de grâce fixe (ex. 30 min) : écartée pour l'instant, faute de paiement réel à
protéger en V1 — voir « Conséquences » ci-dessus pour la condition qui la rendrait
pertinente.
