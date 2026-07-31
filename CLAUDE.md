# CLAUDE.md — LaveNet (application web de blanchisserie)

> **Édition Angular + NestJS.** Remplace intégralement la version Next.js.
> Ce fichier est la source de vérité pour tout agent travaillant sur ce dépôt.
> En cas de conflit entre une demande ponctuelle et ce document : **signale le conflit
> avant d'agir**, ne contourne pas silencieusement une règle.

---

## 1. Contexte

Application web de blanchisserie (lavage, repassage, pressing) pour particuliers et
professionnels en Côte d'Ivoire. Le client commande en ligne, planifie un retrait et une
livraison, suit l'état de ses vêtements, paie (Mobile Money / carte / à la livraison).
Un back-office permet de gérer clients, commandes, livreurs et statistiques.

Le mobile est une **WebView** de l'app web → tout doit être _mobile-first_, utilisable
sur réseau lent (3G Abidjan), et fonctionner sans hover.

**Ce dépôt est une pièce de portfolio.** La qualité du code, des commits, du contrat
d'API et du README compte autant que les fonctionnalités. Un recruteur lira `git log`,
`schema.prisma` et la spec OpenAPI avant de cliquer sur la démo.

**Le choix Angular + backend séparé est délibéré et assumé** : il est plus coûteux qu'un
framework fullstack, mais il oblige à concevoir un vrai contrat d'API, une authentification
qui traverse une frontière réseau et un monorepo typé de bout en bout. Ce choix doit être
défendu explicitement dans `docs/ADR/0001-stack.md` — pas subi.

---

## 2. Stack imposée

| Couche        | Choix                                                                                            | Non négociable |
| ------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| Monorepo      | Nx workspace, pnpm                                                                               | oui            |
| Frontend      | Angular 21 — standalone components, **signals**, zoneless, nouveau control flow (`@if` / `@for`) | oui            |
| Backend       | NestJS 11 (REST)                                                                                 | oui            |
| Langage       | TypeScript `strict: true` des deux côtés                                                         | oui            |
| ORM           | Prisma (backend uniquement)                                                                      | oui            |
| Base          | PostgreSQL 16                                                                                    | oui            |
| Validation    | **zod**, schémas partagés dans `libs/shared` (via `nestjs-zod` côté API)                         | oui            |
| Contrat d'API | OpenAPI généré par `@nestjs/swagger`, client Angular généré depuis la spec                       | oui            |
| UI            | Tailwind CSS + Angular CDK (a11y, overlay, table)                                                | oui            |
| État client   | Signals natifs ; NgRx **SignalStore** uniquement pour panier et session                          | oui            |
| Auth          | JWT court + refresh token en cookie `httpOnly`                                                   | oui            |
| Tests         | Vitest (web + api unitaires), Supertest (api e2e), Playwright (3 parcours)                       | oui            |
| Lint          | ESLint + Prettier + `@nx/enforce-module-boundaries`                                              | oui            |
| Hooks git     | Husky + lint-staged + commitlint                                                                 | oui            |
| CI            | GitHub Actions avec `nx affected`                                                                | oui            |
| Déploiement   | Web : Vercel/Netlify (static) · API : Render ou Railway · DB : Neon                              | oui            |

