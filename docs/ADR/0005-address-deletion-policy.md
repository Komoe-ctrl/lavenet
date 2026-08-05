# ADR 0005 — Suppression d'adresse : soft delete, jamais de blocage

## Statut

Acté — 2026-08-05, au démarrage de F-AUTH-06 (carnet d'adresses). Il n'existe pas encore
de commande (lot 3) au moment de cette décision ; elle est prise maintenant pour que le
lot 3 n'hérite pas d'une ambiguïté.

## Contexte

Deux options pour `DELETE /addresses/:id` :

1. **Soft delete** (`deletedAt`), comme `User`/`Order`/`Service` (CLAUDE.md §4 règle 8).
2. **Refus** si l'adresse est référencée par une commande existante.

## Décision

**Soft delete inconditionnel**, jamais de refus lié à une commande.

Raisonnement : CLAUDE.md §4 règle 2 fige déjà le prix à la commande
(`OrderItem.unitPriceXof` copié depuis `PriceRule`, jamais relu après coup) précisément
pour qu'une commande passée reste correcte même si le tarif change ensuite. La même
logique s'applique à l'adresse : quand le lot 3 ajoutera le pickup/delivery à `Order`, il
devra **copier** les champs d'adresse utiles (commune, quartier, repère, coordonnées) sur
la commande au moment du checkout — pas garder une simple clé étrangère vers une ligne
`Address` mutable. Une commande ne doit pas se mettre à pointer vers « une autre adresse »
parce que l'utilisateur a modifié ou supprimé l'originale après coup.

Conséquence directe : une fois ce principe respecté par le lot 3, supprimer une adresse
ne peut plus jamais casser une commande historique, qu'elle soit ancienne ou récente.
Bloquer la suppression n'aurait donc protégé qu'un design que le lot 3 ne doit pas
adopter — un `deletedAt` simple suffit, exclut l'adresse des listes et de la rotation de
l'adresse par défaut, sans logique de blocage à maintenir.

## Conséquences

- `Address.deletedAt` (nullable), même convention que `User`/`Order`/`Service`.
- `AddressRepository` filtre systématiquement `deletedAt: null` sur les lectures/listes.
- Si l'adresse supprimée était la seule ou la dernière adresse par défaut, aucune adresse
  n'est promue automatiquement par défaut : l'utilisateur en choisit une explicitement à
  sa prochaine commande/visite du carnet. Pas de règle implicite de "promotion".
- **À valider explicitement par le lot 3** : `Order` (pickup/delivery) doit copier les
  champs d'adresse au checkout, pas référencer `Address` par clé étrangère consultée à la
  volée. Si le lot 3 s'écarte de cette décision, il doit rouvrir cet ADR.

## Alternative écartée

Refuser la suppression si `Address` est référencée par une commande : rejeté, parce que
la référence en question ne devrait jamais exister sous cette forme (voir raisonnement
ci-dessus) — implémenter le blocage aurait scellé le mauvais design pour le lot 3 au lieu
de le prévenir.
