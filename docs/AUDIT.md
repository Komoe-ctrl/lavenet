# AUDIT.md — Phase 0 : état des lieux contre la cible Angular + Nx + NestJS

> Rédigé sans modifier, créer ou supprimer de fichier de code. Seul fichier produit à
> cette étape. Tous les constats ci-dessous ont été **revérifiés directement sur le
> dépôt le 2026-07-29** (lecture de fichiers, `grep` des imports, versions installées
> dans `node_modules`, `git log`/`git ls-remote`) — aucune conclusion n'est reprise d'un
> audit précédent sans nouvelle vérification. Un `docs/AUDIT.md` antérieur (rédigé contre
> une cible Next.js) a été committé puis supprimé du dépôt avant cette phase
> (`57eee78` puis `a5f4ade`) ; son contenu n'est plus sur disque et n'est pas réutilisé
> ici — seules les commandes `git show` sur ces deux commits ont servi à confirmer *quels
> fichiers* avaient été ajoutés, pas à hériter de verdicts.
>
> **Mise à jour du 2026-07-30** : ce document intègre vos corrections suite à revue —
> rendu web (prerendering au build, pas de SSR, voir §5 et `docs/ADR/0002-web-rendering-strategy.md`),
> conservation intégrale de l'historique Git (§2), formulation de la TVA sur facture (§4),
> et ajout du risque de mise en veille des offres gratuites (§5). Le détail des décisions
> actées et des questions encore ouvertes est en §7.

---

## 1. État réel du dépôt

- **Git** : remote `origin` = `https://github.com/Komoe-ctrl/lavenet.git`, branche
  `main` synchronisée avec `origin/main` (`git ls-remote` confirme un seul ref distant,
  identique au HEAD local). 3 commits : `initial commit` (scaffold Angular CLI par
  défaut) → `chore: snapshot existing angular scaffold` (ajout de `CLAUDE.md`, du
  cahier des charges, et du code `core/`/`features/` jusque-là non versionné) →
  `chore: remove outdated audit`. Working tree propre, rien en attente.