**Interdits :** `any` non justifié par un commentaire, `@ts-ignore` sans ticket,
`console.log` hors logger, appel `HttpClient` direct depuis un composant, Prisma importé
côté web, `subscribe()` manuel là où `toSignal`/`resource` suffit, NgModules (tout est
standalone), `zone.js` réintroduit, dépendance ajoutée sans justification dans le commit,
Supabase (l'auth passe par notre API), requête SQL brute sauf agrégat de dashboard et
réservation de créneau (voir §4).

> **Vérifie la version installée avant d'écrire.** Angular 21 et NestJS 11 ont des API
> récentes (signal forms, `httpResource`, zoneless par défaut). Ne te fie pas à ta
> mémoire : lis `package.json` et les types réels du paquet avant d'utiliser une API.
> Si une API que tu comptais utiliser n'existe pas dans la version installée, dis-le et
> propose l'alternative, ne l'invente pas.

---

## 3. Architecture

```
apps/
  web/                              # Angular 21
    src/app/
      core/                         # singletons : interceptors, guards, auth, config, api client généré
      shared/                       # composants UI génériques, pipes (money, status), directives
      features/
        orders/
          data-access/              # services d'appel API + SignalStore éventuel
          ui/                       # composants présentationnels (inputs/outputs, zéro injection HTTP)
          feature/                  # composants routés (smart), routes lazy
        catalog/  cart/  checkout/  payments/  delivery/  loyalty/  support/  admin/  auth/
      app.routes.ts                 # routing racine, tout en lazy
  api/                              # NestJS 11
    src/
      modules/
        orders/
          domain/                   # règles métier PURES — zéro import Prisma/Nest
          orders.service.ts         # orchestration
          orders.controller.ts      # HTTP, validation, autorisation
          orders.repository.ts      # accès Prisma
        catalog/ auth/ payments/ delivery/ loyalty/ support/ admin/ notifications/
      common/                       # guards, interceptors, filters, decorators, logger
      prisma/                       # PrismaService (singleton)
libs/
  shared/
    domain/                         # machine à états, calcul de prix, règles de fidélité — utilisées par LES DEUX apps
    schemas/                        # schémas zod partagés (DTO d'entrée/sortie)
    types/                          # types dérivés des schémas
prisma/
  schema.prisma  migrations/  seed.ts
docs/
  ARCHITECTURE.md  API.md  ADR/
```

**Règles de dépendance (tags Nx, à faire respecter par le linter) :**

- `apps/web` → `libs/shared/*` uniquement. **Jamais** `apps/api`, jamais Prisma.
- `apps/api` → `libs/shared/*`.
- `libs/shared/domain` → n'importe **rien** (code pur, testable sans base ni DOM).
- `features/X` ne peut pas importer `features/Y/data-access` : passer par l'`index.ts`
  de la feature.
- `ui/` ne fait aucune injection de service HTTP : inputs/outputs uniquement.

**Flux de données côté web :** composant routé → service `data-access` → client API
généré → HTTP. Le composant ne connaît ni URL ni `HttpClient`. Chargement via `resource()`
/ `toSignal`, pas de `subscribe()` manuel dans un composant.

**Flux côté API :** controller (auth + validation zod) → service (orchestration,
transaction) → domain (règle pure) → repository (Prisma). Le controller ne contient
jamais de règle métier ; le domain ne connaît jamais Prisma.

**Le contrat d'API est généré, pas écrit à la main deux fois.** Le client Angular est
produit depuis la spec OpenAPI par un script (`pnpm api:client`) et committé. Une
divergence front/back doit casser le typecheck, pas se découvrir en production.

---

## 4. Modèle de données (référence)

Nommage anglais, `camelCase` en Prisma, tables `snake_case` via `@@map`.

```
User(id, role[CLIENT|STAFF|COURIER|ADMIN], email?, phone, phoneVerifiedAt, passwordHash, deletedAt?)
RefreshToken(id, userId, tokenHash, expiresAt, revokedAt?, userAgent)
Address(id, userId, label, commune, quartier, details, geoLat?, geoLng?, isDefault)
Agency(id, name, address, openingHours)
ServiceCategory(id, slug, name, position)
Service(id, categoryId, slug, name, unit[PIECE|KG], processingHours, isActive)
ArticleType(id, name, iconKey)
PriceRule(id, serviceId, articleTypeId?, amountXof, effectiveFrom, effectiveTo?)
Order(id, reference, userId, status, subtotalXof, discountXof, deliveryFeeXof,
      vatRateBps, vatAmountXof, totalXof, promoCodeId?, pickupSlotId, deliverySlotId, ...)
OrderItem(id, orderId, serviceId, articleTypeId, quantity, unitPriceXof, instructions)
OrderStatusHistory(id, orderId, fromStatus, toStatus, actorId, reason, createdAt)
TimeSlot(id, date, startsAt, endsAt, capacity, bookedCount)
SlotBooking(id, slotId, seatIndex, orderId)          # @@unique([slotId, seatIndex])
Delivery(id, orderId, type[PICKUP|DROPOFF], courierId?, slotId, otpHash, confirmedAt)
Payment(id, orderId, provider, status, amountXof, providerRef, idempotencyKey, rawPayload)
Invoice(id, orderId, number, issuedAt, pdfUrl)
PromoCode / LoyaltyAccount / LoyaltyTransaction / Referral
SupportTicket / TicketMessage / Notification / AuditLog
```

**Règles dures :**

1. **Argent = `Int` en francs CFA.** Le XOF n'a pas de sous-unité. Jamais de `Float`,
   jamais de `Decimal`. Tout champ monétaire est suffixé `Xof`. Helpers dans
   `libs/shared/domain/money.ts`. Le taux de TVA est stocké en points de base
   (`vatRateBps`, `Int`, 0 par défaut) et figé sur la commande — **même à zéro**.
2. **Le prix est figé à la commande.** `OrderItem.unitPriceXof` est copié depuis
   `PriceRule` au checkout. Changer un tarif ne réécrit jamais l'historique.
3. **Machine à états dans `libs/shared/domain/order-state-machine.ts`**, fonction pure
   `canTransition(from, to)`, utilisée par l'API (autorité) **et** par le web (affichage
   des actions possibles). Une seule source de vérité, testée exhaustivement.
   `DRAFT → PENDING_PICKUP → PICKED_UP → PROCESSING → READY → OUT_FOR_DELIVERY → DELIVERED`
   \+ `CANCELLED` (depuis `DRAFT`/`PENDING_PICKUP`) et `ON_HOLD` (motif obligatoire).
   Toute transition écrit une ligne `OrderStatusHistory`.
