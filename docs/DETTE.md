# Dette technique

Décisions explicitement différées, avec leur déclencheur. Une ligne disparaît d'ici
quand elle est traitée, jamais silencieusement — retirée dans le même commit qui la
résout.

## CSRF — mitigation légère, pas de double-submit token

**Où** : `apps/api/src/auth/auth.controller.ts` (`assertSameOriginHeader`).
**État actuel** : header `X-Requested-With` requis + CORS strict sur `/auth/refresh` et
`/auth/logout` — bloque le vecteur CSRF classique (formulaire cross-site) mais n'est pas
une protection double-submit-token complète.
**Déclencheur** : la première route métier mutante qui a besoin d'un cookie de session
pour autoriser une écriture réelle (création de commande, lot 3). Implémenter un vrai
double-submit token à ce moment-là, pas avant — inutile de le construire pour un
endpoint qui ne fait que rafraîchir un token.

## Mesure du cold start Neon non isolée du réveil Render

**Où** : `docs/ADR/0003-cold-start-strategy.md`, section "Mesure".
**État actuel** : 23,03s mesurés sur `GET /api` (ne touche pas Prisma — connexion
paresseuse, voir `apps/api/src/prisma/prisma.service.ts`). Le réveil spécifique de Neon
n'a jamais été isolé du réveil du process Render.
**Déclencheur** : la première fois qu'un chiffre précis par composant est réellement
utile (ex. décision de passer Neon seul en payant sans upgrader Render, ou l'inverse).
Mesurer : un `GET /api` (froid, sans DB) puis immédiatement un premier
`POST /api/auth/login` (froid, avec DB) sur la même fenêtre de réveil, comparer les deux.

## Les tarifs prerendus ne se rafraîchissent qu'au prochain déploiement web

**Où** : `apps/web/src/app/features/catalog` (`/`, `/tarifs`), `docs/ADR/0003-cold-start-strategy.md`.
**État actuel** : `/` et `/tarifs` sont prerendus au build (F-CAT-04) — les prix affichés
sont figés au moment du dernier `ng build`. Créer ou modifier une `PriceRule` côté API
n'est visible en production qu'après le prochain déploiement web, pas immédiatement.
Acceptable pour l'instant : rien ne peut modifier un tarif en production, il n'y a pas
encore de back-office.
**Solution retenue (pas encore implémentée)** : quand le back-office tarifaire (F-ADM-04)
permettra de créer/modifier une `PriceRule`, déclencher un **webhook de déploiement
Vercel** depuis l'API à la fin de cette mutation (`deploy hook` Vercel, une simple requête
POST sans authentification forte — à protéger par un secret côté API). Un déploiement
Vercel régénère le prerendering avec les nouveaux prix en quelques minutes, sans
intervention manuelle.
**Déclencheur** : implémentation de F-ADM-04 (back-office tarifaire).

## Le module `auth` n'a pas de couche repository

**Où** : `apps/api/src/auth/auth.service.ts` (accède directement à `PrismaService`).
**État actuel** : `apps/api/src/catalog` pose le précédent documenté par CLAUDE.md §3
(`controller → service → repository`) — `auth` a été écrit avant que cette convention ne
soit fixée et accède à Prisma directement depuis `auth.service.ts`. Fonctionne, mais
incohérent avec le reste du dépôt et avec ce que `docs/ADR/0001-stack.md` défend comme
architecture.
**Déclencheur** : la prochaine intervention significative sur `auth` (lot 1 — auth
complète : inscription, OTP téléphone). Extraire `auth.repository.ts` à ce moment-là,
pas comme un correctif isolé aujourd'hui.

## Type de compte pro (F-AUTH-07) non implémenté

**Où** : `docs/CAHIER-DES-CHARGES.md` §5.1 (F-AUTH-07, priorité Should), ligne 293
(question ouverte : facturation par commande ou récapitulatif mensuel).
**État actuel** : reporté hors du lot 1 (authentification). Le cahier des charges
lui-même n'a pas tranché la facturation professionnelle, et "voit les tarifs au kilo"
toucherait potentiellement `PriceRule` (lot 2, déjà livré) selon la réponse retenue —
pas seulement un attribut de profil.
**Déclencheur** : décision explicite sur la facturation professionnelle (réponse à la
question ouverte ligne 293). Trancher ce point avant d'implémenter quoi que ce soit pour
F-AUTH-07, pas deviner une règle métier (CLAUDE.md §12.6).

## `render.yaml` exécute `prisma migrate deploy` dans `buildCommand`

**Où** : `render.yaml`.
**État actuel** : fonctionne, mais réexécute la commande à chaque build au lieu de
l'isoler dans `preDeployCommand` (non utilisé par prudence : disponibilité peu claire
sur le plan gratuit au moment de l'écriture, jamais revérifiée depuis).
**Déclencheur** : revérifier la disponibilité de `preDeployCommand` sur le plan gratuit
Render, migrer si confirmé disponible — gain de propreté, pas de correction de bug.

## Suite Playwright non câblée en CI

**Où** : `.github/workflows/ci.yml` (aucune étape `test:e2e`), `apps/web-e2e/`.
**État actuel** : `apps/web-e2e/src/example.spec.ts` contient maintenant 2 tests réels
(accueil, connexion → `/compte`) et passe en local, mais rien ne les exécute
automatiquement à chaque push.
**Déclencheur** : lot 8 (polish démontrable, CLAUDE.md §6) quand les 3 vrais parcours
E2E exigés par CLAUDE.md §7 existent. À ce moment, résoudre aussi le point suivant.

## `nx run web-e2e:e2e` déclenche une boucle détectée par Nx si aucun serveur web n'est déjà démarré

**Où** : `apps/web-e2e/playwright.config.mts` (`webServer.command`).
**État actuel** : découvert en écrivant les tests de ce lot — lancer
`nx run web-e2e:e2e` à froid produit parfois "Recursive task invocation detected" (le
serveur web est à la fois dépendance de tâche Nx et démarré par Playwright lui-même).
Contourné localement en démarrant `nx serve web` à la main avant de lancer les tests
(`reuseExistingServer: true` évite alors la double invocation) — la cause racine dans la
configuration Nx/Playwright n'est pas corrigée.
**Déclencheur** : avant le câblage CI ci-dessus — une CI ne peut pas compter sur un
contournement manuel.
