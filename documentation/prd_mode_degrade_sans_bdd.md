# PRD — Mode dégradé sans base de données

## Statut

- **Version** : 1.0
- **Date** : 19 août 2026
- **Statut** : Lots 1 à 4 implémentés et validés avant revue ; déploiement des Lots 2 à 4 non effectué
- **Périmètre** : application `sale-wall`, routes Sale-wall, pages podcast et worker `pg-boss`
- **Incident déclencheur** : PostgreSQL temporairement en recovery, échec de `pg-boss`, arrêt du processus Node.js et réponses HTTP 503 globales

---

## 0. Décision structurante

Une indisponibilité temporaire de PostgreSQL ne doit plus empêcher le serveur HTTP de démarrer ni rendre indisponibles les contenus qui ne dépendent pas strictement de la base.

`pg-boss` reste le mécanisme de traitement asynchrone des épisodes. Il n'est pas supprimé et n'est pas remplacé par un traitement synchrone dans les requêtes HTTP.

Les trois capacités suivantes doivent être découplées :

1. servir le site et les contenus statiques ;
2. lire et écrire les données métier PostgreSQL ;
3. initialiser et exploiter le worker `pg-boss`.

Le produit accepte une expérience partielle explicite pendant une panne de base, puis revient automatiquement au fonctionnement nominal sans redéploiement ni redémarrage manuel.

---

## 1. Contexte et problème

Aujourd'hui, l'application initialise `pg-boss` avant d'ouvrir le port HTTP. Si PostgreSQL refuse les écritures — par exemple pendant un recovery ou un basculement — `pg-boss` échoue et le processus appelle `process.exit(1)`.

Cette stratégie protège contre un worker cassé après un déploiement, mais elle transforme une panne PostgreSQL partielle et temporaire en panne complète :

- la landing page devient indisponible alors qu'elle n'utilise pas PostgreSQL ;
- `/podcast` devient indisponible alors qu'il n'utilise pas PostgreSQL ;
- une page épisode ne peut plus afficher ses données RSS ni son lecteur audio ;
- Clever Cloud relance le même processus et peut entrer dans une boucle de déploiement ;
- le domaine renvoie 503 tant qu'aucune instance n'écoute le port HTTP.

L'incident du 19 août 2026 a également montré qu'une connexion PostgreSQL peut être acceptée alors que les écritures restent interdites. Un état binaire « connecté / déconnecté » ne suffit donc pas.

### 1.1 Bilan vérifié de `ALLOW_DEGRADED_MODE=true`

Le projet possède déjà un mécanisme d'urgence partiel. Lorsque `ALLOW_DEGRADED_MODE=true`, l'échec initial de `pg-boss` est intercepté et le serveur poursuit son démarrage au lieu d'appeler `process.exit(1)`.

Ce comportement a été vérifié en production le 19 août 2026 vers 14:05 CEST, pendant que l'add-on PostgreSQL répondait encore `57P03 — the database system is in recovery mode`.

#### Résultat observé

| Élément contrôlé | Résultat | Bilan |
|---|---:|---|
| Variable Clever Cloud `ALLOW_DEGRADED_MODE` | `true` | flag effectivement injecté |
| Déploiement avec le flag | `OK` | le process démarre malgré l'échec de `pg-boss` |
| `GET /` | 200 | landing entièrement accessible |
| `GET /podcast` | 200 | page générale du podcast accessible |
| Domaine direct `cleverapps.io` | 200 | le succès ne vient pas uniquement du cache Cloudflare |
| `GET /wall` | 200 | rendu trompeur : wall vide avec « Aucun récit partagé » |
| `GET /podcast/2/1` | 500 | échec non intercepté sur `app.pg.connect()` |
| `GET /health` | 200, `{"ok":true}` | liveness fonctionnelle mais aucun signal de dégradation |
| État PostgreSQL au même moment | erreur `57P03`, recovery | dépendance toujours indisponible |
| Initialisation `pg-boss` | une tentative au démarrage | aucune reconnexion automatique observée |

#### Ce que le flag résout déjà

- il empêche l'échec de `pg-boss` de tuer immédiatement le processus ;
- il permet à Fastify d'ouvrir le port attendu par Clever Cloud ;
- il rend la home, `/podcast` et les ressources indépendantes de la DB accessibles ;
- il constitue une preuve en production de la valeur du premier lot.

#### Ce que le flag ne résout pas

- il nécessite une activation manuelle par variable d'environnement ;
- il ne distingue pas DB indisponible, DB read-only et worker indisponible ;
- il ne relance pas `pg-boss` lorsque PostgreSQL redevient disponible ;
- il faut donc redémarrer l'application pour tenter de récupérer le worker ;
- il laisse la référence globale `boss` assignée à une instance dont `start()` a échoué ;
- il ne protège pas les accès DB directs des routes ;
- il présente le Sale-wall comme vide au lieu de l'annoncer indisponible ;
- il laisse les pages épisode retourner 500 avant même la mise en queue ;
- il ne rend pas l'état dégradé observable dans `/health` ;
- il ne protège pas les écritures et uploads contre une panne DB en cours de requête.

#### Conclusion produit

`ALLOW_DEGRADED_MODE=true` n'est pas à remplacer immédiatement : il reste le filet de sécurité de production pendant l'implémentation. Le PRD transforme ce contournement manuel et incomplet en comportement automatique, explicite et réversible à chaud.

### 1.2 Bilan du preflight d'implémentation

Le preflight local a été exécuté le 19 août 2026 avant toute modification fonctionnelle. Il valide la faisabilité du Lot 1 et précise le seam technique à introduire pour la reconnexion du worker.

#### Protocole

