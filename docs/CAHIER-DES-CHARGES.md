# Cahier des charges — LaveNet

**Application web de blanchisserie — lavage, repassage, pressing**
Version 1.0 · Abidjan, Côte d'Ivoire · Document de référence produit

> Ce document décrit **quoi** construire et **pourquoi**. `CLAUDE.md` décrit **comment**.
> En cas de contradiction sur une règle métier, ce document fait autorité ; sur une règle
> technique, c'est `CLAUDE.md`.
> Toute exigence porte un identifiant (`F-XXX-NN`). Les commits et PR doivent y faire
> référence : `feat(orders): implement slot capacity check (F-CMD-04)`.

---

## 1. Contexte et problème

À Abidjan, la blanchisserie fonctionne majoritairement par téléphone et WhatsApp :
prise de commande orale, prix négocié au cas par cas, aucun suivi écrit, litiges fréquents
sur les vêtements perdus ou abîmés, encaissement en espèces non tracé. Côté gérant,
aucune visibilité sur le chiffre d'affaires, la charge de travail par jour, ni la
rentabilité par service.

LaveNet numérise ce parcours : commande en ligne avec tarif affiché, créneaux de retrait
et de livraison, suivi de statut, paiement Mobile Money ou à la livraison, preuve de
remise, et un back-office pour piloter l'activité.

## 2. Objectifs

| # | Objectif | Indicateur de succès |
|---|---|---|
| O1 | Permettre de commander sans appel téléphonique | Commande complète réalisable en < 3 min sur mobile |
| O2 | Rendre le prix transparent et opposable | Prix affiché avant validation, figé sur la facture |
| O3 | Supprimer les litiges de remise | Chaque livraison confirmée par OTP, tracée et horodatée |
| O4 | Donner de la visibilité au gérant | Tableau de bord CA / commandes / statuts, export CSV |
| O5 | Fonctionner sur mobile en réseau contraint | Utilisable en WebView, écran 375px, 3G |

**Objectif secondaire assumé :** ce dépôt est une pièce de portfolio. La qualité du code,
de l'historique Git et de la documentation fait partie du livrable.

## 3. Utilisateurs

| Rôle | Description | Besoin principal |
|---|---|---|
| **Client particulier** | Résident, commande occasionnelle ou hebdomadaire | Commander vite, connaître le prix, savoir où en sont ses vêtements |
| **Client professionnel** | Hôtel, restaurant, salon — volumes réguliers | Tarif au kilo, historique, facturation |
| **Livreur (courier)** | Effectue retraits et livraisons | Voir sa tournée du jour, confirmer une remise |
| **Agent (staff)** | Traite les vêtements en agence | Faire avancer les commandes dans les statuts |
| **Administrateur** | Gérant | Piloter, tarifer, exporter, gérer les comptes |

## 4. Périmètre

### 4.1 Dans le périmètre V1 (à livrer)

Authentification, profil, adresses, catalogue et tarifs, panier, commande avec créneaux,
machine à états, suivi client, paiement à la livraison + Mobile Money **en mode sandbox**,
facture PDF, notifications email (SMS derrière une interface simulée), réclamations
simples, fidélité (cumul et usage de points), codes promo, back-office complet avec
tableau de bord et export CSV, vue tournée livreur avec confirmation OTP.

### 4.2 Hors périmètre V1 (documenté, non codé)

Paiement carte réel et agrément PSP, abonnements et packs prépayés, parrainage,
messagerie temps réel et WhatsApp Business API, application native, multi-agences avec
transfert de stock, optimisation de tournées, comptabilité, application livreur hors-ligne.

### 4.3 Hypothèses et contraintes

- Devise unique : **franc CFA (XOF)**, sans sous-unité. Aucun montant décimal.
- Langue unique : français. Le code reste en anglais.
- Fuseau : `Africa/Abidjan` (UTC+0), stockage en UTC.
- Une seule agence en V1, mais le modèle de données doit supporter le multi-agences.
- Mobile-first strict : la maquette de référence est le 375px.
- La démo doit tourner **sans clé API externe**.

---

## 5. Exigences fonctionnelles

### 5.1 Authentification et compte — `F-AUTH`

| ID | Exigence | Priorité |
|---|---|---|
| F-AUTH-01 | Inscription par email **ou** numéro de téléphone ivoirien (format `+225 XX XX XX XX XX`), avec mot de passe | Must |
| F-AUTH-02 | Vérification du téléphone par OTP à 6 chiffres, TTL 10 min, 5 tentatives max, renvoi possible après 60 s | Must |
| F-AUTH-03 | Connexion, déconnexion, session persistante | Must |
| F-AUTH-04 | Réinitialisation de mot de passe (lien email ou OTP SMS) | Must |
| F-AUTH-05 | Profil éditable : nom, téléphone, email, préférence de notification | Must |
| F-AUTH-06 | Carnet d'adresses : plusieurs adresses (libellé, commune, quartier, repère), une par défaut | Must |
| F-AUTH-07 | Type de compte : particulier ou professionnel (le pro voit les tarifs au kilo) | Should |
| F-AUTH-08 | Suppression de compte (soft delete, anonymisation des données personnelles) | Should |