4. **Capacité de créneau garantie par la base**, pas par du code applicatif :
   `SlotBooking` avec `@@unique([slotId, seatIndex])`. La réservation tente d'insérer
   un siège ; une violation de contrainte unique = créneau plein. Testé par un test
   d'intégration à deux requêtes concurrentes.
5. **Numérotation de facture séquentielle sans trou** : séquence Postgres dédiée,
   consommée dans la même transaction que la création de la facture.
6. **Paiements idempotents.** `Payment.idempotencyKey` unique, signature du provider
   vérifiée avant tout traitement, montant recalculé côté serveur — jamais lu du client.
7. **Secrets jamais en clair** : `passwordHash` (argon2id via `@node-rs/argon2` —
   binaires précompilés par plateforme, aucune chaîne de compilation native requise,
   contrairement au paquet `argon2` historique), `otpHash`, `tokenHash`. OTP 6 chiffres,
   TTL 10 min, 5 tentatives, rate-limit par téléphone.
8. **Soft delete** (`deletedAt`) sur `User`, `Order`, `Service` ; exclu des exports et stats.
9. `id` = `cuid()`. `Order.reference` lisible et unique : `LN-2026-000142`.
10. Index sur toutes les FK filtrées + `Order(status, createdAt)`.
11. Migrations générées (`prisma migrate dev --name ...`), relues, committées.
    **Jamais `db push` sur une base contenant des données.** Prisma utilise
    `DATABASE_URL` (connexion poolée) et `DIRECT_URL` (non poolée, pour les migrations).

---

## 5. Sécurité (non négociable)

L'API est la **seule** frontière de sécurité. Le front n'est qu'une UI : tout ce qu'il
cache, un `curl` le verra.

- Un guard d'autorisation sur **chaque** route : `@Roles('ADMIN')`, et vérification de
  propriété de la ressource (`assertOwnsOrder`, `assertOwnsDelivery`). Un client ne doit
  jamais lire une commande d'autrui en changeant l'id dans l'URL ; un livreur ne voit que
  sa tournée. Chaque cas d'IDOR est couvert par un test.
- Validation zod de toute entrée (body, params, query) via un pipe global.
- Rate-limit (`@nestjs/throttler`) sur login, envoi OTP, création de commande, messages.
- **CORS et cookies cross-domain** : le web et l'API sont sur des domaines différents →
  `credentials: true`, origine en liste blanche, cookie refresh `httpOnly` `Secure`
  `SameSite=None`, protection CSRF sur les routes mutantes. **À valider dès le lot 0**,
  c'est le piège n°1 de cette architecture.
- Access token en mémoire côté Angular (jamais `localStorage`), refresh silencieux par
  interceptor, file d'attente des requêtes pendant le refresh.
- **Restauration de session paresseuse, pas au bootstrap.** `SessionStore.restore()`
  (l'appel qui échange le cookie refresh contre un access token) ne se déclenche
  jamais au démarrage global de l'app : il est appelé depuis le guard de la première
  route privée visitée (`status() === 'idle'` → un seul appel, mémoïsé ensuite par le
  statut). Les pages publiques (accueil, tarifs, login) ne doivent jamais provoquer
  d'appel API au seul chargement — condition de lot 0 vérifiée explicitement (API
  éteinte, zéro requête réseau au chargement de la racine). Un `inject()` utilisé
  après un `await` dans un guard fonctionnel casse le contexte d'injection
  (`NG0203`) : tout `inject()` nécessaire se fait avant le premier `await`.