- PostgreSQL 16 isolé du reste de l'environnement local ;
- application des sept migrations du projet sur une base vide ;
- exécution de la suite complète dans l'état nominal ;
- démarrage du serveur avec une URI PostgreSQL inaccessible et `ALLOW_DEGRADED_MODE=true` ;
- remise à disposition de PostgreSQL sur la même URI, sans redémarrer le serveur ;
- nouvel essai d'initialisation de `pg-boss` avec une instance neuve.

#### Résultats

| Vérification | Résultat | Conclusion |
|---|---:|---|
| Migrations sur PostgreSQL vide | 7/7 appliquées | schéma reproductible pour les tests d'acceptation |
| Suite nominale | 88 tests réussis, 0 échec | baseline verte avant feature |
| `GET /` avec DB absente au boot | 200 | la home est déjà indépendante des requêtes DB |
| `GET /podcast` avec DB absente au boot | 200 | la page générale est déjà indépendante de la DB |
| `GET /wall` avec DB absente au boot | 200 trompeur | l'erreur est absorbée et présentée comme un wall vide |
| `GET /podcast/2/1` avec DB absente au boot | 500 | l'accès direct à `app.pg.connect()` reste non protégé |
| `GET /health` avec DB absente au boot | 200, `{"ok":true}` | aucune observabilité du mode dégradé |
| Pool Fastify après retour de PostgreSQL | récupération automatique observée | les accès DB HTTP peuvent reprendre sans reconstruire l'application |
| Page épisode après retour de PostgreSQL | reste en 500 | l'ancienne instance `pg-boss` partiellement initialisée casse la mise en queue |
| Nouvelle instance `PgBoss` après le retour DB | démarrage et envoi d'un job réussis | la récupération à chaud est faisable en remplaçant l'instance échouée |

Après le retour de PostgreSQL, l'erreur de la page épisode n'est plus une erreur de connexion. Elle devient une erreur interne de `pg-boss` lors de `send()` : l'instance globale existe, mais son manager n'a jamais terminé son initialisation. La simple présence de `boss` ne constitue donc pas un état `READY`.

#### Seams de test manquants

- aucun test de route ne couvre actuellement la home sans DB ;
- le helper Fastify force `DISABLE_WORKER=true`, donc il ne peut pas exercer le démarrage dégradé ni la reconnexion ;
- aucun test ne couvre la transition DB absente → DB disponible dans le même processus ;
- la suite mélange tests locaux et appels réseau réels vers les plateformes, ce qui nécessite de distinguer les tests d'acceptation du mode dégradé des intégrations externes.

#### Décision de preflight

**GO conditionnel pour le Lot 1**, avec les garde-fous suivants :

1. introduire un gestionnaire de cycle de vie testable qui expose explicitement `STOPPED`, `STARTING`, `READY`, `RETRY_SCHEDULED` et `STOPPING` ;
2. ne publier la référence singleton qu'après un `start()` et un `createQueue()` réussis, ou invalider systématiquement l'instance en échec ;
3. créer une nouvelle instance `PgBoss` à chaque tentative après échec, avec une seule boucle de retry ;
4. ajouter un test d'acceptation du boot sans DB et un test DB absente → DB revenue sans redémarrage ;
5. conserver la baseline nominale verte avant de modifier `/wall` et les pages épisode dans les lots suivants.

### 1.3 Bilan de livraison du Lot 1

Le Lot 1 a été livré sur `main` puis déployé sur Clever Cloud le 19 août 2026 avec
le commit `269e18423505a422c266580e091555e11637e787`.

#### Vérifications avant production

| Vérification | Résultat |
|---|---:|
| Suite complète | 96 tests réussis, 0 échec |
| Build | réussi |
| Boot local avec PostgreSQL arrêté | `/`, `/podcast` et `/health` en 200 |
| Retour de PostgreSQL sans restart Node.js | worker passé à `READY` |
| `/health` après reprise locale | mode `normal`, DB `read_write`, worker `ready` |

#### Vérifications en production

| Vérification | Résultat |
|---|---:|
| Déploiement Clever Cloud `deployment_846598c5-8464-4955-a211-99bb1b4fd20e` | `OK` |
| Commit actif | `269e18423505a422c266580e091555e11637e787` |
| État PostgreSQL observé au démarrage du worker | `read_write` |
| État `pg-boss` | `ready` |
| `GET /health` | 200, mode `normal` |
| `GET /` | 200 |
| `GET /podcast` | 200 |
| `GET /wall` | 200 |
| `GET /podcast/2/1` | 200 |

Payload de santé observé après déploiement :

```json
{
  "ok": true,
  "mode": "normal",
  "database": { "state": "read_write" },
  "episodeWorker": { "state": "ready" }
}
```

Aucune phase `recovery` n'a été observée sur ce déploiement : le premier état de
base exploitable journalisé par le nouveau processus était `read_write`. Le
déploiement est passé à `OK` sans nouvelle boucle `Monitoring/Unreachable`.

#### Suivis non bloquants

- Les fallbacks produit de `/wall` et des pages épisode restent le périmètre du Lot 2.
- Le buffer d'intentions et son drainage restent le périmètre du Lot 3.
- `ALLOW_DEGRADED_MODE` n'est plus lu par le code du Lot 1. La variable Clever peut
  rester temporairement pendant la fenêtre de rollback, puis être supprimée pour
  éviter une configuration trompeuse.
- Le démarrage a signalé une configuration OP3 incomplète (`OP3_API_TOKEN` ou
  `OP3_GUID` absent) sans bloquer l'application.
- L'installation de production signale une vulnérabilité npm de sévérité haute à
  qualifier dans un suivi sécurité séparé.

---

## 2. Objectifs