**Règles :** un téléphone = un compte. Un compte non vérifié peut naviguer mais pas
commander. Les mots de passe sont hachés en argon2id ; les OTP sont stockés hachés.

### 5.2 Catalogue et tarification — `F-CAT`

| ID | Exigence | Priorité |
|---|---|---|
| F-CAT-01 | Liste des services groupés par catégorie (lavage, repassage, pressing, lavage+repassage, traitement spécial) | Must |
| F-CAT-02 | Chaque service a une unité de facturation : à la pièce ou au kilo | Must |
| F-CAT-03 | Grille tarifaire par couple (service × type d'article) : chemise, pantalon, costume, drap, rideau, couette… | Must |
| F-CAT-04 | Page tarifs publique, consultable sans compte | Must |
| F-CAT-05 | Historisation des tarifs (`effectiveFrom` / `effectiveTo`), modifiables en back-office | Must |
| F-CAT-06 | Délai de traitement standard affiché par service (ex. 48 h) et option express avec majoration | Should |
| F-CAT-07 | Packs et abonnements prépayés | V2 |

**Règle de prix :** le prix applicable est celui de la `PriceRule` active à l'instant de la
validation de commande. Il est **copié** dans la ligne de commande. Une modification de
tarif ultérieure ne modifie jamais une commande existante.

### 5.3 Panier et commande — `F-CMD`

| ID | Exigence | Priorité |
|---|---|---|
| F-CMD-01 | Ajouter au panier : service + type d'article + quantité + instructions libres (250 car. max) | Must |
| F-CMD-02 | Modifier quantité, supprimer une ligne, vider le panier ; panier persistant par utilisateur | Must |
| F-CMD-03 | Choix du mode de retrait : **enlèvement à domicile** ou **dépôt en agence** | Must |
| F-CMD-04 | Choix d'un créneau de retrait et d'un créneau de livraison parmi des créneaux à capacité limitée | Must |
| F-CMD-05 | Récapitulatif avant validation : sous-total, remise, frais de livraison, total TTC | Must |
| F-CMD-06 | Application d'un code promo et/ou de points de fidélité au checkout | Must |
| F-CMD-07 | Génération d'une référence lisible unique à la validation (`LN-2026-000142`) | Must |
| F-CMD-08 | Annulation par le client tant que la commande n'a pas été récupérée | Must |
| F-CMD-09 | Historique des commandes, filtrable par statut, avec détail et facture | Must |
| F-CMD-10 | Recommander à l'identique depuis une commande passée | Nice |

**Règles de commande :**

- Le total est **toujours recalculé côté serveur** au moment de la validation. Aucun
  montant venant du client n'est utilisé.
- Le créneau de livraison doit être postérieur au créneau de retrait + délai de traitement
  du service le plus lent du panier.
- Un créneau plein n'est pas sélectionnable ; la réservation décrémente la capacité de
  façon atomique (transaction) pour éviter la sur-réservation.
- Montant minimum de commande pour la livraison à domicile : `MIN_ORDER_XOF` (configurable,
  défaut 2 000 F). En dessous, frais de livraison appliqués ou dépôt en agence imposé.
- **À VALIDER :** frais de livraison forfaitaires par commune (proposition par défaut :
  forfait unique configurable, gratuit au-dessus de 10 000 F).

### 5.4 Cycle de vie de la commande — `F-STA`

| ID | Exigence | Priorité |
|---|---|---|
| F-STA-01 | Statuts et transitions strictement contrôlés par une machine à états | Must |
| F-STA-02 | Chaque transition enregistre : ancien statut, nouveau statut, auteur, horodatage, motif éventuel | Must |
| F-STA-03 | Le client voit une frise de progression lisible en français | Must |
| F-STA-04 | Notification à chaque changement de statut visible par le client | Must |

**Machine à états :**

```
DRAFT ──────────────► PENDING_PICKUP ──► PICKED_UP ──► PROCESSING ──► READY
   │                        │                                            │
   │                        │                                            ▼
   └──► CANCELLED ◄─────────┘                                    OUT_FOR_DELIVERY
                                                                         │
                          ON_HOLD ◄──► (PROCESSING | READY)              ▼
                                                                     DELIVERED
```

- `CANCELLED` accessible uniquement depuis `DRAFT` et `PENDING_PICKUP`.
- `ON_HOLD` : incident (vêtement abîmé, article manquant, client injoignable). Motif
  obligatoire. Retour possible vers le statut précédent.
- Toute autre transition est refusée par le domaine et testée unitairement.
- Libellés client : En attente d'enlèvement · Récupéré · En traitement · Prêt · En
  livraison · Livré · Annulé · Suspendu.

### 5.5 Paiement et facturation — `F-PAY`

| ID | Exigence | Priorité |
|---|---|---|
| F-PAY-01 | Paiement à la livraison (espèces) | Must |
| F-PAY-02 | Paiement Mobile Money (Wave, Orange Money, MTN) via une interface `PaymentProvider`, implémentation **sandbox** en V1 | Must |
| F-PAY-03 | Traitement des webhooks provider : signature vérifiée, idempotence garantie, rejeu sans effet | Must |
| F-PAY-04 | Statuts de paiement : `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `REFUNDED` | Must |
| F-PAY-05 | Facture PDF générée à la livraison, numérotation séquentielle sans trou, téléchargeable | Must |
| F-PAY-06 | Reçu affiché immédiatement après paiement | Must |
| F-PAY-07 | Remboursement total ou partiel déclenché en back-office (trace, pas d'appel provider en V1) | Should |
| F-PAY-08 | Paiement par carte bancaire réel | V2 |

**Règles :** le montant débité est recalculé côté serveur depuis la commande. Une commande
ne peut pas passer en `DELIVERED` sans un paiement `PAID` ou un mode `CASH` marqué encaissé.
Le payload brut du provider est conservé pour audit.

### 5.6 Livraison — `F-LIV`

| ID | Exigence | Priorité |
|---|---|---|
| F-LIV-01 | Créneaux configurables en back-office (date, plage horaire, capacité) | Must |
| F-LIV-02 | Affectation d'un livreur à une livraison | Must |
| F-LIV-03 | Vue « ma tournée du jour » pour le livreur : liste ordonnée, adresse, téléphone client, montant à encaisser | Must |
| F-LIV-04 | Confirmation de remise par **OTP** communiqué au client (ou signature tactile en repli) | Must |
| F-LIV-05 | Marquage « client absent » avec motif, replanification | Should |
| F-LIV-06 | Optimisation de tournée, géolocalisation temps réel | V2 |

**Règle :** la transition `OUT_FOR_DELIVERY → DELIVERED` exige un OTP valide. L'OTP est
généré à la sortie du colis, hashé en base, valide 24 h.

### 5.7 Notifications — `F-NOT`

| ID | Exigence | Priorité |
|---|---|---|
| F-NOT-01 | Email transactionnel à chaque changement de statut significatif | Must |
| F-NOT-02 | SMS derrière une interface `SmsProvider`, implémentation simulée en V1 (log + affichage en back-office) | Must |
| F-NOT-03 | Toute notification est journalisée (canal, template, destinataire masqué, statut d'envoi, erreur) | Must |
| F-NOT-04 | Préférences de notification par utilisateur | Should |
| F-NOT-05 | Un échec d'envoi ne bloque jamais la transaction métier | Must |

### 5.8 Service client — `F-SUP`

| ID | Exigence | Priorité |
|---|---|---|
| F-SUP-01 | Ouverture d'une réclamation liée ou non à une commande (sujet, description, pièce jointe photo) | Must |
| F-SUP-02 | Fil de messages entre client et staff, statuts `OPEN` / `PENDING` / `RESOLVED` / `CLOSED` | Must |
| F-SUP-03 | Coordonnées de contact affichées : téléphone et lien WhatsApp `wa.me` | Must |
| F-SUP-04 | Traitement des réclamations en back-office avec assignation | Should |
| F-SUP-05 | Chat temps réel, WhatsApp Business API | V2 |

**À VALIDER :** politique de dédommagement en cas de vêtement abîmé ou perdu.
Proposition par défaut : avoir en points de fidélité à hauteur du montant de la ligne,
décision manuelle de l'admin, tracée dans `AuditLog`.

### 5.9 Fidélité et promotions — `F-FID`

| ID | Exigence | Priorité |
|---|---|---|
| F-FID-01 | Cumul de points à la livraison : `1 point / 100 F` dépensés, arrondi inférieur | Must |
| F-FID-02 | Utilisation des points au checkout : `1 point = 1 F`, plafond 30 % du sous-total | Must |
| F-FID-03 | Historique des mouvements de points (gain, usage, expiration, geste commercial) | Must |
| F-FID-04 | Codes promo : pourcentage ou montant fixe, période de validité, nombre d'usages max, usage unique par client | Must |
| F-FID-05 | Non-cumul de deux codes promo sur une même commande | Must |
| F-FID-06 | Parrainage | V2 |

**À VALIDER :** expiration des points. Proposition par défaut : 12 mois sans activité.
Les points sont crédités à `DELIVERED`, et repris si la commande est remboursée.

### 5.10 Back-office — `F-ADM`

| ID | Exigence | Priorité |
|---|---|---|
| F-ADM-01 | Tableau de bord : CA du jour / 7 j / 30 j, nombre de commandes par statut, panier moyen, top services, courbe sur 60 j | Must |
| F-ADM-02 | Commandes : liste filtrable (statut, date, client, livreur), recherche par référence, détail, changement de statut | Must |
| F-ADM-03 | Clients : liste, fiche, historique, blocage | Must |
| F-ADM-04 | Services et tarifs : CRUD avec historisation | Must |
| F-ADM-05 | Créneaux : création en masse sur une plage de dates, capacité | Must |
| F-ADM-06 | Livreurs : CRUD, affectation, tournée du jour | Must |
| F-ADM-07 | Codes promo : CRUD, suivi d'utilisation | Must |
| F-ADM-08 | Export CSV : commandes, paiements, clients, sur période sélectionnée | Must |
| F-ADM-09 | Journal d'audit des actions sensibles (changement de tarif, de statut, remboursement, blocage) | Must |
| F-ADM-10 | Rôles distincts `STAFF` / `COURIER` / `ADMIN` avec permissions différenciées | Must |

---

## 6. Exigences non fonctionnelles

| ID | Exigence | Cible |
|---|---|---|
| NF-PERF-01 | LCP sur la page catalogue en 3G simulée | < 2,5 s |
| NF-PERF-02 | Réponse serveur des pages principales (p95) | < 500 ms |
| NF-PERF-03 | Aucune requête N+1 sur les listes de commandes | vérifié en revue |
| NF-SEC-01 | Autorisation vérifiée côté serveur sur chaque action et chaque route | 100 % |
| NF-SEC-02 | Validation zod de toute entrée externe | 100 % |
| NF-SEC-03 | Rate-limit sur login, OTP, création de commande, messages support | actif |
| NF-SEC-04 | Aucune donnée personnelle en clair dans les logs | vérifié |
| NF-SEC-05 | Secrets hors du dépôt, `.env.example` fourni | vérifié |
| NF-A11Y-01 | Contraste AA, navigation clavier, labels, cibles tactiles ≥ 44 px | vérifié |
| NF-COMP-01 | Utilisable en WebView Android et iOS, écran 375 px | vérifié |
| NF-TEST-01 | Logique métier du domaine couverte par des tests unitaires | 100 % des règles listées ici |
| NF-TEST-02 | Parcours e2e : inscription+OTP, commande jusqu'au paiement, transition admin | 3 scénarios verts |
| NF-OBS-01 | Logs structurés, erreurs serveur remontées avec identifiant de corrélation | actif |
| NF-DOC-01 | README permettant un démarrage local en ≤ 5 commandes, comptes de démo fournis | vérifié |

---

## 7. Données de démonstration attendues

Le seed doit produire une démo crédible : 5 catégories, ~10 services, ~15 types
d'articles avec tarifs XOF réalistes pour Abidjan, 3 clients (dont 1 professionnel),
1 livreur, 1 agent, 1 admin, ~25 commandes réparties sur tous les statuts et sur 60 jours
pour que le tableau de bord affiche de vraies courbes, 2 codes promo (dont un expiré),
1 réclamation ouverte. Identifiants de démo documentés dans le README.

---

## 8. Questions ouvertes

Chaque point ci-dessous doit être tranché ou faire l'objet d'un ADR avec une décision
par défaut explicite avant l'implémentation de la feature concernée.

1. Frais de livraison : forfait unique, par commune, ou par distance ? (`F-CMD`)
2. Délai d'annulation gratuite après validation ? (`F-CMD-08`)
3. Que se passe-t-il si le client est absent deux fois ? (`F-LIV-05`)
4. Politique de dédommagement vêtement abîmé/perdu ? (`F-SUP`)
5. Expiration des points de fidélité ? (`F-FID`)
6. Facturation professionnelle : facture par commande ou récapitulatif mensuel ? (`F-AUTH-07`)
7. TVA : les montants sont-ils TTC uniquement, ou faut-il détailler la TVA sur la facture ?

---

## 9. Glossaire

| Terme | Définition |
|---|---|
| **Créneau (slot)** | Plage horaire datée, à capacité limitée, réservable pour un retrait ou une livraison |
| **Enlèvement (pickup)** | Récupération des vêtements chez le client |
| **Dépôt en agence** | Le client apporte lui-même ses vêtements |
| **Ligne de commande** | Couple service × type d'article, avec quantité et prix figé |
| **OTP** | Code à usage unique, utilisé pour vérifier un téléphone et confirmer une remise |
| **Sandbox** | Implémentation simulée d'un provider externe, sans appel réseau réel |
