# ADR 0004 — nestjs-zod retenu comme mécanisme de validation/DTO

## Statut

Acté — 2026-07-30, après un spike chronométré (~20 minutes, sous l'heure allouée).

## Contexte

CLAUDE.md impose zod comme unique mécanisme de validation, y compris côté NestJS
(`nestjs-zod`), en remplacement de `class-validator` (le défaut de l'écosystème Nest).
Le risque identifié dans `docs/AUDIT.md` §5 : `nestjs-zod` est un paquet tiers
maintenu par la communauté, potentiellement en retard sur les versions récentes de zod
ou de `@nestjs/swagger` — un décalage casserait soit la validation runtime, soit la
génération du contrat OpenAPI dont dépend le client Angular généré.

## Spike réalisé

1. **Compatibilité des versions** : `nestjs-zod@5.5.0` déclare explicitement
   `@nestjs/common: ^11.0.0`, `@nestjs/swagger: ^11.0.0`, `zod: ^4.0.0` — correspond
   exactement aux versions installées dans ce workspace (Nest 11, Swagger 11, zod 4.4).
2. **Mise en place** : DTO `PingDto extends createZodDto(PingSchema)`, pipe global
   `ZodValidationPipe` enregistré via `APP_PIPE`, document Swagger passé par
   `cleanupOpenApiDoc()` avant `SwaggerModule.setup()`.
3. **Test réel** (`apps/api` démarré, requêtes HTTP réelles) :
   - `POST /api/ping { message: "hello" }` → `201 { echo: "hello" }`
   - `POST /api/ping { message: "" }` → `400`, erreur zod explicite
     (`too_small`, `expected string to have >=1 characters`)
   - `POST /api/ping { message: 123 }` → `400`, erreur zod explicite
     (`invalid_type`, `expected string, received number`)
   - Le document `/docs-json` généré contient le schéma **complet** dérivé du zod
     schema (`type`, `minLength`, `maxLength`, `required`), pas un objet vide —
     condition nécessaire pour qu'un client généré depuis cette spec soit
     correctement typé.

## Décision

**`nestjs-zod` est retenu.** Tous les DTO d'entrée des routes API sont des
`createZodDto(schema)`, avec `ZodValidationPipe` en pipe global. Les schémas zod
partagés (réutilisables par le web pour la validation de formulaire) vivent dans
`libs/shared/schemas` ; les DTO NestJS spécifiques à une route peuvent soit réutiliser
un schéma partagé, soit en définir un local si la forme ne concerne que l'API.

## Conséquences

- Un seul schéma zod sert à la fois de source de vérité runtime (validation) et de
  génération du contrat OpenAPI — pas de DTO dupliqué entre validation et
  documentation.
- Le code de spike (`PingDto`/`POST /ping` dans `AppController`) a été retiré après
  vérification ; il n'a jamais eu vocation à rester, seule la preuve compte.
- Le pipe global signifie que **toute** route ajoutée sans DTO zod explicite lèvera une
  erreur si `strictSchemaDeclaration` est activé plus tard — à décider lot par lot,
  pas activé par défaut pour l'instant afin de ne pas bloquer les routes qui n'ont
  légitimement aucun body à valider (ex. `GET /api`).

## Alternative de repli (non nécessaire, documentée par prudence)

Si une version future de `nestjs-zod` cassait la génération de schéma Swagger ou la
compatibilité avec une montée de version de Nest/zod : repli sur des DTO
`class-validator` standards pour les routes API, en gardant zod comme source de vérité
uniquement dans `libs/shared/domain`/`libs/shared/schemas` (validation manuelle via
`schema.parse()` dans le service, avant l'appel au repository). Ce repli n'a pas été
nécessaire ici.
