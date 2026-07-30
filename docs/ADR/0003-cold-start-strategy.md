# ADR 0003 — Cold start sur plans gratuits : traité par l'UX, pas par l'infra

## Statut

Acté — 2026-07-30. Chiffre de cold start réel à ajouter une fois le lot 0 déployé
(section "Mesure" ci-dessous).

## Contexte

Le lot 0 déploie sur des offres gratuites : Render (API) et Neon (Postgres). Render free
met le service en veille après ~15 minutes d'inactivité, avec un réveil de 30 à 60
secondes au prochain appel. Neon free suspend aussi la base après inactivité, avec une
reprise annoncée de l'ordre de quelques centaines de millisecondes.

Pour un dépôt portfolio, la première impression est décisive : un recruteur qui clique
une fois sur le lien de démo et tombe sur un écran figé pendant une minute ferme
l'onglet avant que quoi que ce soit ait eu le temps de répondre.

Deux familles de solutions existent : contourner techniquement le spin-down (passer sur
une offre payante, changer d'architecture vers du serverless qui n'a pas ce problème,
ajouter un ping de maintien en éveil), ou l'assumer et le rendre visible/tolérable pour
l'utilisateur. Le budget du projet est nul pour l'instant (plans gratuits explicitement
choisis) et la stack (Angular + NestJS séparé, décidée et actée) ne doit pas être
reconsidérée pour ce problème d'hébergement.

## Décision

**Le spin-down est assumé, pas contourné.** Aucune adaptation d'architecture (pas de
passage en serverless, pas de changement de framework côté API) pour l'éviter. Le risque
est traité par trois leviers, tous côté produit/UX :

1. **Le prerendering des pages publiques (ADR 0002) est la mitigation principale.**
   Accueil, tarifs et à propos sont générés en HTML statique au build et servis par
   Vercel sans dépendre de l'API : ils s'affichent instantanément même API éteinte. Un
   visiteur qui découvre le site via ces pages n'est jamais bloqué par le cold start.
   Vérifié explicitement au lot 0 : build de production servi avec l'API arrêtée, la
   page d'accueil s'affiche sans erreur ni dépendance réseau bloquante.

2. **Tout premier appel à l'API affiche un état d'attente explicite et visible**, jamais
   un écran figé. Le pattern (mis en place quand le web commence à appeler l'API — lot 0
   pour l'appel authentifié minimal, puis chaque feature) :
   - un indicateur de chargement/progression s'affiche dès l'envoi de la requête ;
   - si la réponse n'arrive pas rapidement, un message explicite apparaît ("Démarrage du
     serveur, cela peut prendre jusqu'à une minute — l'hébergement gratuit met le service
     en veille après une période d'inactivité") plutôt que de laisser l'utilisateur
     deviner ;
   - en cas de dépassement d'un délai raisonnable (timeout), un message d'échec clair
     avec un bouton **Réessayer** plutôt qu'un blocage silencieux.

3. **Documentation** : cette contrainte est écrite ici, dans le README (une phrase, sans
   s'excuser — voir §"README"), et le chemin de sortie est explicite : passer l'API sur
   une offre payante est un changement de configuration Render (aucune ligne de code),
   prévu une fois le projet stabilisé, pas un correctif d'urgence à improviser.

## Option documentée, non configurée : ping de maintien en éveil

Un service de cron externe gratuit (ex. cron-job.org, UptimeRobot) peut appeler l'API
toutes les 10 minutes pour empêcher la mise en veille. **Non mis en place par défaut** —
à activer manuellement si voulu, avec un avertissement de quota à connaître avant de
l'activer :

- Render free offre **750 heures d'instance par mois**, ce qui correspond exactement à
  un service tournant en continu (24 × 31 ≈ 744h). Un ping permanent consomme donc tout
  le quota gratuit à lui seul — viable seulement s'il n'y a **aucun autre service
  gratuit Render** sur le même compte. Si un deuxième service gratuit est ajouté plus
  tard sur le même compte, le quota sera dépassé avant la fin du mois et un ou plusieurs
  services seront suspendus par Render.
- Alternative si ce risque n'est pas acceptable : ne pas pinguer, laisser le spin-down se
  produire, et compter sur les mitigations UX ci-dessus.

## Mesure

_(À compléter une fois le lot 0 déployé.)_ Temps de réponse réel mesuré après une
période d'inactivité suffisante pour déclencher la mise en veille :

- API (Render free) : **à mesurer**
- Base (Neon free) : **à mesurer**

## Conséquences

- Aucun coût d'infrastructure tant que le projet n'a pas de trafic réel à justifier une
  offre payante.
- Le premier appel API d'un visiteur peut prendre jusqu'à une minute ; c'est visible et
  expliqué, pas silencieux — le risque produit devient un risque de patience de
  l'utilisateur, pas un risque de confusion.
- Le passage à une offre payante plus tard ne touche aucune ligne de code : changement
  de plan Render, éventuellement retrait du message d'attente cold-start côté web (ou
  conservation, car un délai réseau normal ne justifie jamais un écran figé).

## Alternatives écartées

- **Offre payante dès le lot 0** : envisagée puis explicitement écartée le 2026-07-30 —
  le budget du projet est nul pour l'instant ; le chemin vers le payant reste ouvert et
  documenté, pas fermé.
- **Ping de maintien en éveil activé par défaut** : écarté par prudence de quota (voir
  ci-dessus) — laissé en option documentée plutôt qu'activé sans que le risque de
  dépassement soit compris.
- **Changement d'architecture (serverless côté API)** : écarté — la stack Angular +
  NestJS séparé est actée (ADR 0001 à venir / CLAUDE.md §1) et ne doit pas être
  reconsidérée pour un problème d'hébergement qui a une solution produit plus simple.
