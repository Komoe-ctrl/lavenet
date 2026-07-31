# LaveNet

Blanchisserie en ligne pour Abidjan — commande, suivi et paiement depuis le web.

## Développement

Prérequis : Node 26, pnpm (version épinglée dans `package.json#packageManager`), un
fichier `.env` à la racine (voir `.env.example`).

```bash
pnpm install
pnpm nx serve api      # http://localhost:3000  (+ /docs pour Swagger)
pnpm nx serve web      # http://localhost:4200
```

La CI GitHub Actions est temporairement en déclenchement manuel uniquement
(`workflow_dispatch`, voir le commentaire en tête de
`.github/workflows/ci.yml`) — en attendant, joue la même séquence en local
avant chaque merge :

```bash
pnpm ci:local
```

`ci:local` enchaîne install, lint, typecheck, test, build, puis
`api:client:check` (vérifie que le client Angular généré correspond
toujours à l'API réellement exposée).
