# AUDIT.md — Phase 0 : état des lieux et plan de reprise

> Rédigé sans modifier, créer ou supprimer de fichier de code. Seul fichier produit à
> cette étape. Basé sur l'inspection du dépôt `laundry-app` (1 commit, branche
> `master`, aucun remote configuré) le 2026-07-29.

---

## 1. Inventaire de l'existant

### 1.1 Squelette Angular (commité, "initial commit")

| Élément | Contenu | Verdict | Raison |
|---|---|---|---|
| `angular.json`, `tsconfig*.json`, `.editorconfig`, `.prettierrc` | Config Angular CLI standard | **JETER** | Config d'un framework différent de la stack imposée (Next.js) ; rien à porter |
| `package.json` / `package-lock.json` | Angular 21, RxJS, Vitest | **JETER** | Aucune dépendance commune avec la stack cible sauf Vitest (trivial à réinstaller) |
| `src/app/app.html`, `app.scss`, `app.ts`, `app.config.ts` | Page d'accueil par défaut Angular CLI ("Hello, {{title}}", logo Angular, liens vers angular.dev) | **JETER** | Placeholder de scaffolding jamais personnalisé, zéro contenu métier |
| `src/index.html`, `src/main.ts` | Bootstrap Angular par défaut | **JETER** | Spécifique au runtime Angular |
| `public/favicon.ico` | Favicon par défaut Angular CLI | **JETER** | Pas une identité visuelle LaveNet |
| `README.md` | README généré par `ng new`, jamais édité | **JETER** | Aucun contenu produit ; à réécrire entièrement (exigé par CLAUDE.md §7) |
| `.gitignore`, `.vscode/*` | Standards Angular CLI | **JETER** | À régénérer pour Next.js (`.next/`, etc.) |

### 1.2 Code applicatif non commité (untracked : `core/`, `features/`)

Ces fichiers existent sur disque mais n'ont **jamais été commités**. Inventaire par
inspection directe :

| Élément | Constat | Verdict | Raison |
|---|---|---|---|
| `core/services/auth.service.ts` | Auth via `getSupabase()` (Supabase Auth + table `profiles`) | **JETER** | Backend cible = Auth.js + Postgres/Prisma, pas Supabase. Logique 100% client (`@Injectable providedIn:'root'`), aucune autorisation serveur — contraire à CLAUDE.md §5 |
| `features/auth/login`, `features/auth/register` | Formulaires email/mot de passe, template inline, styles inline | **JETER** (structure) / **ADAPTER** (contenu texte) | Les libellés FR ("Connexion", "Créer un compte", règles de validation `minlength 6`) sont réutilisables comme *référence de copy*, mais le code (Angular, Supabase, pas de téléphone+OTP réel malgré F-AUTH-02) est à refaire intégralement |
| `features/auth/auth-layout` | Layout split-screen avec image Pexels externe et pitch marketing | **ADAPTER** (idée seulement) | Le pattern "image + pitch à gauche, formulaire à droite" est un bon choix mobile-first *desktop*, mais l'image est une URL externe tierce (à ne pas garder telle quelle) et la marque affichée est **"BlancoPro"**, pas "LaveNet" — incohérence de nommage à ne pas reproduire |
| `features/admin/*` (dashboard, orders, order-detail, customers, services, promotions, reports, admin-layout) | 8 écrans CRUD/dashboard en Angular + Supabase, statuts en `snake_case` (`picked_up`, `out_for_delivery`...) | **ADAPTER** (idée seulement) | Bonne couverture fonctionnelle du back-office (proche de F-ADM) utilisable comme *check-list d'écrans*, mais : imports vers des fichiers **inexistants** (`core/services/order.service.ts`, `catalog.service.ts`, `core/models.ts`, `core/guards/auth.guard.ts` ne sont présents nulle part sur le disque), donc ce code **ne compile pas en l'état**. Statuts ne correspondent pas exactement à la machine à états CLAUDE.md (manque `ON_HOLD`, `DRAFT`). Montants manipulés en `number` sans discipline `Xof`/`Int` |
| `src/app/app.routes.ts` (modifié, non commité) | Référence ~15 composants supplémentaires jamais créés (`features/client/*`, `core/guards/auth.guard.ts`) | **JETER** | Confirme que le scaffold est un squelette de routes jamais implémenté — même l'espace client (catalogue, panier, checkout, suivi commande...) n'existe pas du tout |
| `src/styles.scss` (modifié) | Design tokens (couleurs, radius, shadows), classes utilitaires (`.btn`, `.card`, `.badge`, `.stat-card`, `.status-timeline`...) | **ADAPTER** | La seule pièce réellement réutilisable : un système de tokens CSS et de classes cohérent, cohérent avec une palette bleu/vert plausible pour une identité "propreté". Portable en 1-2h vers Tailwind (`tailwind.config.ts` theme extend) — mais ce n'est pas un gain déterminant, Tailwind + shadcn/ui repartent d'une base propre de toute façon |

