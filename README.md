# LaveNet

[![CI](https://github.com/Komoe-ctrl/lavenet/actions/workflows/ci.yml/badge.svg)](https://github.com/Komoe-ctrl/lavenet/actions/workflows/ci.yml)

Le pressing en ligne pour Abidjan : commande de lavage/repassage, collecte et livraison,
suivi de commande, paiement Mobile Money ou espèces. Ce dépôt est une pièce de
portfolio — la qualité du code, des commits et du contrat d'API compte autant que les
fonctionnalités.

**État actuel** : lot 0 (fondations) livré — monorepo, contrat d'API généré, squelette
d'authentification (connexion, session, route protégée), déploiement. Le catalogue, le
panier, le checkout et le reste du parcours V1 (voir CLAUDE.md §11) restent à construire.

- Web : [lavenet.vercel.app](https://lavenet.vercel.app)
- API + doc OpenAPI : [lavenet-api.onrender.com/docs](https://lavenet-api.onrender.com/docs)

## Stack

| Couche               | Choix                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| Monorepo             | Nx + pnpm                                                                        |
| Frontend             | Angular 22, standalone, signals, zoneless, prerendering au build                 |
| Backend              | NestJS 11 (REST)                                                                 |
| Validation / contrat | zod partagé (`libs/shared`), `nestjs-zod`, OpenAPI généré, client Angular généré |
| ORM / base           | Prisma 7 (driver adapter) + PostgreSQL (Neon)                                    |
| État client          | Signals natifs ; NgRx SignalStore réservé à la session (et au panier, à venir)   |
| Auth                 | JWT court + refresh token en cookie `httpOnly`, rotation à chaque usage          |
| Hébergement          | API : Render (gratuit) · Web : Vercel (gratuit) · Base : Neon (gratuit)          |

Détails et arbitrages dans `docs/ADR/`.

## Architecture

```text
apps/web/     Angular — pages publiques prerendues, /compte protégée, client API généré
apps/api/     NestJS — auth, Prisma, OpenAPI/Swagger
libs/shared/  domain (règles pures) / schemas (zod, source de vérité du contrat) / types
prisma/       schema, migrations, seed
docs/ADR/     décisions d'architecture
```

Le contrat d'API n'est jamais écrit à la main deux fois : `apps/api` expose son schéma
OpenAPI, `pnpm api:client` régénère le client Angular depuis ce schéma, et
`pnpm api:client:check` échoue si le client committé a divergé de l'API réellement
exposée.

## Démarrage local

```bash
pnpm install
cp .env.example .env      # remplir DATABASE_URL/DIRECT_URL et les secrets JWT
pnpm db:seed               # crée les comptes de démo (voir plus bas)
pnpm nx serve api          # http://localhost:3000  (+ /docs pour Swagger)
pnpm nx serve web          # http://localhost:4200
```

## Comptes de démo

Créés par `pnpm db:seed` (mot de passe identique pour les deux) :

| Rôle   | Email             | Mot de passe |
| ------ | ----------------- | ------------ |
| ADMIN  | admin@lavenet.ci  | `Demo1234!`  |
| CLIENT | client@lavenet.ci | `Demo1234!`  |

## Hébergement

L'API tourne sur une offre gratuite Render : après une période d'inactivité, le premier
appel peut prendre jusqu'à une minute pour réveiller le service — visible et expliqué
côté web (jamais un écran figé), détails et chiffre mesuré dans
`docs/ADR/0003-cold-start-strategy.md`.

## Déploiement

`render.yaml` applique les migrations en production à chaque déploiement
(`prisma migrate deploy`), mais ne seed jamais — le seed est une action manuelle,
volontaire, à part.

**Seeder les comptes de démo en production** (une fois, après le premier déploiement ou
après une remise à zéro de la base) :

1. `cp .env.production.local.example .env.production.local` et renseigner
   `DATABASE_URL` avec la chaîne de la branche **production** Neon. Ce fichier est
   ignoré par git (`.env.*.local`) et n'est jamais lu que par le script ci-dessous — le
   `.env` de développement n'est jamais touché.
2. `pnpm db:seed:prod`

Le script refuse de s'exécuter si la base cible contient déjà des utilisateurs — pas de
risque d'écraser des données par erreur de cible ou de double exécution.

## Développement

Prérequis : Node 26, pnpm (version épinglée dans `package.json#packageManager`), un
fichier `.env` à la racine (voir `.env.example`).

Pour rejouer la même séquence que la CI avant de pousser :

```bash
pnpm ci:local
```

`ci:local` enchaîne install, lint, typecheck, test, build, puis `api:client:check`
(vérifie que le client Angular généré correspond toujours à l'API réellement exposée).
