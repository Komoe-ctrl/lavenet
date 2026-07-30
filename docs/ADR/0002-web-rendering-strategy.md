# ADR 0002 — Rendu du web : prerendering au build, pas de SSR

## Statut

Acté — 2026-07-30

## Contexte

Le cahier des charges (NF-PERF-01) impose un LCP < 2,5s sur la page catalogue en 3G
simulée. Angular en mode CSR pur (comportement par défaut) rend ce budget difficile à
tenir : rien ne s'affiche avant téléchargement + parsing + exécution du bundle JS.

`@angular/ssr` peut résoudre ce problème, mais un rendu serveur véritable (serveur
Angular Universal exécuté à chaque requête) exige un runtime Node pour `apps/web` — un
troisième service à déployer et à faire vivre, en plus de `apps/api` et de la base
Postgres managée. Le lot 0 (voir `docs/AUDIT.md` §6) prévoit un hébergement web 100 %
statique (Vercel/Netlify), précisément pour limiter le nombre de services à opérer.
Introduire un runtime Node pour le web contredirait ce choix.

## Décision

- Les pages publiques (accueil, tarifs, à propos, mentions légales) sont **prerendues
  au build** via `@angular/ssr` en mode *build-time prerendering* : génération de HTML
  statique à la compilation, aucun serveur Angular exécuté en production.
- Toutes les pages derrière authentification (espace client, back-office, tournée
  livreur) restent en CSR classique.
- L'hébergement du web reste statique de bout en bout ; aucun runtime Node n'est
  introduit pour `apps/web`.

## Conséquences

- Le budget LCP < 2,5s (NF-PERF-01) est visé sur les pages prerendues, ce qui couvre
  exactement le périmètre de l'exigence : elle cible la page catalogue, qui est
  publique.
- Les écrans authentifiés (dashboard client, checkout, back-office) restent en CSR pur :
  leur LCP dépend du bundle JS et des conditions réseau. Risque résiduel assumé,
  documenté dans `docs/AUDIT.md` §5 — hors périmètre de NF-PERF-01.
- Aucun service supplémentaire à déployer, surveiller ou redémarrer pour le web ; le
  choix d'hébergement statique du lot 0 reste valable sans exception.
- Le contenu prerendu est figé au moment du build : une donnée qui doit être vue à jour
  en temps réel (ex. un tarif modifié en back-office) nécessite un rebuild/redeploy du
  web. Accepté pour le catalogue en V1 ; à revoir si les tarifs changent plus souvent
  qu'à chaque déploiement.

## Alternatives écartées

- **SSR complet en production (Angular Universal servi par un serveur Node).** Résout le
  LCP sur toutes les pages, y compris authentifiées, mais introduit un troisième service
  à déployer et exploiter, contredit le choix d'hébergement statique acté pour le lot 0,
  pour un gain hors du périmètre réel de NF-PERF-01 (qui ne cible que le catalogue).
- **CSR pur sans mitigation.** Le plus simple à mettre en œuvre, mais ne tient pas le
  budget LCP 3G sur la page catalogue — qui est explicitement testée par le cahier des
  charges et constitue la première impression d'un recruteur cliquant sur la démo.
