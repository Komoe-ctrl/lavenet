# ADR 0001 — Angular + NestJS séparés plutôt qu'un framework fullstack

## Statut

Acté avant le début du lot 0, formalisé après (le choix précède ce document — voir
"Contexte" pour pourquoi il n'a pas été écrit en premier).

## Contexte

LaveNet est un projet portfolio : une application de blanchisserie en ligne pour
Abidjan, mais dont l'objectif réel est de démontrer une compétence de conception
logicielle à un recruteur qui lira le code, pas seulement l'écran de démo. Le choix de
stack n'est donc pas seulement technique, il est aussi une déclaration sur ce que je sais
construire.

L'alternative sérieuse était un framework fullstack (Next.js, Remix, ou équivalent) :
une seule application, un seul déploiement, des routes API et des pages dans le même
projet, souvent le même langage de requête entre le composant et la base. C'est l'option
la moins chère en temps de développement pour un produit de cette taille.

## Décision

**Angular (frontend) et NestJS (backend) sont deux applications séparées**, communiquant
uniquement par une API REST dont le contrat est généré (OpenAPI → client Angular), dans
un monorepo Nx. Aucune route API n'est colocalisée avec une page ; aucun accès direct à
la base depuis le frontend, même via des server actions.

## Pourquoi — ce que ce choix coûte réellement

Mesuré sur ce projet, pas estimé a priori :

- **Deux applications à déployer, deux points de défaillance.** Render (API) et Vercel
  (web) sont deux services indépendants avec des cycles de vie différents — le cold start
  du lot 0 (23s de réveil Render) n'existerait pas avec un fullstack déployé en un seul
  bloc sur une plateforme qui garde tout chaud ensemble.
- **L'authentification traverse une frontière réseau réelle.** Cookie `httpOnly`
  `SameSite=None` cross-domain, CORS avec liste blanche stricte, CSRF sur les routes
  mutantes, refresh silencieux avec verrou anti-concurrence côté client — rien de tout
  ça n'existe dans un fullstack où la session et la page sont rendues par le même
  process. C'est le chapitre le plus long du lot 0 (voir `apps/web/src/app/core/auth/`,
  `apps/api/src/auth/`).
- **Le contrat d'API doit être maintenu activement.** Chaque route ajoutée ou modifiée
  exige de régénérer le client Angular (`pnpm api:client`) et de vérifier qu'il n'a pas
  divergé (`pnpm api:client:check`) — un aller-retour qui n'existe simplement pas quand
  le composant appelle sa propre route dans le même projet.
- **Deux configurations de test, deux pipelines de build.** La CI provisionne un
  Postgres jetable pour l'API et build séparément le bundle statique du web ; un
  fullstack aurait une seule chaîne de build à faire fonctionner.
- Estimé dans `docs/AUDIT.md` §6 à **15-20 % plus cher** en temps de développement qu'un
  équivalent fonctionnel en framework fullstack, principalement à cause du lot 0
  (déploiement à deux domaines, auth cross-domain validée en prod dès le départ) et de la
  régénération du contrat à chaque route touchée.

## Pourquoi — ce que ce choix apporte

- **Le contrat d'API devient un artefact vérifiable, pas une convention verbale.** La
  spec OpenAPI exposée par NestJS et le client Angular généré depuis cette spec ne
  peuvent pas diverger silencieusement : `api:client:check` casse la CI si c'est le cas.
  Un fullstack avec des server actions n'a pas cette discipline par défaut — le typage
  partagé y remplace le contrat explicite, mais rien ne garantit qu'une route
  serveur-only reste cohérente avec ce que le client attend une fois que l'équipe grandit
  au-delà d'une seule personne.
- **La frontière de sécurité est sans ambiguïté.** "L'API est la seule frontière de
  sécurité" (CLAUDE.md §5) est une phrase qu'on peut écrire pour n'importe quelle
  architecture, mais elle est _structurellement vraie_ ici : il n'existe aucun chemin de
  code où une vérification d'autorisation pourrait être contournée en restant côté
  serveur d'un framework fullstack (server component, server action) sans repasser par
  l'API. Le frontend ne peut techniquement rien faire que l'API n'autorise pas
  explicitement.
- **Chaque brique s'interroge, se teste et se remplace indépendamment.** Swagger expose
  l'API entière sur `/docs`, testable au `curl` sans navigateur ; le web peut être
  entièrement prerendu et servi par un CDN statique sans jamais démarrer Node en
  production (voir ADR 0002) — un fullstack SSR ne peut pas offrir cette dernière
  propriété par construction, il a besoin d'un runtime serveur pour rendre une page.
- **C'est la structure qu'un recruteur backend ou frontend senior reconnaît.** Un
  monorepo avec un contrat généré, une authentification qui traverse un vrai réseau, et
  une frontière de sécurité serveur non contournable est la forme standard d'un système
  en production à plusieurs équipes — c'est délibérément ce que ce portfolio démontre
  savoir construire, pas la manière la plus rapide d'arriver à un écran qui marche.

## Conséquences assumées

- Le cold start Render (lot 0, ADR 0003) est une conséquence directe de ce choix : deux
  services gratuits au lieu d'un. Traité par l'UX, pas contourné par un changement
  d'architecture (voir ADR 0003) — précisément parce que revenir sur ce point reviendrait
  à revenir sur cet ADR.
- Toute nouvelle route côté API implique mécaniquement une étape de régénération de
  client côté web avant de pouvoir être consommée — ralentit chaque feature qui traverse
  la frontière, de manière visible et volontaire (voir CLAUDE.md §12 règle 4, "contrat
  d'abord").
- Le budget de développement total du projet (~19 jours-personne pour les lots 0 à 8,
  AUDIT.md §6) intègre ce surcoût plutôt que de le dissimuler dans une estimation
  optimiste.

## Alternatives écartées

- **Next.js (ou équivalent) fullstack, avec server actions pour toute mutation.**
  Écarté : plus rapide à livrer, mais ne démontre ni un contrat d'API explicite, ni une
  authentification cross-domain, ni une frontière de sécurité qui survit structurellement
  à l'ajout d'un deuxième client (mobile, autre frontend) — le scénario que ce portfolio
  veut prouver savoir gérer.
- **Angular + NestJS dans le même process (NestJS servant le bundle Angular en
  statique).** Écarté : supprime le cold start et la complexité CORS, mais supprime aussi
  la démonstration de déploiement à deux domaines et la discipline de contrat qu'impose
  une vraie frontière réseau — reviendrait à choisir la facilité au moment précis où la
  difficulté est ce qui a de la valeur pour ce projet.
- **Supabase comme couche d'authentification/données.** Écarté explicitement dès l'audit
  initial (`docs/AUDIT.md` §2) : déplace la frontière de sécurité et la logique métier
  hors du code que je maîtrise et peux défendre — inacceptable pour un portfolio dont le
  but est de montrer _mon_ code, pas l'intégration d'un backend-as-a-service tiers.