### Premier lot shippable — Home disponible sans DB

Le premier incrément livré doit garantir une seule promesse produit observable :

> La home reste accessible même si PostgreSQL et `pg-boss` sont indisponibles.

Ce lot comprend le minimum technique nécessaire pour tenir cette promesse :

- généraliser le comportement aujourd'hui obtenu manuellement avec `ALLOW_DEGRADED_MODE=true` ;
- supprimer la sortie fatale liée à l'échec d'initialisation de `pg-boss` dans le fonctionnement nominal ;
- ouvrir le port HTTP sans attendre PostgreSQL ou le worker, sans dépendre d'un flag d'urgence ;
- garantir `GET /` en HTTP 200 sans probe DB dans son chemin de réponse ;
- conserver la liveness HTTP déjà opérationnelle en 200 et exposer en plus l'état dégradé dans `/health` ;
- nettoyer toute instance `PgBoss` partiellement initialisée ;
- lancer la reconnexion du worker via un mécanisme singleton non bloquant ;
- vérifier sur Clever Cloud qu'une DB inaccessible ne provoque plus de boucle de déploiement.

Ce lot ne promet pas encore le comportement dégradé final de `/wall` ou de `/podcast/:season/:episode`. Ces routes peuvent être traitées dans les lots suivants. La page `/podcast`, déjà indépendante de PostgreSQL, bénéficie néanmoins automatiquement du démarrage HTTP découplé.

#### Critère de sortie du lot 1

Avec une URI PostgreSQL inaccessible dès le démarrage :

- le déploiement Clever Cloud devient joignable ;
- `/` répond 200 avec la landing complète ;
- `/podcast` répond 200 ;
- `/health` répond 200 avec `mode: "degraded"` ;
- le processus reste vivant pendant les retries ;
- une seule boucle de reconnexion `pg-boss` existe ;
- le worker peut revenir à `READY` sans redémarrage lorsque PostgreSQL revient.

### O1 — Maintenir le cœur public du site disponible

Pendant une panne PostgreSQL, les routes qui peuvent fonctionner sans la base doivent continuer à répondre :

- `/` ;
- `/podcast` ;
- `/podcast/:season/:episode` avec un contenu partiel issu du RSS ;
- les fichiers statiques ;
- le proxy audio, sous réserve de la disponibilité de sa source distante.

### O2 — Rendre la dégradation compréhensible

Le Sale-wall doit afficher un état « temporairement indisponible » explicite. Une panne de base ne doit pas être présentée comme un wall vide avec zéro récit.

Une page épisode doit continuer à afficher l'épisode, tout en signalant discrètement les enrichissements réellement manquants.

### O3 — Conserver `pg-boss`

`pg-boss` reste responsable de :

- la résolution des liens Spotify, Apple Podcasts et Deezer ;
- la génération et l'envoi des images Open Graph ;
- la mise à jour du cache `episode_links` ;
- la déduplication des traitements par épisode.
- le rafraîchissement quotidien dédupliqué du cache OP3, sur le même singleton.

### O4 — Revenir automatiquement à la normale

Si `pg-boss` ne peut pas démarrer, une seule boucle de reconnexion doit être active. Elle réessaie avec temporisation progressive et démarre le worker dès que PostgreSQL redevient accessible en écriture.

### O5 — Ne pas perdre inutilement les demandes d'enrichissement

Les épisodes consultés pendant l'indisponibilité peuvent être mémorisés comme intentions de mise en queue. À la reconnexion du worker, ces intentions sont drainées vers `pg-boss`, avec déduplication.

---

## 3. Non-objectifs

Cette évolution ne cherche pas à :

- faire fonctionner les écritures du Sale-wall sans PostgreSQL ;
- fournir une file durable lorsque PostgreSQL est indisponible ;
- remplacer PostgreSQL, `pg-boss` ou Clever Cloud ;
- garantir la haute disponibilité de l'add-on PostgreSQL ;
- traiter les jobs d'épisode directement dans une requête HTTP ;
- masquer une panne indépendante du RSS, de Castopod, de Cellar ou du proxy audio ;
- mettre en cache hors PostgreSQL l'intégralité du Sale-wall.

---

## 4. Utilisateurs et besoins

### Visiteur de la landing page

Quand PostgreSQL est indisponible, je veux accéder normalement à la présentation de Saleté Sincère, car cette page ne dépend pas de la base.

### Visiteur du Sale-wall

Quand le Sale-wall ne peut pas accéder à ses données, je veux comprendre qu'il s'agit d'une indisponibilité temporaire, sans croire qu'aucun récit n'a jamais été publié.

### Auditeur du podcast

Quand j'ouvre une URL d'épisode pendant une panne PostgreSQL, je veux toujours voir le titre, la description, la date, l'image et le lecteur issus du RSS. Si les liens enrichis ou les statistiques manquent, je veux une indication sobre qui ne bloque pas l'écoute.

### Exploitant du service

Quand PostgreSQL revient, je veux que l'accès aux données et le worker reprennent automatiquement, sans redéployer l'application ni modifier une variable d'environnement.

---

## 5. Modèle de disponibilité

Le système ne doit pas réduire l'état de PostgreSQL à un booléen. Il distingue au minimum :

| État | Définition | Lecture métier | Écriture métier | `pg-boss` |
|---|---|---:|---:|---:|
| `UNKNOWN` | Aucun contrôle récent ou démarrage en cours | non garantie | non garantie | non prêt |
| `UNAVAILABLE` | Connexion impossible, interrompue ou expirée | non | non | non prêt |
| `READ_ONLY` | Connexion possible mais serveur en recovery ou transaction read-only | oui, si la requête aboutit | non | non prêt |
| `READ_WRITE` | Connexion et écriture autorisées | oui | oui | peut démarrer |