### 1.3 Ce qui n'existe pas du tout

Aucune trace de : modèle de données esquissé (pas de schéma, pas de types métier
partagés cohérents — `core/models.ts` est importé partout mais absent du disque),
logique de tarification, machine à états, gestion de créneaux, paiement, notifications,
tests, CI, maquettes graphiques, assets propriétaires. Le cahier des charges et
`CLAUDE.md` sont les seuls artefacts de valeur du dépôt à ce stade.

### 1.4 Secrets et hygiène

- Aucun secret trouvé (pas de `.env`, pas de clé API en clair, `.vscode/mcp.json` ne
  contient qu'une config d'outil CLI sans identifiant).
- `.gitignore` ne couvre pas encore Next.js/Prisma (`*.tsbuildinfo`, `.next/`,
  `prisma/migrations` doit rester versionné, etc.) — à régénérer, pas à corriger.
- 1 seul commit dans l'historique ("initial commit") : aucun historique Git à préserver
  ou à squasher.
- Pas de remote configuré : aucun risque de casser un déploiement existant en repartant
  de zéro.

---

## 2. Recommandation : repartir de zéro en Next.js

**Recommandation : reset complet.** Ne migrez pas ce code — supprimez-le après archivage
en branche.

**Argumentation, chiffrée honnêtement :**

- **Coût de la migration Angular → Next.js :** quasi nul en gain, car il n'y a
  *rien de fonctionnel à migrer*. Le code métier (services, modèles) est absent du
  disque bien qu'importé partout : le scaffold ne compile même pas dans son propre
  framework. Ce qui existe (8 écrans admin, 2 écrans auth) représente peut-être 1 à 2
  jours de saisie UI, mais dans un paradigme (composants Angular, CSS-in-TS, Supabase
  client-side) entièrement différent de la cible (Server Components, Tailwind classes,
  Prisma server-side, server actions). Retaper l'équivalent JSX/Tailwind + brancher sur
  Prisma prendrait autant de temps que d'écrire l'écran directement dans la cible en
  suivant le cahier des charges — sans hériter des dérives déjà présentes (statuts
  incomplets, montants non typés `Xof`, autorisation absente).
- **Coût de repartir de zéro :** vous perdez ~30 minutes de lecture de ce code (déjà
  fait ici) et 0 ligne réutilisable telle quelle. Vous gagnez : cohérence totale avec
  CLAUDE.md dès le premier commit, pas de dette à expliquer à un recruteur qui lirait
  `git log`.
- **Ce qui est réellement transporté vers Next.js** n'est pas du code, ce sont des
  *décisions déjà prises* que je garde en tête pour aller plus vite : palette de
  couleurs (bleu primaire `#2563eb`, vert secondaire), la liste des écrans admin
  attendus, la structure de layout auth "image + pitch à gauche / formulaire à droite",
  et les libellés français des statuts. Rien de tout cela ne nécessite de garder le
  fichier source Angular.