- **`package.json`** : Angular CLI pur — `@angular/core` `^21.2.0` (installé réellement :
  **21.2.16**), `@angular/cli` installé **21.2.14**, gestionnaire `npm` (le `packageManager`
  déclaré est `npm@11.12.1`, pas `pnpm` comme l'exige la cible). **Aucune trace** de
  `nx`, `@nx/*`, `@nestjs/*`, `prisma`, `zod` ni dans `package.json` ni dans
  `node_modules`. Aucun `nx.json`, `workspace.json` ou `project.json` nulle part dans le
  dépôt : ce n'est pas un workspace Nx, même partiellement.
- **`prisma/`** : dossier inexistant. Aucun schéma, aucune migration.
- **CI** : aucun dossier `.github/workflows`. Aucune CI configurée à ce jour.
- **Secrets** : recherche de `.env*`, `*secret*`, `*credential*`, `*.pem`, `*.key` sur
  tout le dépôt (hors `node_modules`/`.git`) → aucun résultat. `.vscode/mcp.json` ne
  contient qu'une déclaration du serveur MCP `@angular/cli`, sans identifiant.
- **Zoneless** : `src/app/app.config.ts` ne déclare ni `provideZonelessChangeDetection()`
  ni `provideZoneChangeDetection()` — le projet est actuellement en zone.js implicite
  (comportement par défaut de `ng new` sans l'option zoneless), **pas** zoneless comme
  l'exige CLAUDE.md §2. À corriger explicitement au lot 0, ce n'est pas automatique.

### Imports pointant vers des fichiers inexistants (vérifié par `grep` + recherche sur disque)

Tous les fichiers suivants sont importés mais **absents du dépôt**, aucune exception :

| Fichier manquant | Importé par |
|---|---|
| `src/app/core/services/supabase.ts` | `core/services/auth.service.ts`, `features/admin/customers/customers.component.ts`, `features/admin/promotions/promotions.component.ts` |
| `src/app/core/models.ts` | `core/services/auth.service.ts` et les 6 composants admin |
| `src/app/core/services/order.service.ts` | `dashboard.component.ts`, `order-detail.component.ts`, `order.component.ts`, `reports.component.ts` |
| `src/app/core/services/catalog.service.ts` | `services.component.ts` |
| `src/app/core/guards/auth.guard.ts` | `app.routes.ts` (racine) |
| ~15 composants sous `features/client/*` (home, catalog, cart, checkout, orders, order-detail, profile, loyalty, support, client-layout) | `app.routes.ts` |

Conséquence : **ce code ne compile pas en l'état**, indépendamment du framework cible.
Ce n'est pas une opinion architecturale, c'est un fait vérifiable en lançant `ng build`
ou en ouvrant les imports un par un — ce que j'ai fait.

---

## 2. Inventaire et verdicts — évalués contre Angular + Nx + NestJS

| Élément | Constat | Verdict | Raison |
|---|---|---|---|
| `angular.json` | Builder moderne `@angular/build:application` (esbuild, pas l'ancien `@angular-devkit/build-angular`), budgets prod définis (500kB/1MB initial, 4kB/8kB par style de composant) | **ADAPTER** | Le fichier lui-même ne survit pas tel quel dans un monorepo Nx (chaque app a sa propre config de projet générée par `@nx/angular:app`), mais les **valeurs** (builder esbuild déjà choisi, budgets) sont un bon point de départ à reporter dans la config générée |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json` | Non lus en détail ici mais structure Angular CLI standard à la racine | **JETER** (fichiers) | Un workspace Nx a sa propre hiérarchie de `tsconfig.base.json` + un tsconfig par projet sous `apps/`/`libs/` ; ces fichiers racine n'ont pas leur place dans la structure cible |
| `.prettierrc` | `printWidth: 100`, `singleQuote: true`, parser `angular` pour le HTML | **GARDER** | Valeurs directement compatibles avec la cible, aucune raison d'en changer ; à copier tel quel à la racine du nouveau workspace |
| `.editorconfig` | Indentation 2 espaces, UTF-8, quotes simples en `.ts` | **GARDER** | Idem, générique et déjà cohérent avec les conventions CLAUDE.md §6 |
| `package.json` / `package-lock.json` | `npm`, aucune dépendance Nx/Nest/Prisma | **JETER** | Gestionnaire de paquets différent de la cible (`pnpm`) et aucune dépendance commune utile ; un `package-lock.json` npm ne peut pas cohabiter avec un `pnpm-lock.yaml` |
| `.vscode/mcp.json` | Déclare le serveur MCP `@angular/cli` | **GARDER** | Toujours pertinent : Angular reste le frontend, aucun secret dedans |
| `.vscode/extensions.json` | Recommande `angular.ng-template` | **ADAPTER** | À enrichir avec les extensions NestJS/Prisma/Nx pertinentes, mais la base est valide |
| `.vscode/tasks.json`, `.vscode/launch.json` | Tâches `npm start` / `npm test`, lancement Chrome sur `localhost:4200` | **ADAPTER** | Le principe (tâche de build en arrière-plan + config de debug Chrome) est bon, mais les commandes (`npm start`) doivent devenir `nx serve web`, et il manque une config équivalente pour `apps/api` |
| `.gitignore` | Standard Angular CLI (`/dist`, `/node_modules`, `.angular/cache`...) | **ADAPTER** | Base correcte à étendre : il manque `.nx/cache`, `.env`, `dist` par projet Nx, `apps/api/dist`, etc. |
| `src/app/app.html/.scss/.ts`, `src/index.html`, `src/main.ts`, `public/favicon.ico` | Placeholder par défaut de `ng new`, jamais personnalisé (logo Angular, liens vers angular.dev) | **JETER** | Zéro contenu produit ; à régénérer par `@nx/angular:app` puis à remplir |
| `README.md` (racine) | README généré par `ng new`, jamais édité | **JETER** | Aucun contenu spécifique au projet ; le README exigé par CLAUDE.md est un livrable à part entière |
| `core/services/auth.service.ts` | Auth via `getSupabase()` (Supabase Auth + table `profiles`), 100% côté client, aucune notion de refresh token/cookie | **JETER** | Interdit explicitement par CLAUDE.md §2 ("Supabase (l'auth passe par notre API)") ; architecture incompatible (pas de séparation `data-access` → client API généré → NestJS) ; import vers `./supabase` inexistant |
| `features/auth/login`, `features/auth/register` | Formulaires `FormsModule` + `ngModel`, appels directs à `AuthService` | **JETER** (code) / référence pour la copie FR uniquement | Cible = `input()`/`output()` signals, formulaires probablement réactifs typés depuis le schéma zod partagé, `data-access` séparé de `ui`. Rien de la structure n'est réutilisable. Les libellés FR ("Connexion", "Créer un compte", règles "Minimum 6 caractères") sont une référence de copywriting correcte, à retaper à la main |
| `features/auth/auth-layout` | Layout image (URL Pexels externe) + pitch marketing à gauche, formulaire à droite | **ADAPTER** (idée uniquement) | Bon pattern desktop, mais image tierce non hébergée par nous et marque affichée **"BlancoPro"** au lieu de "LaveNet" — à ne pas reproduire tel quel |
| `features/admin/*` (8 écrans) | CRUD/dashboard Angular + Supabase, statuts en `snake_case` (`picked_up`...), montants en `number` non typés `Xof` | **JETER** (code) / check-list d'écrans en référence | Bonne couverture *fonctionnelle* proche de F-ADM, mais imports vers `order.service.ts`/`catalog.service.ts`/`core/models.ts` **inexistants** (ne compile pas), pas de notion de contrat OpenAPI, pas d'autorisation serveur (tout passe par le client Supabase), statuts incomplets vs la machine à états CLAUDE.md (`ON_HOLD`, `DRAFT` absents) |
| `src/app/app.routes.ts` (modifié, non commité à l'origine puis committé) | Référence ~15 composants `features/client/*` jamais créés + un guard inexistant | **JETER** | Confirme que même l'espace client (catalogue, panier, checkout...) n'a jamais été implémenté, seul le routing a été esquissé |
| `src/styles.scss` (modifié) | Design tokens CSS (couleurs primaire bleu `#2563eb`/secondaire vert, radius, shadows) + classes utilitaires (`.btn`, `.card`, `.badge`, `.stat-card`, `.status-timeline`) | **ADAPTER** | La seule pièce avec une vraie valeur de démarrage : portable en 1-2h vers un thème Tailwind (`tailwind.config.ts`). Reste un gain marginal, pas déterminant |
| Historique Git (3 commits) | `initial commit`, `snapshot`, `remove outdated audit` — aucun commit ne contient de logique métier fonctionnelle | **GARDER** (non négociable, corrigé le 2026-07-30) | L'historique n'est pas un artefact de code qu'on trie par valeur : il reste intact quel que soit le contenu qu'il documente. Le passage au workspace Nx s'ajoute par des commits normaux (suppression des fichiers Angular CLI, ajout de la structure Nx), jamais par un rebase, un squash ou une réécriture. *Correction : la version précédente de cette ligne recommandait à tort de "repartir avec un historique propre" — ce n'est pas la bonne recommandation, l'historique se conserve* |

---

## 3. Convertir le workspace existant ou générer un workspace Nx neuf ?

**Recommandation : générer un workspace Nx neuf** (`npx create-nx-workspace`, preset
Angular monorepo intégré) et y **retaper à la main** les quelques éléments qui ont de la
valeur (tokens de style, libellés FR, liste d'écrans, valeurs de budget de build) —
pas de migration automatique du dépôt actuel.

**Coût réel de chaque option :**

- **Convertir en place (`nx init` sur le workspace Angular CLI actuel).** `nx init`
  sait ajouter Nx (cache de tâches, `nx.json`) à un workspace Angular CLI existant, mais
  il **ne restructure pas automatiquement** en `apps/<name>` + `libs/*` — il opère en
  général sur le layout à plat existant (racine = l'app). Pour arriver à
  `apps/web` + `apps/api` + `libs/shared`, il faudrait ensuite déplacer manuellement
  `src/` vers `apps/web/src`, réécrire la configuration de projet, générer `apps/api`
  et les trois `libs/shared/*` séparément — donc refaire quasiment tout le travail de
  structuration qu'un générateur ferait correctement du premier coup, avec un risque
  réel de configuration bâtarde (alias TypeScript, exécuteurs Nx, règles ESLint de
  frontières) difficile à diagnostiquer ensuite. Gain réel : conserver un historique Git
  sur un seul écran de démo Angular qui, de toute façon, ne compile pas — gain proche de
  zéro. Coût estimé : **0,75 à 1 jour** de restructuration manuelle risquée, *avant même*
  de commencer `apps/api`.
- **Générer un workspace neuf.** `create-nx-workspace` avec le preset Angular génère
  `apps/web` conforme dès la commande initiale ; `nx g @nx/nest:app api` et
  `nx g @nx/js:lib shared/domain|schemas|types` ajoutent le reste en suivant exactement
  l'arborescence de CLAUDE.md §3, avec des générateurs testés et une config ESLint de
  frontières fonctionnelle immédiatement. Coût : **0,25 à 0,5 jour** pour la génération
  brute, plus le temps normal (compté dans le lot 0) pour la configurer. Le report manuel
  des éléments à garder (tokens SCSS → Tailwind, 2 écrans de copie FR, liste des 8 écrans
  admin comme check-list) prend **1 à 2 heures**, largement inférieur au coût de la
  conversion.
- **Ce qui ne change pas selon l'option choisie** : le passage `npm` → `pnpm` est
  obligatoire dans les deux cas (aucune conversion automatique du lockfile), et le code
  applicatif (`auth.service.ts`, écrans admin) doit être réécrit intégralement dans les
  deux cas puisqu'il ne compile pas et vise un backend interdit (Supabase).

**Verdict : le workspace neuf est moins cher ET moins risqué.** Convertir n'a de sens
que si le workspace actuel contenait une quantité significative de code fonctionnel à
préserver ; ce n'est pas le cas ici (voir §2).

**Précision (2026-07-30)** : "workspace neuf" désigne uniquement la structure de
fichiers générée par les commandes Nx, pas l'historique Git. L'historique reste intact
(voir §2) — le lot 0 ajoute des commits normaux de suppression/ajout par-dessus les
trois commits existants, jamais un rebase ou un squash.

---

## 4. Zones ambiguës du cahier des charges — propositions par défaut

Le §8 du cahier des charges liste 7 questions ouvertes ; je les reprends et j'ajoute 4
zones supplémentaires que j'ai identifiées à la lecture (dont 2 propres à l'architecture
API séparée demandée par CLAUDE.md).

**Statut (2026-07-30) : les 11 décisions ci-dessous sont validées**, avec un amendement
sur le point 7 (facturation TVA, ci-dessous).

| # | Question | Proposition par défaut | Pourquoi |
|---|---|---|---|
| 1 | Frais de livraison — forfait, par commune, ou par distance ? (§5.3) | Forfait unique configurable (`DELIVERY_FEE_XOF`, défaut 1 000 F), gratuit ≥ 10 000 F de sous-total | Suggéré entre parenthèses par le document lui-même ; le calcul par commune/distance ajoute une table et une UI d'admin pour un gain de réalisme faible en V1 mono-agence |
| 2 | Délai d'annulation gratuite après validation ? (F-CMD-08) | Annulation libre tant que `status ∈ {DRAFT, PENDING_PICKUP}`, sans fenêtre de temps additionnelle | Cohérent avec la règle déjà écrite ; pas de règle temporelle non demandée à inventer |
| 3 | Client absent deux fois ? (F-LIV-05) | 1er échec → `ON_HOLD` + replanification proposée ; 2e échec → `ON_HOLD` avec motif "injoignable x2", traitement manuel obligatoire, jamais d'annulation automatique | Une opération physique (vêtements déjà en traitement) ne doit jamais être annulée par un automate |
| 4 | Dédommagement vêtement abîmé/perdu ? (F-SUP) | Avoir en points de fidélité = montant de la ligne, décision manuelle admin, tracé dans `AuditLog` (déjà suggéré §5.8) | Reprend la proposition du document ; pas de remboursement monétaire réel en V1 (cohérent avec paiement sandbox) |
| 5 | Expiration des points de fidélité ? (F-FID) | 12 mois sans mouvement (déjà suggéré §5.9), calculée à la lecture du solde, pas de job batch | Éviter un scheduler externe pour un portfolio déployé sur des plateformes gratuites/serverless |
| 6 | Facturation pro : par commande ou récapitulatif mensuel ? (F-AUTH-07) | Facture par commande en V1, récapitulatif mensuel documenté en V2 | Le récapitulatif mensuel implique un cycle de facturation et un batch, hors du périmètre "peu de features irréprochables" |
| 7 | TVA : TTC uniquement ou détail TVA sur facture ? | TTC uniquement, `vatRateBps = 0` par défaut, **aucune mention fiscale sur la facture** — le document affiche "Prix TTC", pas "TVA non applicable" (amendé le 2026-07-30) | Le modèle CLAUDE.md prévoit déjà `vatRateBps`/`vatAmountXof` figés sur la commande **même à zéro** : c'est une donnée de configuration technique, pas une affirmation juridique que le code n'a pas à formuler |
| 8 | Un livreur peut-il voir les commandes d'un autre livreur ? | Non — `assertOwnsDelivery(courierId, deliveryId)` en plus de `@Roles('COURIER')`, comme CLAUDE.md l'exige déjà explicitement en §5 | Analogie directe avec la règle IDOR déjà posée pour les clients |
| 9 | Un même numéro peut-il être client ET livreur/agent ? | Non — un compte = un rôle unique, changement de rôle réservé à un admin | Simplifie l'autorisation ; correspond à l'usage réel (livreur salarié ≠ client) |
| 10 *(nouveau)* | Format stable des erreurs API (`{code, message, details?}` mentionné en CLAUDE.md §6) — quelle taxonomie de codes ? | Codes en `UPPER_SNAKE_CASE` namespacés par domaine (`ORDER_NOT_FOUND`, `SLOT_FULL`, `AUTH_INVALID_CREDENTIALS`, `PAYMENT_ALREADY_PROCESSED`...), documentés dans `docs/API.md`, un seul filtre d'exception global qui les produit | Sans convention explicite, chaque module invente son format et le client Angular ne peut pas afficher un message fiable par type d'erreur |
| 11 *(nouveau)* | Durée de vie des tokens (non spécifiée ni par le cahier des charges ni par CLAUDE.md) | Access token JWT 15 min, refresh token 30 jours glissants, un refresh token par appareil (`RefreshToken.userAgent`), écran profil "déconnecter tous les appareils" | Des valeurs doivent exister dès le lot 1 pour que l'intercepteur de refresh silencieux soit testable ; 15 min/30 jours est un compromis standard, à ajuster si vous avez une préférence |

---

## 5. Risques techniques réels et mitigation

| Risque | Impact concret | Mitigation retenue |
|---|---|---|
| **Auth cross-domain** (cookie refresh `httpOnly`/`Secure`/`SameSite=None`, CORS `credentials`, CSRF, access token en mémoire + refresh silencieux par interceptor) | C'est le piège n°1 explicitement désigné par CLAUDE.md §5. `SameSite=None` exige HTTPS ; un test purement en localhost (http, même origine implicite) **ne détecte pas** les bugs de cookie cross-site qui n'apparaîtront qu'en prod entre deux domaines réels. File d'attente de requêtes pendant le refresh mal gérée → requêtes dupliquées ou perte de session sur un pic de latence 3G | Validé dès le **lot 0**, contre les vraies URLs déployées (web statique + API), pas en localhost. Intercepteur avec verrou de refresh unique (une seule requête de refresh en vol, les autres attendent). Test d'intégration API dédié + vérification manuelle en prod avant de considérer le lot 0 terminé |
| **Réservation concurrente d'un créneau** | Sur-réservation, deux clients sur le même dernier créneau | `SlotBooking` avec `@@unique([slotId, seatIndex])` (déjà dans CLAUDE.md §4) : la réservation tente un `INSERT`, une violation de contrainte = créneau plein. Testé par un test d'intégration à deux requêtes concurrentes réelles (pas simulées séquentiellement) |
| **Idempotence des webhooks de paiement** | Double crédit, double décrément | `Payment.idempotencyKey` unique + signature vérifiée avant traitement + traitement dans une transaction. Test de rejeu explicite (deux appels identiques = un seul effet) dès le lot paiement |
| **IDOR sur les ressources client et livreur** | Fuite de données personnelles en changeant un id dans l'URL — disqualifiant pour un portfolio "sécurité" | `assertOwnsOrder`/`assertOwnsDelivery` systématiques, testés par un cas "ressource d'autrui → 403/404" pour **chaque** route sensible, pas seulement les principales |
| **Numérotation de facture sans trou sous concurrence** | Deux factures émises à la même seconde pourraient collisionner ou sauter un numéro si calculée en applicatif (`SELECT MAX(number)+1`) | Séquence Postgres dédiée, `nextval()` consommé **dans la même transaction** que l'écriture de la facture — jamais de calcul applicatif du prochain numéro |
| **Pooling Prisma et migrations en production** | Neon (serverless) impose une distinction connexion poolée (PgBouncer, transaction mode) / connexion directe ; utiliser la mauvaise pour les migrations peut faire échouer `prisma migrate deploy`, ou épuiser le pool si l'API garde trop de connexions ouvertes | `DATABASE_URL` (poolée, `?pgbouncer=true`) pour le runtime NestJS, `DIRECT_URL` (non poolée) réservée à `prisma migrate deploy` en CI/CD, jamais utilisée par l'API au runtime. Limite de connexions Prisma explicite (`connection_limit`) proportionnée au pool Neon |
| **LCP en 3G sur WebView — risque aggravé par le choix Angular vs un framework SSR** | Angular est rendu **côté client** par défaut (SPA). Le cahier des charges cible LCP < 2,5s en 3G (NF-PERF-01) ; sans rendu au chargement, le temps avant premier rendu utile dépend du téléchargement + parsing + exécution du bundle JS avant que quoi que ce soit s'affiche | **Décision actée (2026-07-30, voir `docs/ADR/0002-web-rendering-strategy.md`) : pas de SSR.** Un rendu serveur véritable exigerait un runtime Node pour `apps/web` — un troisième service à déployer, incompatible avec l'hébergement statique prévu au lot 0. À la place : **prerendering au build** des pages publiques (accueil, tarifs, à propos, mentions légales) via `@angular/ssr` en mode build-time uniquement, CSR classique pour tout ce qui est derrière authentification, hébergement web 100 % statique conservé. Risque résiduel assumé : les écrans authentifiés (dashboard, checkout) restent en CSR pur, hors du périmètre de NF-PERF-01 (qui cible la page catalogue, publique) |
| **Contrat OpenAPI généré via `nestjs-zod` + `@nestjs/swagger`** | Écosystème moins éprouvé que le `class-validator` par défaut de NestJS ; un décalage entre schéma zod et spec OpenAPI générée casserait la promesse "le client généré ne diverge jamais du back" | Spike d'une heure au tout début du lot 0 sur un endpoint trivial pour valider que la chaîne zod → OpenAPI → client Angular fonctionne réellement avant d'en dépendre pour toutes les features suivantes ; si ça coince, alternative de repli à documenter en ADR (ex. DTO `class-validator` + schéma zod dupliqué uniquement côté validation métier fine) |
| **Zoneless Angular 21 + signals** | Écosystème encore jeune ; une librairie tierce non "zoneless-ready" peut ne pas déclencher la détection de changement | `ChangeDetectionStrategy.OnPush` strict partout + signals pour tout état, éviter toute librairie qui suppose zone.js (vérifier avant d'ajouter une dépendance, conformément à l'interdiction CLAUDE.md sur les dépendances non justifiées) |
| **Deux plateformes de déploiement distinctes (web statique + API)** | Deux jeux de variables d'environnement, deux points de défaillance, previews de PR compliquées (une preview web doit pointer vers une API — laquelle ? staging partagée ou preview API dédiée ?) | Tranché le 2026-07-30 : **API de staging unique** partagée par toutes les previews web (pas une API par PR, trop coûteux/lent pour un portfolio), documentée dans le README |
| **Mise en veille des offres gratuites (cold start)** *(ajouté le 2026-07-30, tranché le 2026-07-30)* | Les hébergements gratuits d'API (ex. Render free web service) s'endorment après quelques minutes d'inactivité, avec un réveil de 30 à 60 secondes, sans moyen supporté de l'éviter. Un visiteur de portfolio qui clique une fois et tombe sur un écran blanc pendant une minute ferme l'onglet | **Décision actée** : API sur Render en **instance payante** (7 $/mois) dès le lot 0 — le plan gratuit est jugé rédhibitoire pour un portfolio, pas de ping de maintien en éveil en repli. Base sur **Neon plan gratuit** : la mise en veille existe mais la reprise annoncée est de l'ordre de quelques centaines de ms, jugée acceptable. Web statique sur Vercel/Netlify (gratuit, pas de cold start côté statique). **Le temps de réponse à froid réel (pas la promesse du fournisseur) doit être mesuré et documenté dans `docs/ADR/0003-cold-start-strategy.md` avant de déclarer le lot 0 terminé**, y compris la reprise de la base après veille. Le README doit expliquer que l'API tourne sur une instance payante minimale et que la base se met en veille automatiquement, pour qu'un lecteur comprenne la contrainte d'hébergement comme une décision d'ingénierie assumée |
| **Périmètre du cahier des charges trop large pour "déployer vite"** | Livrable incomplet ou bâclé si on vise tout le V1 du cahier des charges tel quel | Voir §6 — découpage explicite en lots, avec un point d'arrêt recommandé si le temps réel est court |

---

## 6. Plan de livraison par lots

Ordonnancement imposé respecté : le lot 0 se termine avec les **deux** applications
réellement déployées (pas en localhost) et un appel authentifié qui traverse la
frontière ; le back-office minimal arrive juste après la machine à états et **avant**
le paiement.

Estimations en jours-personne pleins (tests, lint, doc inclus). **Le choix Angular +
NestJS séparé est structurellement plus cher qu'un framework fullstack pour la même
portée fonctionnelle** — CLAUDE.md l'assume lui-même ("plus coûteux qu'un framework
fullstack") ; je chiffre cet écart honnêtement plutôt que de le lisser.

| Lot | Objectif | Projets Nx touchés | Critère de fin | Estimation |
|---|---|---|---|---|
| **0. Fondations bout-en-bout déployées** | Workspace Nx généré, Postgres managé (**Neon, plan gratuit**), API déployée (**Render, instance payante 7 $/mois**), web déployé (**Vercel ou Netlify, statique, gratuit**), CI verte (`nx affected`), migration exécutée en prod, **un appel authentifié réel traversant les deux domaines déployés** | `apps/web`, `apps/api`, `libs/shared/*`, `prisma/schema.prisma` (User + RefreshToken minimum), `.github/workflows/ci.yml`, `docs/ADR/0003-cold-start-strategy.md`, README (section hébergement/contraintes) | URL publique web → appel à l'URL publique API → login retourne un cookie refresh cross-domain fonctionnel **en prod**, `nx affected -t lint typecheck test build` vert en CI, `prisma migrate deploy` exécuté sur la base managée (pas `db push`), **temps de réponse à froid réel de l'API (payante, ne devrait pas dormir) et de la base Neon mesuré et documenté** dans l'ADR, README expliquant les contraintes d'hébergement | 3 jours |
| **1. Auth complète** | Inscription email+mdp, OTP téléphone simulé, connexion, profil, adresses (F-AUTH-01,02,03,05,06), intercepteur de refresh silencieux | `apps/web` (feature `auth`), `apps/api` (module `auth`), `libs/shared/schemas` | Un compte de démo s'inscrit, reçoit un OTP simulé affiché en mode démo, se connecte, édite profil et adresse ; session survit à un refresh de page ; testé à 375px | 2,5 jours |
| **2. Catalogue et tarifs** | Services, catégories, grille tarifaire, page publique (F-CAT-01→05) | `apps/api` (module `catalog`), `apps/web` (feature `catalog`), seed | Page tarifs publique consultable sans compte, données réalistes Abidjan | 1 jour |
| **3. Panier + checkout + créneaux** | Panier (SignalStore), créneaux à capacité garantie par contrainte unique, récapitulatif, référence de commande (F-CMD-01→07) | `apps/web` (features `cart`, `checkout`), `apps/api` (modules `orders`, `delivery`), `libs/shared/domain` (prix, validité créneau) | Commande complète validée de bout en bout, total recalculé côté API, créneau plein non sélectionnable, test d'intégration à deux requêtes concurrentes sur le dernier siège | 3 jours |
| **4. Machine à états + suivi client** | Statuts, historique, frise client, annulation (F-STA, F-CMD-08,09) | `libs/shared/domain/order-state-machine.ts`, `apps/api` (module `orders`), `apps/web` (feature `orders`) | Matrice complète des transitions valides/invalides couverte par des tests unitaires ; client voit sa frise en français | 2 jours |
| **5. Back-office minimal** *(imposé avant le paiement)* | Liste des commandes + changement de statut (sous-ensemble de F-ADM-02) | `apps/web` (feature `admin`), `apps/api` (guard `@Roles('ADMIN', 'STAFF')`) | Un agent liste les commandes, change un statut via la machine à états, la transition est tracée dans `OrderStatusHistory` | 1,5 jour |
| **6. Paiement sandbox + facture** | Cash, Mobile Money simulé, webhook idempotent, numérotation séquentielle, PDF (F-PAY-01→06) | `apps/api` (module `payments`, séquence Postgres facture) | Webhook rejoué deux fois = un seul effet (testé) ; facture PDF téléchargeable après livraison | 2,5 jours |
| **7. Livraison + OTP** | Tournée livreur, confirmation par OTP (F-LIV-01→04) | `apps/web` (feature `delivery`, vue courier), `apps/api` (module `delivery`) | Transition `OUT_FOR_DELIVERY → DELIVERED` bloquée sans OTP valide, testée ; un livreur ne voit que sa tournée (IDOR testé) | 1,5 jour |
| **8. Polish démontrable** | a11y, mesure finale du LCP 3G sur le prerendering mis en place au lot 2 (voir `docs/ADR/0002-web-rendering-strategy.md`), README complet avec captures et comptes de démo, 3 parcours e2e Playwright | tout le repo | Les 3 parcours e2e exigés par CLAUDE.md sont verts en CI ; LCP catalogue mesuré < 2,5s en 3G simulée ; démarrage local en ≤ 5 commandes | 2 jours |
| **9. (si le temps le permet) Fidélité, promo, support, gestion clients avancée** | F-FID, F-SUP, F-ADM-03,07 | `apps/api`/`apps/web` (modules `loyalty`, `support`, `promotions`) | — | 3,5 jours |

**Total lots 0-8 : ~19 jours-personne pleins** (lot 0 porté à 3 jours pour intégrer la
mesure du cold start, voir §5). C'est environ 15-20 % plus cher qu'un
équivalent fonctionnel en framework fullstack (que je n'ai pas chiffré en détail ici
puisque la question est tranchée), principalement à cause du lot 0 (déploiement à deux
domaines + auth cross-domain validée en prod dès le départ) et de la génération/
régénération du contrat d'API à chaque lot qui touche une route.

**Sur le calendrier** : vous avez précisé (2026-07-30) ne pas attendre un produit fini
pour la fin de semaine, et viser plutôt une URL publique présentable dès la fin du
**lot 2** (accueil + tarifs prerendus, README complet, comptes de démo), enrichie lot
par lot ensuite, avec le **lot 5** confirmé comme point d'arrêt "démo cohérente"
(commande jusqu'à livrée par un agent ; paiement et livraison restent en suite
immédiate documentée si le temps manque au-delà). ~19 jours-personne pleins reste le
budget total si vous allez jusqu'au lot 8 ; le nombre de jours réellement disponibles
(question 1, §7) déterminera si vous vous arrêtez au lot 5, poussez jusqu'au lot 6/7,
ou allez au bout.

---

## 7. Décisions actées et questions encore ouvertes (mise à jour du 2026-07-30)

Suite à votre revue du 2026-07-30, les points suivants sont **tranchés** et déjà
répercutés dans ce document :

- **Rendu web** : prerendering au build pour les pages publiques, CSR pour le reste,
  hébergement statique conservé (pas de SSR). Voir §5 et
  `docs/ADR/0002-web-rendering-strategy.md`.
- **Historique Git** : conservé intégralement, sans réécriture ni squash — verdict
  corrigé en §2.
- **Facturation TVA** (§4, point 7) : la facture affiche "Prix TTC", aucune mention
  fiscale. `vatRateBps`/`vatAmountXof` restent des champs techniques figés à 0.
- **Durée de vie des tokens** (§4, point 11) : validée telle quelle (15 min / 30 jours
  glissants, un refresh token par appareil).
- **Reset de `main`** : validé, à deux conditions non négociables pour le lot 0—
  1) `archive/angular-v0` créée **et poussée sur le remote avant toute suppression**
  (une branche locale ne protège rien) ; 2) aucun force push ni réécriture d'historique,
  jamais — le passage au workspace Nx se fait par des commits normaux.
- **API de staging unique** partagée par toutes les previews de PR : validée (voir §5).
- **Spike `nestjs-zod`** (timeboxé à 1h) : validé, repli documenté en ADR accepté en cas
  d'échec — à une condition non négociable quelle que soit l'option retenue : **un test
  automatisé doit vérifier que le client généré correspond à l'API réellement exposée**,
  sinon la promesse de non-divergence front/back n'est qu'une intention. zod reste la
  source de vérité dans `libs/shared/domain` dans tous les cas.
- **Risque de mise en veille (cold start)** : tranché — Render en instance payante pour
  l'API, Neon gratuit pour la base (reprise sub-seconde jugée acceptable), Vercel/Netlify
  statique pour le web. Mesure réelle exigée avant de clore le lot 0 (voir §5, §6).
- **Calendrier** : objectif révisé à une URL publique présentable dès la fin du lot 2,
  lot 5 confirmé comme point d'arrêt "démo cohérente" (voir §6).

**Statut au 2026-07-30** : ces deux points restent formellement en attente d'une valeur
concrète de votre part (les deux réponses reçues contenaient un gabarit `<REMPLIS>` non
complété) — je ne les invente pas, un chiffre de jours et un statut de compte engagent
des choix réels (dont une dépense récurrente sur Render) que je ne dois pas deviner :

1. **Temps réellement disponible** — nombre de jours pleins (ou soirées/week-ends
   équivalents) encore non chiffré.
2. **Comptes Neon / Render / Vercel-Netlify** — "déjà créés" ou "à créer aujourd'hui" :
   la réponse conditionne si je peux enchaîner directement sur le déploiement ou si je
   dois d'abord vous guider pas à pas dans la création des comptes (et notamment
   l'activation du plan payant Render, qui implique un moyen de paiement de votre côté,
   pas du mien).

Je n'entame pas la génération du workspace ni un déploiement réel tant que ces deux
valeurs ne sont pas données explicitement.