L'état du worker est suivi séparément :

| État | Définition |
|---|---|
| `STOPPED` | Aucun worker actif et aucun démarrage en cours |
| `STARTING` | Une initialisation singleton est en cours |
| `READY` | Queue créée, worker enregistré et prêt à recevoir des jobs |
| `RETRY_SCHEDULED` | Échec transitoire ; une nouvelle tentative unique est programmée |
| `STOPPING` | Arrêt gracieux de l'application |

### Principes

- Une lecture réussie ne prouve pas que PostgreSQL accepte les écritures.
- L'état global aide au routage et à l'observabilité, mais chaque requête doit encore gérer sa propre erreur.
- Une erreur PostgreSQL pertinente met à jour l'état connu et peut déclencher la reconnexion singleton.
- Le serveur HTTP ne quitte jamais uniquement parce que PostgreSQL ou `pg-boss` est indisponible.

---

## 6. Expérience produit par route

### 6.1 Landing page — `GET /`

Comportement attendu :

- réponse HTTP 200 ;
- rendu inchangé ;
- aucune attente d'un probe PostgreSQL ;
- aucune bannière technique liée à la base.

### 6.2 Page générale du podcast — `GET /podcast`

Comportement attendu :

- réponse HTTP 200 ;
- rendu inchangé ;
- liens génériques vers les plateformes conservés ;
- aucune dépendance PostgreSQL ou `pg-boss`.

### 6.3 Page épisode — `GET /podcast/:season/:episode`

#### Mode nominal

- charger les métadonnées depuis le RSS ;
- lire `episode_links` ;
- afficher les liens d'épisode, l'image OG et les statistiques disponibles ;
- mettre un job en queue si le cache manque ou est obsolète.

#### PostgreSQL lisible mais non inscriptible

- tenter la lecture du cache avec un délai borné ;
- afficher les données en cache lorsqu'elles sont disponibles ;
- ne pas tenter d'écriture ni d'envoi vers `pg-boss` tant que le worker n'est pas `READY` ;
- mémoriser une intention d'enrichissement si le cache est incomplet ou obsolète ;
- afficher un message uniquement si du contenu visible manque réellement.

#### PostgreSQL indisponible

- ne pas transformer l'erreur de base en erreur HTTP globale ;
- afficher les métadonnées RSS, l'image RSS et le lecteur audio ;
- conserver le lien Castopod de l'épisode ;
- utiliser les liens génériques du podcast comme fallbacks Spotify, Apple Podcasts et Deezer ;
- masquer les statistiques OP3 dépendantes de la base ;
- mémoriser une intention d'enrichissement bornée en mémoire ;
- répondre HTTP 200.

#### Message proposé

> Certains liens directs et les statistiques sont temporairement indisponibles. L'épisode reste accessible normalement.

Le message doit être discret, accessible et absent lorsque toutes les informations utiles sont disponibles malgré un état technique dégradé.

### 6.4 Sale-wall — `GET /wall`

#### Mode nominal

Comportement actuel conservé : récits, statistiques, enregistrement et votes.

#### PostgreSQL non `READ_WRITE`

- répondre HTTP 200 avec le template du wall ;
- ne pas afficher « Aucun récit partagé » ni des statistiques artificiellement à zéro ;
- afficher un état d'indisponibilité dédié ;
- masquer ou désactiver le formulaire d'enregistrement ;
- masquer ou désactiver les contrôles de vote ;
- conserver le lien vers le podcast et la navigation générale.

#### Message proposé

> Le Sale-wall est temporairement indisponible. Le podcast et le reste du site restent accessibles. Réessaie dans quelques minutes.

### 6.5 Création d'un récit — `POST /api/posts`

Lorsque PostgreSQL n'est pas `READ_WRITE` :

- refuser la requête avant l'envoi du fichier vers Cellar ;
- répondre HTTP 503 ;
- ajouter `Retry-After: 60` ;
- retourner une erreur JSON stable et exploitable par le frontend ;
- ne créer aucun objet S3 orphelin.

Contrat proposé :

```json
{
  "success": false,
  "code": "SERVICE_TEMPORARILY_UNAVAILABLE",
  "retryable": true,
  "message": "Le Sale-wall est temporairement indisponible. Réessaie dans quelques minutes."
}
```

Si PostgreSQL devient indisponible après l'envoi S3 mais avant l'insertion, l'application tente de supprimer l'objet envoyé. Cette suppression est en best effort et son échec est journalisé.

### 6.6 Vote — `POST /api/posts/:id/vote`

Lorsque PostgreSQL n'est pas `READ_WRITE` :

- répondre HTTP 503 avec le même code fonctionnel ;
- ajouter `Retry-After: 60` ;
- ne pas transformer l'erreur en 500 générique ;
- permettre au frontend de restaurer l'état visuel du bouton.

### 6.7 Proxy audio — `/api/audio/proxy`

Comportement inchangé. Cette route ne doit pas dépendre de PostgreSQL ou de l'état du worker.

---

## 7. Cycle de vie singleton de `pg-boss`

### 7.1 Démarrage non bloquant

Le port HTTP est ouvert indépendamment de `pg-boss`. Une première tentative de démarrage du worker est lancée en arrière-plan après l'initialisation de Fastify, sans bloquer la disponibilité HTTP.

### 7.2 Garantie singleton

Une fonction unique de type `ensureEpisodeWorkerStarted()` porte le cycle de vie du worker.

Elle doit garantir que :