- **Si l'objectif avait été** un MVP interne sans exigence de qualité de code (pas un
  portfolio), j'aurais recommandé l'inverse : brancher `order.service.ts`/`models.ts`
  manquants sur Supabase et livrer en 2-3 jours. Ce n'est pas le contexte ici — le
  cahier des charges et CLAUDE.md sont explicites sur "ce dépôt est une pièce de
  portfolio", et le code Angular actuel ne passerait aucune revue (pas d'autorisation
  serveur, montants non typés, aucune migration, aucun test).

**Verdict : reset.** Le lot 0 (prochaine étape, après votre validation) archivera
l'Angular dans `archive/angular-v0` puis videra `main` pour démarrer Next.js 15.

---

## 3. Zones ambiguës du cahier des charges — propositions par défaut

Le cahier des charges liste déjà 7 questions ouvertes (§8) et 2 `À VALIDER` (§5.3,
§5.9). Je les reprends avec une décision par défaut explicite, plus deux points non
mentionnés que j'ai identifiés en le relisant. Chaque décision retenue devra être actée
dans un ADR (`docs/ADR/000X-*.md`) au moment de coder la feature concernée, marquée
`À VALIDER` tant que vous ne l'avez pas tranchée explicitement — conformément à
CLAUDE.md §12.5.