- Secrets via configuration validée par zod au démarrage. `.env.example` committé.
- Aucune donnée personnelle dans les logs (téléphone, adresse masqués).
- Uploads : type et taille vérifiés côté serveur.

---

## 6. Conventions de code

**Commun** — fichiers `kebab-case.ts`, une responsabilité par fonction exportée
(> 60 lignes → découper), commenter le _pourquoi_ jamais le _quoi_, textes UI en
français / code en anglais, dates stockées en UTC et affichées en `Africa/Abidjan`.

**Angular**

- Standalone partout, `ChangeDetectionStrategy.OnPush` systématique.
- `input()` / `output()` / `model()` en fonctions signal, pas les décorateurs.
- `inject()` plutôt que l'injection par constructeur.
- Nouveau control flow `@if` / `@for` / `@switch` ; `@defer` pour le back-office lourd.
- Toute route est lazy (`loadComponent` / `loadChildren`).
- Un composant ne s'abonne pas manuellement : `toSignal`, `resource`, `async` pipe.
- Trois états obligatoires par écran : chargement, erreur, vide. Pas d'écran blanc.
- A11y : labels sur tous les champs, focus visible, contraste AA, clavier, cibles ≥ 44 px.
- Pas de chaîne en dur dans les templates : `shared/i18n/fr.ts`.

**NestJS**

- Un module par contexte métier, exports explicites.
- DTO dérivés des schémas zod partagés — pas de duplication de forme entre front et back.
- Erreurs métier → exceptions typées mappées en codes HTTP par un filtre global, avec un
  corps d'erreur stable et documenté (`{ code, message, details? }`).
- Transactions Prisma pour toute opération multi-écritures (commande + créneau + paiement).
- Logs structurés avec identifiant de corrélation par requête.

---

## 7. Tests — ce qui doit être couvert

Pas de course au pourcentage. Sans exception :

- `libs/shared/domain/**` → unitaire à 100 % des règles : calcul de prix, TVA, remises,
  points de fidélité (dont solde mixte valide/expiré), machine à états (matrice complète
  des transitions valides et invalides), validité des créneaux.
- API → tests d'intégration sur Postgres jetable (Testcontainers ou service CI) :
  parcours de commande, IDOR sur chaque ressource, réservation concurrente d'un dernier
  créneau, rejeu de webhook de paiement (deux appels = un seul effet), numérotation de
  facture sous concurrence.
- Web → unitaire sur les stores et pipes, composants critiques (checkout) avec Vitest.
- E2E Playwright, 3 parcours : inscription + OTP, commande complète jusqu'au paiement,
  changement de statut par un admin.

Un bug corrigé = un test de non-régression dans le même commit.

---

## 8. Git — discipline attendue

**Branches** : `main` protégée et toujours déployable ; `feat/<slug>`, `fix/<slug>`,
`chore/<slug>`, `refactor/<slug>`, `docs/<slug>`. Les commits `docs` et `chore` peuvent
aller directement sur `main`. Tout le reste (`feat`, `fix`, `refactor`) passe par une PR,
rebasée avant merge.

**Commits — Conventional Commits, en anglais, à l'impératif, scope = app ou module :**

```
feat(api/orders): snapshot unit price at checkout (F-CMD-05)
feat(web/cart): add signal store for cart persistence (F-CMD-02)
fix(api/payments): reject webhook with invalid signature (F-PAY-03)
refactor(shared/domain): extract vat computation from order service
test(shared/domain): cover full state transition matrix (F-STA-01)
chore(ci): run nx affected on pull requests
docs(adr): record Angular + NestJS stack decision
```

- Un commit = un changement cohérent qui **compile et passe les tests**.
- Référence l'exigence du cahier des charges (`F-CMD-04`) quand elle existe.
- Corps de commit obligatoire dès que le _pourquoi_ n'est pas évident.
- Pas de `wip`, `update`, `fix bug`. Pas de commit de 40 fichiers non liés.
- Le client API généré est committé, dans un commit séparé de son utilisation.

**Hook pre-commit** : lint + typecheck + tests unitaires sur les projets affectés.

**PR** : contexte, changements, comment tester, captures pour l'UI, checklist (tests,
migration relue, pas de secret, doc et spec OpenAPI à jour).