- si le worker est `READY`, elle retourne immédiatement l'instance active ;
- si un démarrage est `STARTING`, tous les appels partagent la même promesse ;
- si un retry est déjà programmé, aucun timer supplémentaire n'est créé ;
- une rafale de requêtes podcast ne peut créer ni plusieurs instances `PgBoss`, ni plusieurs workers, ni plusieurs boucles de retry ;
- pendant `STOPPING`, aucun nouveau démarrage n'est autorisé.

### 7.3 Initialisation atomique

L'instance globale `boss` n'est publiée qu'après succès de toutes les étapes :

1. construction de l'instance locale ;
2. `boss.start()` ;
3. création ou validation de la queue `resolve-episode` ;
4. enregistrement du worker ;
5. passage à l'état `READY`.

En cas d'échec :

- arrêter l'instance locale en best effort ;
- remettre la référence publique à `null` ;
- classifier et journaliser l'erreur sans secret ;
- passer à `RETRY_SCHEDULED` ;
- programmer une seule nouvelle tentative.

Cette règle évite qu'un objet `PgBoss` partiellement initialisé soit considéré comme utilisable.

### 7.4 Temporisation de reconnexion

Séquence recommandée :

- tentative immédiate ;
- 5 secondes ;
- 15 secondes ;
- 30 secondes ;
- 60 secondes maximum entre les tentatives suivantes ;
- jitter de ±20 % pour éviter des reprises synchronisées.

Après un démarrage réussi, le compteur de retry est remis à zéro.

### 7.5 Perte de connexion après démarrage

Une erreur de connexion émise après le passage à `READY` doit :

- faire quitter l'état `READY` ;
- empêcher les nouveaux `send()` ;
- nettoyer l'ancienne instance en best effort ;
- déclencher la même reconnexion singleton ;
- ne pas arrêter le serveur HTTP.

### 7.6 Arrêt gracieux

Sur `SIGTERM` ou `SIGINT` :

- passer le worker à `STOPPING` ;
- annuler le timer de retry ;
- attendre ou invalider la promesse de démarrage en cours ;
- arrêter l'instance active ;
- fermer Fastify et son pool PostgreSQL ;
- empêcher toute résurrection du worker pendant l'arrêt.

---

## 8. Mise en queue pendant le mode dégradé

### 8.1 Contrat de mise en queue

`queueEpisodeResolution()` ne doit plus retourner uniquement un identifiant ou `null`. Il retourne un résultat explicite :

```json
{
  "queued": false,
  "reason": "WORKER_UNAVAILABLE"
}
```

Raisons minimales :

- `QUEUED` ;
- `ALREADY_QUEUED` ;
- `WORKER_UNAVAILABLE` ;
- `SHUTTING_DOWN` ;
- `QUEUE_ERROR`.

Une indisponibilité du worker ne doit jamais faire échouer le rendu HTTP d'une page épisode.

### 8.2 Intentions en mémoire

Lorsqu'un épisode doit être enrichi mais que le worker n'est pas prêt, l'application conserve une intention en mémoire :

- clé : `episode-{season}-{episode}` ;
- valeur : payload validé issu du RSS ;
- déduplication par clé ;
- maximum recommandé : 100 intentions ;
- durée de vie maximale recommandée : 1 heure ;
- remplacement par la donnée RSS la plus récente pour une même clé.

À la reconnexion :

- drainer les intentions vers `pg-boss` ;
- conserver le `singletonKey` PostgreSQL existant ;
- supprimer une intention seulement après confirmation de `boss.send()` ;
- continuer le drainage même si une intention individuelle échoue ;
- journaliser le nombre d'intentions drainées, ignorées et échouées.

Cette mémoire est volontairement non durable. Après un redémarrage complet, une nouvelle visite de la page redétecte le cache manquant et recrée l'intention.

### 8.3 Déduplication

La déduplication existe à deux niveaux :

1. `Map` en mémoire pendant l'indisponibilité ;
2. `singletonKey` dans `pg-boss` après reconnexion.

Le traitement du worker reste idempotent : avant les appels externes coûteux et avant toute suppression S3, il vérifie autant que possible l'état déjà présent dans `episode_links`.

---

## 9. Détection et gestion des erreurs PostgreSQL

Le mode dégradé couvre notamment :

- refus de connexion ;
- timeout de connexion ou de requête ;
- connexion terminée ;
- PostgreSQL en démarrage ou recovery ;
- transaction ou serveur en lecture seule ;
- perte de connexion après démarrage du worker.

Exigences :

- borner les tentatives de connexion utilisées dans le chemin HTTP ;
- ne jamais attendre la boucle de retry du worker dans une requête utilisateur ;
- vérifier la capacité d'écriture avec un signal PostgreSQL adapté, et pas seulement `SELECT 1` ;
- ne pas exposer le hostname, l'URI, l'utilisateur ou les détails internes de PostgreSQL dans les réponses HTTP ;
- ne pas classer comme panne de base une erreur métier ou une erreur SQL de programmation.

Un probe périodique peut maintenir un état indicatif, mais il ne remplace pas la gestion d'erreur locale de chaque requête.

---

## 10. Santé, observabilité et exploitation

### 10.1 Liveness

La liveness mesure uniquement la capacité du processus HTTP à répondre. Elle ne dépend ni de PostgreSQL ni de `pg-boss`.

- retourne HTTP 200 tant que Fastify fonctionne ;
- ne déclenche pas de redémarrage Clever Cloud lors d'une panne PostgreSQL.

### 10.2 État applicatif

`GET /health` retourne HTTP 200 avec un état synthétique :

```json
{
  "ok": true,
  "mode": "degraded",
  "database": {
    "state": "read_only"
  },
  "episodeWorker": {
    "state": "retry_scheduled"
  },
  "episodeIntents": {
    "pending": 1
  }
}
```

