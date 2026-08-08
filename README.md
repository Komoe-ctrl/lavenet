# LaveNet

[![CI](https://github.com/Komoe-ctrl/lavenet/actions/workflows/ci.yml/badge.svg)](https://github.com/Komoe-ctrl/lavenet/actions/workflows/ci.yml)

Le pressing en ligne pour Abidjan : commande de lavage/repassage, collecte et livraison,
suivi de commande, paiement Mobile Money ou espèces. Ce dépôt est une pièce de
portfolio — la qualité du code, des commits et du contrat d'API compte autant que les
fonctionnalités.

**État actuel** : lots 0 à 3 livrés — authentification complète (inscription, OTP, mot de
passe, profil, adresses), catalogue et tarifs publics, panier, mode de retrait et
créneaux à capacité, checkout (gel des prix, réservation atomique des créneaux,
référence de commande). Machine à états et suivi client (lot 4) et le reste du parcours
V1 (voir CLAUDE.md §11) restent à construire.

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

## Mise en service

Toutes les informations d'entreprise affichées sur les pages publiques (nom commercial,
email, téléphone, WhatsApp, adresse, communes desservies, frais de livraison, minimum de
commande, horaires, réseaux sociaux) viennent d'un seul fichier, typé et validé par un
schéma zod : `apps/web/src/app/shared/config/site-config.ts`. Aucune de ces valeurs n'est
écrite en dur ailleurs dans les gabarits.

Pour passer de la démo au réel :

1. Ouvrir `apps/web/src/app/shared/config/site-config.ts` et renseigner les champs de
   `contact` (`email`, `phone`, `whatsapp`, `address`) et de `social`.
2. Chaque champ de contact est optionnel (`null` tant qu'il n'est pas renseigné) : le
   bouton ou lien correspondant n'apparaît sur le site que si sa valeur est renseignée —
   aucun lien mort, aucune coordonnée inventée.
3. Une valeur manquante ou mal formée (email invalide, téléphone non conforme au format
   E.164) fait échouer le build (`siteConfigSchema.parse` s'exécute au chargement du
   module) plutôt que de laisser passer une donnée cassée en production.

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

**Seeder / mettre à jour le catalogue en production** (catégories, services, types
d'article, tarifs — indépendant des comptes, rejouable sans risque) :

1. `.env.production.local` déjà en place (voir ci-dessus).
2. `pnpm db:seed:catalog:prod`

Contrairement au seed de comptes, ce script n'a pas de garde sur une base vide : il
upsert `ServiceCategory`/`Service`/`ArticleType` par slug (les métadonnées affichées se
mettent à jour si elles changent dans `prisma/catalog-data.ts`) et n'ajoute que les
`PriceRule` qui n'existent pas encore — un tarif déjà enregistré n'est jamais réécrit
(l'historique des prix ne se modifie pas, voir CLAUDE.md §4). Rejouer la commande après
avoir ajouté un nouveau service ou un nouveau tarif dans `prisma/catalog-data.ts` ne fait
qu'ajouter ce qui manque. Vérifié contre le scénario réel (utilisateurs déjà en base,
catalogue vide) sur la branche dev Neon avant la mise en production.

**Seeder l'agence en production** (une ligne, F-CMD-03 — dépôt en agence) :

1. `.env.production.local` déjà en place (voir ci-dessus).
2. `pnpm db:seed:agency:prod`

Upsert par `slug`, comme le catalogue — rejouable sans risque après une modification de
`prisma/agency-data.ts`.

**Seeder / renouveler les créneaux en production** (F-CMD-04 — sans ça, le checkout est
impossible : `PATCH /cart/slots` et `POST /cart/checkout` n'ont aucun `TimeSlot` à
proposer ou à réserver) :

1. `.env.production.local` déjà en place (voir ci-dessus).
2. `pnpm db:seed:slots:prod`

Même principe d'idempotence que le catalogue (upsert par la contrainte unique
`(date, startsAt)`, jamais de doublon), mais avec une différence importante : contrairement
au catalogue ou à l'agence, **ce script doit être rejoué périodiquement**. Il génère une
fenêtre glissante de `WINDOW_DAYS` (21) jours **à partir du moment où il tourne**
(`prisma/timeslot-data.ts`), pas une plage calendaire fixe — chaque jour qui passe fait
sortir un jour du bout de la fenêtre sans qu'un nouveau soit ajouté à l'autre bout. Sans
rejeu, la fenêtre s'épuise en 21 jours et le checkout redevient bloqué, silencieusement.

_Pourquoi pas un vrai back-office de créneaux dès maintenant ?_ La création de créneaux
en back-office (F-LIV-01/F-ADM-05) est un lot plus tardif ; jusque-là, ce script est la
seule source de `TimeSlot`.

## Renouvellement automatique

Un compte manuel n'est pas fiable dans la durée — `.github/workflows/reseed-slots.yml`
rejoue `pnpm db:seed:slots:prod` **tous les jours à 06:00 UTC**, une marge large avant
que la fenêtre glissante de 21 jours ne s'épuise même si un ou plusieurs jours d'affilée
échouent avant que quelqu'un ne réagisse.

- Gratuit (minutes GitHub Actions incluses), ne dépend pas du réveil de l'API Render
  (contrairement à un cron interne à l'app, peu fiable vu `docs/ADR/0003` — l'API peut
  dormir des jours sans visite).
- Déclenchement manuel possible à tout moment (`workflow_dispatch`, onglet Actions du
  dépôt), en plus du calendrier.
- Un échec ouvre (ou commente, si déjà ouverte) une issue GitHub étiquetée
  `slots-reseed-failure` avec le lien du run — visible dans l'onglet Issues, pas
  seulement dans l'historique Actions qu'il faudrait penser à aller consulter.
- **Nécessite un secret de dépôt** : `PROD_DATABASE_URL`, la même chaîne de connexion
  que la ligne `DATABASE_URL` de votre `.env.production.local` local. À ajouter dans
  Settings → Secrets and variables → Actions → New repository secret. C'est la seule
  étape que je ne peux pas faire moi-même.

Écarté : une régénération "paresseuse" déclenchée par l'API elle-même (ex. dans
`GET /slots`) mélangerait une route de lecture publique avec une écriture en base, et
resterait sujette au même problème de sommeil de l'API que le cron interne.

## Développement

Prérequis : Node 26, pnpm (version épinglée dans `package.json#packageManager`), un
fichier `.env` à la racine (voir `.env.example`).

Pour rejouer la même séquence que la CI avant de pousser :

```bash
pnpm ci:local
```

`ci:local` enchaîne install, lint, typecheck, test, build, puis `api:client:check`
(vérifie que le client Angular généré correspond toujours à l'API réellement exposée).