---

## 9. Definition of Done

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verts en local et en CI
- [ ] La feature marche à 375 px et en WebView
- [ ] Autorisation vérifiée **côté API**, entrées validées par zod
- [ ] Chargement / erreur / vide gérés côté web
- [ ] Migration Prisma générée, seed à jour
- [ ] Spec OpenAPI et client généré régénérés si le contrat a changé
- [ ] Tests écrits pour la logique métier introduite
- [ ] Commits propres et conventionnels
- [ ] README / `docs/` à jour si le comportement public change

---

## 10. Commandes

```bash
docker compose up -d          # postgres local
pnpm nx serve api             # http://localhost:3000  (+ /docs pour Swagger)
pnpm nx serve web             # http://localhost:4200
pnpm api:client               # régénère le client Angular depuis la spec OpenAPI
pnpm db:migrate  db:seed  db:studio
pnpm nx affected -t lint typecheck test build
pnpm test:e2e
```

**Scripts de seed et fichier d'environnement en argument, pas en variable.** `db:seed`
lit `.env` par défaut ; toute variante (ex. `db:seed:prod` → base de production) passe le
fichier `.env.*.local` voulu en argument CLI explicite (`node ... prisma/seed.ts
.env.production.local`), jamais via une variable d'environnement shell — `VAR=val cmd`
ne fonctionne pas identiquement sur PowerShell/cmd.exe et bash, un argument CLI si. Le
fichier de dev (`.env`) n'est jamais touché par une variante de production : deux scripts
séparés, deux fichiers séparés, aucun risque d'oubli de restauration. Voir
`prisma/seed.ts` et le README §Déploiement.

Le seed doit produire une démo crédible : 5 catégories, ~10 services, ~15 types
d'articles aux tarifs XOF réalistes pour Abidjan, 3 clients (dont 1 professionnel),
1 livreur, 1 agent, 1 admin, ~25 commandes réparties sur tous les statuts et sur 60 jours
(pour que le dashboard ait de vraies courbes), 2 codes promo dont un expiré,
1 réclamation ouverte. Comptes de démo documentés dans le README.

---

## 11. Périmètre

**V1 démontrable :** auth (email/mot de passe + OTP téléphone simulé), profil, adresses,
catalogue et tarifs, panier, checkout avec créneaux à capacité, machine à états, suivi
client, paiement sandbox (Mobile Money simulé + espèces), facture PDF, back-office
(dashboard, commandes, services/tarifs, export CSV), tournée livreur avec confirmation OTP.

**V2 documenté, non codé :** paiement carte réel, abonnements et packs, parrainage, chat
temps réel et WhatsApp, application native, multi-agences avancé, optimisation de tournées.

Toute intégration externe (Wave, Orange Money, SMS) passe par une **interface** avec une
implémentation `Sandbox*` par défaut : la démo tourne sans aucune clé API. En mode
`DEMO_MODE=true`, les codes OTP sont affichés à l'écran dans un bandeau « mode
démonstration » — un visiteur ne doit jamais rester bloqué faute de SMS. C'est un choix
d'architecture à assumer dans un ADR, pas un raccourci à cacher.

---

## 12. Comment tu dois travailler (agent)

1. **Lis avant d'écrire.** Explore, résume ce que tu as compris, puis propose.
2. **Plan d'abord.** Toute tâche > 1 fichier : plan court, validation, exécution.
3. **Petits incréments committés.** Jamais 30 fichiers d'un coup sans commit intermédiaire.
4. **Contrat d'abord.** Pour une feature qui traverse la frontière : schéma zod partagé
   → endpoint API testé → client généré → UI. Pas l'UI en premier sur des données feintes.
5. **Demande avant toute action destructive** : suppression de dossier, reset de base,
   `git reset --hard`, force push, changement de stack ou de bibliothèque structurante.
6. **Ne devine pas une règle métier.** Si le cahier des charges est muet, pose la question
   ou écris un ADR avec une proposition explicite marquée `À VALIDER`.
7. **Ne devine pas une API de framework.** Vérifie contre la version installée.
8. **Ne mens pas sur l'état du travail.** Si un test échoue, dis-le. Ne commente jamais
   un test pour faire passer la CI.
9. **Documente les décisions** dans `docs/ADR/NNN-titre.md` : contexte, décision,
   conséquences, alternatives écartées.
10. Mets ce fichier à jour quand une convention change.