Contraintes :

- aucune donnée de connexion ni message d'erreur brut ;
- `mode: "normal"` uniquement lorsque PostgreSQL est `READ_WRITE` et le worker `READY` ;
- `ok: true` signifie que le processus sert HTTP, pas que toutes les dépendances sont disponibles.

### 10.3 Logs structurés

Événements minimaux :

- changement d'état PostgreSQL ;
- tentative de démarrage du worker ;
- succès ou échec du démarrage ;
- délai avant prochain retry ;
- passage en mode dégradé et retour au mode normal ;
- intention d'épisode mémorisée ;
- drainage des intentions ;
- requête Sale-wall refusée avec 503.

Les erreurs répétées sont agrégées ou limitées pour éviter un bruit de log toutes les quelques secondes.

### 10.4 Indicateurs recommandés

- durée totale passée en mode dégradé ;
- nombre de transitions vers `UNAVAILABLE` ou `READ_ONLY` ;
- nombre de tentatives et d'échecs de reconnexion `pg-boss` ;
- taille du buffer d'intentions ;
- nombre de réponses dégradées par route ;
- nombre de 503 fonctionnels sur les écritures du Sale-wall.

---

## 11. Exigences fonctionnelles

| ID | Exigence | Priorité |
|---|---|---:|
| FR-01 | Le serveur HTTP démarre même si PostgreSQL est indisponible ou en lecture seule | Must |
| FR-02 | La landing et `/podcast` répondent 200 sans accès DB | Must |
| FR-03 | Une page épisode répond 200 depuis le RSS lorsque la DB échoue | Must |
| FR-04 | Les enrichissements manquants sont signalés sans bloquer l'écoute | Must |
| FR-05 | `/wall` affiche un état indisponible distinct d'un wall vide | Must |
| FR-06 | Les écritures du wall répondent 503 et `Retry-After` lorsque la DB n'est pas inscriptible | Must |
| FR-07 | `pg-boss` se reconnecte automatiquement avec une boucle singleton | Must |
| FR-08 | Une instance partiellement initialisée n'est jamais exposée | Must |
| FR-09 | Une panne du worker ne fait pas échouer une page épisode | Must |
| FR-10 | Les intentions d'épisode sont dédupliquées et drainées après reconnexion | Should |
| FR-11 | Le retour au mode nominal ne nécessite aucun redéploiement | Must |
| FR-12 | L'arrêt gracieux annule les retries et ferme le worker | Must |
| FR-13 | `/health` expose le mode sans divulguer de secrets | Must |
| FR-14 | Aucun upload audio n'est commencé lorsque l'écriture DB est déjà connue comme indisponible | Must |

---

## 12. Exigences non fonctionnelles

### Résilience

- aucune boucle de redéploiement causée uniquement par une indisponibilité PostgreSQL ;
- aucune multiplication de workers ou de timers sous charge ;
- reprise automatique après une panne transitoire.

### Performance

- le fallback podcast ne doit pas ajouter un délai PostgreSQL non borné au temps de réponse ;
- les probes ne doivent pas saturer le pool limité de l'add-on ;
- le buffer d'intentions reste borné.

### Sécurité

- les réponses publiques ne contiennent aucun détail d'infrastructure ;
- les validations et rate limits existants restent actifs ;
- aucun payload utilisateur arbitraire n'est stocké dans le buffer d'intentions ;
- seuls les payloads reconstruits depuis un épisode RSS validé sont conservés.

### Cohérence

- pas de traitement asynchrone hors `pg-boss` ;
- pas de promesse de création ou de vote tant que PostgreSQL ne confirme pas l'écriture ;
- les fallbacks podcast ne doivent jamais être présentés comme des liens directs vers l'épisode lorsqu'ils pointent vers la page générale d'une plateforme.

---

## 13. Critères d'acceptation

### AC-01 — Démarrage sans PostgreSQL

Étant donné une URI PostgreSQL inaccessible, quand l'application démarre, alors :

- le processus reste actif ;
- le port HTTP est ouvert ;
- `/`, `/podcast` et `/health` répondent 200 ;
- le worker passe à `RETRY_SCHEDULED` ;
- aucun deuxième timer de retry n'est créé.

### AC-02 — Recovery PostgreSQL

Étant donné un PostgreSQL accessible en lecture seule, quand `pg-boss` tente de démarrer, alors :

- l'application ne quitte pas ;
- le worker n'est pas déclaré `READY` ;
- `/wall` affiche l'état indisponible ;
- une page épisode utilise le cache lisible si possible, sinon son fallback RSS.

### AC-03 — Page épisode sans DB

Étant donné une panne DB, quand un utilisateur ouvre un épisode RSS existant, alors :

- la réponse est 200 ;
- le titre, la description, la date, l'image et l'audio restent présents ;
- les liens génériques restent utilisables ;
- les statistiques sont absentes ;
- le message de contenu partiel est visible ;
- aucune exception DB ne remonte au client.

### AC-04 — Sale-wall indisponible

Étant donné une DB non inscriptible, quand un utilisateur ouvre `/wall`, alors :

- la réponse est 200 ;
- le message d'indisponibilité est visible ;
- « Aucun récit partagé » n'est pas affiché ;
- l'enregistrement et les votes ne sont pas proposés comme disponibles.

### AC-05 — Écritures refusées proprement

Étant donné une DB non inscriptible, quand un utilisateur crée un récit ou vote, alors :

- la réponse est 503 ;
- `Retry-After` est présent ;
- le code `SERVICE_TEMPORARILY_UNAVAILABLE` est retourné ;
- aucun upload S3 n'est démarré pour une création refusée avant traitement.