| # | Question | Proposition par défaut | Pourquoi ce choix |
|---|---|---|---|
| 1 | Frais de livraison (§5.3, Q1) | Forfait unique configurable (`DELIVERY_FEE_XOF`, défaut 1 000 F), gratuit ≥ 10 000 F de sous-total | Le cahier des charges le suggère déjà entre parenthèses ; le tarif par commune/distance ajoute une table et une UI d'admin pour un gain de réalisme faible en V1 mono-agence |
| 2 | Délai d'annulation gratuite (Q2) | Annulation libre tant que `status ∈ {DRAFT, PENDING_PICKUP}` (déjà la règle F-CMD-08), sans fenêtre de temps additionnelle ; au-delà, uniquement par un agent via réclamation | Évite d'inventer une règle temporelle non demandée ; reste cohérent avec la machine à états déjà spécifiée |
| 3 | Client absent 2 fois (Q3) | 1er échec → `ON_HOLD` + replanification proposée ; 2e échec → commande basculée en `ON_HOLD` avec motif "client injoignable x2", traitement manuel obligatoire par un agent (pas d'annulation automatique) | Une annulation automatique après 2 échecs risquerait de perdre des vêtements déjà traités ; on ne code pas d'auto-annulation sur une opération physique irréversible |
| 4 | Vêtement abîmé/perdu (Q4, déjà proposé en §5.8) | Retenue : avoir en points de fidélité = montant de la ligne, décision manuelle admin, tracé dans `AuditLog` | C'est déjà la proposition du document ; je la retiens telle quelle, pas de remboursement monétaire réel en V1 (cohérent avec paiement sandbox) |
| 5 | Expiration des points (Q5, déjà proposé en §5.9) | 12 mois sans mouvement sur le compte, job/cron de nettoyage différé en V2 (calcul à la lecture en V1 : un point plus vieux que 12 mois est ignoré dans le solde affiché, sans job batch) | Éviter d'introduire un scheduler externe pour un portfolio déployé sur Vercel serverless ; le calcul "à la volée" suffit pour la démo |
| 6 | Facturation pro (Q6) | Facture par commande en V1 (comme les particuliers) ; récapitulatif mensuel documenté en V2 | Le récapitulatif mensuel demande une notion de cycle de facturation et un batch — hors V1 par cohérence avec "peu de features, irréprochables" |
| 7 | TVA (Q7) | Montants TTC uniquement, aucune ligne de TVA détaillée sur la facture, mention "TVA non applicable — régime non précisé" | La Côte d'Ivoire n'est pas documentée comme un contexte de TVA obligatoire ici ; inventer un taux serait plus trompeur qu'utile pour un portfolio |
| 8 *(nouveau)* | Rôle `COURIER` : peut-il voir les commandes d'autres livreurs ? | Non — un livreur ne voit que sa propre tournée (`assertOwnsDelivery` en plus de `requireRole('COURIER')`) | Le cahier des charges ne le dit pas explicitement, mais NF-SEC-01 ("un client ne doit jamais lire une commande via son id") s'applique par analogie aux livreurs |
| 9 *(nouveau)* | Un même numéro de téléphone peut-il être à la fois client et livreur/agent ? | Non, un compte = un rôle unique, pas de changement de rôle en libre-service (seul un admin peut changer le rôle d'un compte) | Simplifie l'autorisation ; correspond à l'usage réel (un livreur salarié n'est pas censé aussi commander avec le même compte) |

---

## 4. Risques techniques réels

| Risque | Impact | Mitigation retenue |
|---|---|---|
| **Réservation de créneau concurrente** (deux clients réservent le dernier slot en même temps) | Sur-réservation, perte de confiance | Transaction Prisma (`$transaction` avec `SELECT ... FOR UPDATE` via requête raw paramétrée ou incrément conditionnel `WHERE bookedCount < capacity`) au moment de la validation de commande, testée par un test d'intégration qui simule deux requêtes concurrentes |
| **Idempotence des webhooks de paiement** en mode sandbox | Double crédit, double décrément de stock de créneau | `Payment.idempotencyKey` unique en base + traitement dans une transaction ; test de rejeu explicite (F-PAY-03) dans la suite d'intégration dès le lot paiement |
| **Autorisation par IDOR** (changer l'id dans l'URL pour voir la commande d'un autre) | Fuite de données personnelles, disqualifiant pour un portfolio orienté sécurité | Helper unique `assertOwnsOrder(userId, orderId)` appelé systématiquement en tête de chaque server action/route touchant une `Order`, testé unitairement pour le cas "commande d'autrui → erreur" |
| **Money en Float par erreur** | Écarts de centimes, mais surtout franc CFA n'a pas de sous-unité — une erreur ici est visible immédiatement par un recruteur regardant `schema.prisma` | Règle CLAUDE.md déjà explicite (`Int`, suffixe `Xof`) ; à renforcer par une règle ESLint custom ou une revue systématique sur tout nouveau champ monétaire |
| **Déploiement Vercel + Neon sans clé API externe** | Le cahier des charges exige "tourne sans clé API" ; un oubli ferait planter le build en prod pour un recruteur qui clique sur le lien | `lib/env.ts` avec zod, valeurs par défaut sandbox pour tous les providers externes, testé par un `pnpm build` en CI sans aucune variable d'environnement "réelle" définie |
| **WebView + réseau 3G** | LCP catalogue > 2,5s (NF-PERF-01), UX dégradée si testée uniquement sur poste de dev en fibre | Server Components par défaut (pas de bundle JS pour l'affichage), images `next/image`, test manuel via throttling DevTools "Slow 3G" avant chaque lot livré, pas seulement à la fin |
| **Machine à états dispersée** dans les server actions au lieu d'être centralisée | Bug classique : une action autorise une transition invalide | Un seul module `features/orders/domain/state-machine.ts` avec une fonction pure `canTransition(from, to)` appelée par *toute* mutation de statut, testée exhaustivement (matrice complète des transitions valides/invalides) |
| **Périmètre trop large pour une semaine** | Livrable incomplet ou bâclé, pire pour un recruteur qu'un périmètre réduit mais soigné | Voir §5 — découpage V1/V1'/V2 explicite ci-dessous, lots ordonnés pour качество démontrable tôt |
| **Facture PDF** (F-PAY-05) : génération PDF sans dépendance lourde compatible Vercel serverless | Une lib PDF mal choisie peut casser le build ou le runtime Edge | Choisir une lib pure JS compatible Node runtime (ex. `@react-pdf/renderer` ou `pdf-lib`), testée dès le lot paiement, jamais laissée pour la fin |

---

## 5. Réalisme du calendrier — le périmètre du cahier des charges est trop large pour cette semaine

Le cahier des charges couvre 10 blocs fonctionnels (`F-AUTH` à `F-ADM`, ~55 exigences
`Must`/`Should`) plus un back-office complet à 10 écrans. Fait honnêtement et testé selon
la Definition of Done de CLAUDE.md (autorisation serveur partout, tests unitaires sur
tout le domaine, e2e sur 3 parcours, README soigné), c'est un projet de 3 à 4 semaines
pour un développeur seul, pas une semaine.

**Découpage V1' recommandé pour un déploiement cette semaine** (sous-ensemble du V1 déjà
défini par le cahier des charges — je resserre encore, je n'élargis rien) :

- **Dans le V1' démontrable cette semaine :** inscription/connexion (email + mot de
  passe ; OTP téléphone implémenté mais je le limite à un seul canal de test — pas de
  double vérification email+SMS en parallèle), catalogue et tarifs, panier, checkout
  avec créneaux à capacité limitée, machine à états complète, suivi client, paiement
  sandbox (Mobile Money simulé + cash), facture PDF, back-office : dashboard + gestion
  commandes + gestion services/tarifs + export CSV, tournée livreur avec confirmation
  OTP. **3 parcours e2e Playwright exigés par CLAUDE.md.**
- **Repoussé après cette semaine (V1.1, toujours "V1" au sens du cahier des charges, pas
  du V2) :** réclamations/support, fidélité (cumul/usage de points), codes promo,
  gestion des clients en back-office (liste/blocage), rapports détaillés au-delà du
  dashboard, préférences de notification, professionnel (tarif au kilo différencié).
- **V2 inchangé** par rapport à ce que le cahier des charges documente déjà (§4.2).

Cette coupe V1' est **ma recommandation**, pas une décision prise à votre place : elle
est soumise à votre validation au même titre que le reste de cet audit (voir question 1
ci-dessous). Le plan de lots ci-dessous est ordonné pour que même si vous arrêtez après
le lot 5, vous ayez une démo cohérente (parcours client complet), pas un empilement de
features à moitié câblées.

---

## 6. Plan de livraison par lots

Chaque lot est une tranche verticale démontrable. Estimations en jours-personne pleins,
en supposant les lots précédents terminés et la Definition of Done respectée à chaque
fois (donc *y compris* tests, lint, doc — pas un temps de code brut optimiste).

| Lot | Objectif | Fichiers/dossiers principaux touchés | Critère de fin | Estimation |
|---|---|---|---|---|
| **0. Fondations** | Projet Next.js 15 opérationnel, CI verte, DB locale, tooling | racine du repo, `lib/`, `prisma/schema.prisma`, `.github/workflows/`, `docker-compose.yml` | `pnpm build && pnpm test` verts en local et en CI ; `docker compose up` + `prisma migrate dev` + `pnpm db:seed` fonctionnent | 1 jour |
| **1. Auth** | Inscription/connexion email+mdp, session, profil, adresses (F-AUTH-01,03,05,06) | `features/auth/*`, `app/(auth)/*`, `lib/auth.ts` | Un compte de démo peut s'inscrire, se connecter, éditer son profil et ajouter une adresse ; testé sur 375px | 2 jours |
| **2. Catalogue** | Services, catégories, grille tarifaire, page publique (F-CAT-01→05) | `features/catalog/*`, `app/(marketing)/tarifs`, seed | Page tarifs publique consultable sans compte, données réalistes Abidjan | 1 jour |
| **3. Panier + checkout + créneaux** | Panier persistant, créneaux à capacité, récapitulatif, référence de commande (F-CMD-01→07) | `features/cart/*`, `features/orders/domain` (prix, créneaux), `features/delivery` (slots) | Une commande complète peut être validée de bout en bout, total recalculé serveur, créneau plein non sélectionnable, test de concurrence sur la capacité | 3 jours |
| **4. Machine à états + suivi client** | Statuts, historique, frise client, annulation (F-STA, F-CMD-08,09) | `features/orders/domain/state-machine.ts`, `features/orders/components` | Toutes les transitions valides/invalides couvertes par tests unitaires ; client voit sa frise en français | 2 jours |
| **5. Paiement sandbox + facture** | Cash, Mobile Money simulé, webhook idempotent, facture PDF (F-PAY-01→06) | `features/payments/*`, `app/api/webhooks/*` | Webhook rejoué deux fois = un seul effet (testé) ; facture PDF téléchargeable après livraison | 2 jours |
| **6. Back-office minimal** | Dashboard, commandes, services/tarifs, export CSV (F-ADM-01,02,04,08) | `app/(admin)/*`, `features/admin/*` | Un admin change un statut, voit le dashboard avec les 25 commandes de démo, exporte un CSV | 2 jours |
| **7. Livraison + OTP** | Tournée livreur, confirmation OTP (F-LIV-01→04) | `features/delivery/*`, `app/(admin)/courier` ou équivalent | Transition `OUT_FOR_DELIVERY → DELIVERED` bloquée sans OTP valide, testée | 1,5 jour |
| **8. Polish démontrable** | a11y, perf 3G, README complet, captures, 3 e2e Playwright | tout le repo, `README.md`, `tests/e2e/*` | Les 3 parcours e2e exigés par CLAUDE.md sont verts ; README permet un démarrage en ≤ 5 commandes | 1,5 jour |
| **9. (V1.1, si le temps le permet) Fidélité, promo, support, gestion clients** | F-FID, F-SUP, F-ADM-03,07 | `features/loyalty/*`, `features/support/*`, `features/promotions/*` | — | 3-4 jours |

**Total V1' (lots 0-8) : ~16 jours-personne pleins.** Sur une semaine de travail à temps
plein (5 jours), même le V1' resserré ne rentre pas intégralement — voir question 1.
Si vous confirmez un vrai temps plein sur 5 jours, je recommande d'arrêter la coupe
démontrable après le **lot 5** (parcours client + paiement complets, sans back-office ni
livreur) plutôt que de bâcler tous les lots pour rentrer dans le temps.



---

## 7. Questions auxquelles j'ai besoin d'une réponse

1. **Temps réellement disponible cette semaine** (temps plein 5j, ou à côté d'autre
   chose ?) — détermine si je vise le V1' complet (lots 0-8, ~16 j) ou un sous-ensemble
   encore plus resserré (ex. lots 0-5 : auth + catalogue + commande + paiement + statuts,
   sans back-office ni livreur — je recommande cette dernière option si le temps réel est
   < 8 jours-personne).
2. **Validez-vous la coupe V1' proposée en §5** (support, fidélité, promo, gestion
   clients repoussés après le premier déploiement), ou tenez-vous à ce que tout le V1 du
   cahier des charges soit présent dès cette semaine, quitte à repousser la date de
   déploiement ?
3. **Validez-vous les 9 décisions par défaut du §3** (frais de livraison, annulation,
   client absent, dédommagement, expiration des points, facturation pro, TVA, visibilité
   livreur, unicité rôle/compte) ? Si oui, je les écris en ADR au fil des lots concernés,
   marquées tranchées plutôt que `À VALIDER`.
4. **Confirmez-vous l'archivage puis la suppression** de l'Angular actuel
   (`archive/angular-v0` + suppression sur `main`), comme prévu au lot 0 ? C'est une
   action destructive sur `main`, je ne l'exécuterai qu'après votre confirmation explicite
   au moment du lot 0, mais je veux savoir dès maintenant si vous voulez plutôt garder une
   copie ailleurs (zip, autre dossier) en plus de la branche Git.
5. **Neon/Vercel** : avez-vous déjà des comptes créés pour ce projet, ou dois-je
   documenter uniquement la procédure sans pouvoir tester le déploiement réel moi-même ?
6. **OTP téléphone en pratique** : voulez-vous un vrai envoi SMS (nécessite une clé API,
   contredit "tourne sans clé API") ou un OTP simulé (log + affiché en back-office, comme
   déjà prévu pour les notifications F-NOT-02) ? Je recommande la seconde option par
   défaut, cohérente avec le reste du cahier des charges — confirmez-vous ?

Je n'écris aucun code tant que vous n'avez pas répondu au moins aux questions 1, 2 et 4.