### AC-06 — Reconnexion singleton

Étant donné 20 requêtes épisode simultanées pendant une panne, alors :

- une seule tentative de démarrage est active ;
- une seule instance `PgBoss` peut devenir `READY` ;
- une seule intention par épisode est conservée ;
- aucune requête HTTP n'attend la reconnexion.

### AC-07 — Retour automatique

Étant donné une DB redevenue `READ_WRITE`, quand le prochain retry réussit, alors :

- le worker passe à `READY` sans redémarrage de l'application ;
- les intentions sont envoyées à `pg-boss` ;
- les clés singleton empêchent les doublons ;
- `/wall` retrouve son fonctionnement nominal ;
- `/health` annonce `mode: "normal"`.

### AC-08 — Arrêt pendant un retry

Étant donné un retry programmé, quand l'application reçoit `SIGTERM`, alors :

- le timer est annulé ;
- aucun worker ne redémarre ;
- les ressources actives sont fermées ;
- le processus s'arrête proprement.

---

## 14. Stratégie de tests

### Tests unitaires

- classification des états PostgreSQL ;
- singleton de la promesse de démarrage ;
- progression et remise à zéro du backoff ;
- absence de publication d'un `boss` partiellement initialisé ;
- déduplication, limite, expiration et drainage des intentions ;
- annulation des retries à l'arrêt ;
- contrat de retour de `queueEpisodeResolution()`.

### Tests de routes

- `/` et `/podcast` sans PostgreSQL ;
- page épisode avec DB nominale, read-only et inaccessible ;
- fallbacks SEO et image RSS sans cache DB ;
- `/wall` nominal et indisponible ;
- création et vote refusés en 503 ;
- vérification qu'aucun upload S3 n'est déclenché lors d'un refus précoce ;
- `/health` dans chaque combinaison d'états.

### Test d'intégration

Scénario recommandé avec un PostgreSQL contrôlable :

1. démarrer l'application avec PostgreSQL arrêté ;
2. vérifier que HTTP reste disponible ;
3. consulter plusieurs fois le même nouvel épisode ;
4. démarrer PostgreSQL ;
5. vérifier qu'un seul worker démarre ;
6. vérifier qu'un seul job logique est créé ;
7. vérifier que `episode_links` est ensuite alimenté ;
8. arrêter à nouveau PostgreSQL et confirmer le retour en mode dégradé sans sortie du process.

---

## 15. Déploiement progressif

### Lot 1 — Home disponible sans DB

**Statut : déployé et vérifié en production le 19 août 2026.**

- partir du comportement validé avec `ALLOW_DEGRADED_MODE=true` sans le considérer comme la solution finale ;
- rendre le démarrage HTTP tolérant par défaut à l'échec initial de `pg-boss` ;
- introduire les états et le singleton de reconnexion ;
- ne publier `boss` qu'après un démarrage complet ;
- sécuriser l'arrêt gracieux ;
- garantir `/`, `/podcast` et `/health` sans DB ;
- conserver provisoirement les autres comportements de routes existants ;
- valider l'absence de boucle de déploiement sur Clever Cloud.

### Lot 2 — Fallbacks produit

**Statut : implémenté et validé localement, prêt pour revue.**

- rendre la lecture DB des pages épisode optionnelle ;
- ajouter l'état de contenu partiel dans `podcast.hbs` ;
- ajouter l'état d'indisponibilité dans `index.hbs` ;
- ajouter les 503 fonctionnels sur les écritures.

### Lot 3 — Intentions et reprise

**Statut : implémenté et validé localement, prêt pour revue.**

- ajouter le buffer borné d'intentions ;
- drainer à la reconnexion ;
- valider la déduplication avec `singletonKey`.

### Lot 4 — Observabilité complète et validation de reprise

**Statut : code et simulation locale réelle terminés ; validation Clever Cloud à faire après merge et autorisation de déploiement.**

- enrichir `/health` ;
- ajouter les logs de transition ;
- déployer ;
- simuler une indisponibilité DB ;
- vérifier que Clever Cloud conserve l'instance HTTP en ligne ;
- vérifier le retour automatique sans restart.

---

## 16. Migration de configuration

- `DISABLE_WORKER=true` reste disponible pour les tests et les opérations explicitement sans worker.
- le Lot 1 déployé ne lit plus `ALLOW_DEGRADED_MODE` ; conserver temporairement la variable Clever ne sert qu'à une éventuelle restauration de l'ancienne version ;
- après la fenêtre de rollback, supprimer cette variable afin d'éviter une configuration trompeuse.
- aucune nouvelle dépendance d'infrastructure n'est requise.
- aucune migration SQL n'est nécessaire pour le périmètre minimal.

---

## 17. Risques et réponses

| Risque | Impact | Réponse |
|---|---|---|
| Plusieurs retries concurrents créent plusieurs workers | connexions et jobs dupliqués | promesse et timer singleton, tests de concurrence |
| Objet `boss` partiellement initialisé | erreurs lors de `send()` | publication atomique après démarrage complet |
| Intentions perdues après restart | épisode non enrichi jusqu'à la prochaine visite | comportement accepté ; nouvelle visite redétecte le manque |
| Buffer abusé par des URLs arbitraires | consommation mémoire | épisodes RSS validés uniquement, limite et TTL |
| Wall affiché vide pendant la panne | information produit trompeuse | état `wallUnavailable` dédié |
| Upload S3 orphelin | coût et incohérence | refus avant upload et compensation best effort |
| Healthcheck dépendant de la DB | nouvelle boucle de restart | liveness strictement HTTP |
| Base lisible mais non inscriptible mal classée | échec répété de `pg-boss` | état `READ_ONLY` et probe d'écriture adapté |

---

## 18. Définition de terminé

Le mode dégradé est terminé lorsque :

- tous les critères d'acceptation Must sont automatisés ;
- une panne PostgreSQL simulée ne fait plus quitter le processus ;
- les pages publiques autonomes restent accessibles ;
- le Sale-wall annonce correctement son indisponibilité ;
- les pages épisode restent écoutables avec contenu partiel ;
- `pg-boss` redémarre seul et sans doublon ;
- le retour au mode nominal ne demande ni action Clever Cloud ni redéploiement ;
- les journaux permettent de reconstruire la chronologie panne → retries → reprise ;
- la documentation ADR du smartlink est mise à jour pour remplacer la décision historique de fail-hard.

---

## 19. Bilan d'implémentation avant revue

Les Lots 2 à 4 ont été implémentés sur la PR de suivi du Lot 1. Cette
section distingue les preuves locales acquises de la validation de production,
qui reste volontairement à faire après merge.

### 19.1 Comportements livrés

- modèle PostgreSQL `unknown`, `unavailable`, `read_only`, `read_write`, avec
  probe de `pg_is_in_recovery()` et `transaction_read_only` ; une connexion
  refusée en `57P03` reste `unavailable`, tandis qu'un standby qui accepte les
  lectures est `read_only` ;
- page épisode 200 depuis le RSS sans DB, fallbacks génériques correctement
  libellés, statistiques masquées et cache HTTP raccourci en contenu partiel ;
- Sale-wall 200 avec un état indisponible distinct d'un wall vide, sans
  enregistrement, statistiques artificielles ni vote ;
- création et vote refusés avant traitement avec un contrat 503 stable et
  `Retry-After: 60` ; compensation S3 en best effort si la DB tombe après upload ;
- contrat explicite de mise en queue, instance `pg-boss` atomique et worker
  idempotent avant les appels externes coûteux ;
- buffer `Map` limité à 100 intentions, TTL d'une heure, payload RSS validé,
  déduplication et drainage à la reconnexion ;
- transitions DB, worker et mode journalisées ; taille du buffer ajoutée à
  `/health` sans information de connexion.

### 19.2 Validation automatisée

| Vérification | Résultat |
|---|---:|
| Migrations sur PostgreSQL 16 vide | 7/7 appliquées |
| Suite complète séquentielle | 115 tests réussis, 0 échec |
| Build PostCSS et vues | réussi |
| Probe sur PostgreSQL réel configuré en lecture seule | `read_only` |
| Tests ciblés du mode dégradé | états DB, 20 requêtes concurrentes, fallbacks, 503, compensation et arrêt couverts |
| Déduplication de reprise | 20 visites → 1 intention → 1 envoi |
| Idempotence du worker | cache complet → aucun appel externe coûteux |

Le runner Node.js 24.3 a produit deux erreurs IPC
`Unable to deserialize cloned data` lorsque les fichiers Fastify étaient lancés
en parallèle. Les mêmes tests étaient verts isolément ; le script `npm test`
exécute désormais les fichiers avec `--test-concurrency=1` et constitue la
commande de référence reproductible.

### 19.3 Validation PostgreSQL réelle dans un même processus

Le scénario complet a été exécuté avec un PostgreSQL 16 isolé, sans redémarrer
Node.js :

1. application démarrée avec PostgreSQL arrêté : worker
   `retry_scheduled`, DB `unavailable`, `/health` en mode `degraded` ;
2. `/`, `/podcast`, `/podcast/2/1` et `/wall` en 200 ; message partiel sur
   l'épisode et message indisponible sur le wall ;
3. création et vote en 503 avec `Retry-After: 60` ;
4. PostgreSQL remis en ligne sur la même adresse et migrations appliquées ;
5. retry réussi : DB `read_write`, worker `ready`, mode `normal`, zéro intention
   restante ;
6. contrôle en base : un job logique `resolve-episode` et une ligne
   `episode_links` pour l'intention créée pendant la panne ; le cas des vingt
   visites concurrentes est couvert séparément par le test automatisé ;
7. seconde coupure : erreur runtime PostgreSQL `57P01`, retour automatique à
   `unavailable` / `retry_scheduled`, `/wall` toujours en 200 dégradé ;
8. `SIGINT` pendant le retry : timer annulé, worker arrêté et pool fermé
   proprement.

### 19.4 Reste à valider après merge

- déployer les Lots 2 à 4 sur Clever Cloud avec une autorisation explicite ;
- vérifier le commit actif, le payload `/health` enrichi et les routes touchées ;
- lors d'une indisponibilité réelle ou d'une simulation autorisée, confirmer que
  Clever Cloud conserve l'instance HTTP et que le worker revient sans restart ;
- retirer ensuite `ALLOW_DEGRADED_MODE` de la configuration Clever, puisqu'il
  n'est plus lu par l'application.

### 19.5 Amendement OP3 — 20 août 2026

Le [PRD traction podcast et OP3](./prd_traction_podcast_op3.md) étend localement
le comportement de `/podcast` sans remettre en cause le contrat de disponibilité
ci-dessus :

- le fallback éditorial reste indépendant de PostgreSQL, du RSS, d'OP3 et de
  `pg-boss` ;
- si le flag public est actif et que l'état DB déjà connu est lisible, la route
  peut effectuer une lecture optionnelle et interceptée du cache OP3 ;
- la route ne déclenche aucun probe PostgreSQL, appel OP3 ou job ;
- toute erreur DB/RSS masque simplement l'encart dynamique et conserve la
  réponse 200 ;
- `op3-stats-refresh` réutilise le candidat et la boucle de retry `pg-boss`
  existants ; aucune seconde instance n'est créée.
