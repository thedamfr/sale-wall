# ADR-0015 — Preuve sociale podcast via un cache OP3

## Statut

- **Date initiale** : 18 novembre 2025
- **Révision** : 20 août 2026
- **Statut** : implémenté, non activé en production
- **Décideur** : @thedamfr
- **PRD** : [`../prd_traction_podcast_op3.md`](../prd_traction_podcast_op3.md)

## Contexte

Le besoin produit est de montrer une traction réelle sur les pages épisode et de
faire de `/podcast` une entrée vers un épisode populaire. Il ne s'agit pas de
construire un dashboard d'analytics.

L'exploration de 2025 avait validé l'API OP3 mais laissé une architecture
incomplète : lookup au boot HTTP, queue indépendante, cache partiel et wording
« écoutes ». Elle contenait aussi un token littéral qui a été retiré de la version
courante. Son retrait ne purge pas l'historique Git ; sa révocation reste requise.

## Faits de contrat vérifiés

L'endpoint officiel `episode-download-counts` fournit `downloads1`,
`downloads3`, `downloads7`, `downloads30` et `downloadsAll` pour les épisodes
récents. Les quatre premières métriques sont cumulées pendant les premiers
1/3/7/30 jours suivant la publication. Elles ne décrivent pas les derniers
1/3/7/30 jours.

En particulier, `downloads7` ne peut pas alimenter honnêtement le libellé « Le
plus populaire cette semaine ». Une vraie fenêtre glissante est calculée depuis
`downloads/show/:showUuid` en arrière-plan.

OP3 décrit ses valeurs comme des téléchargements filtrés. Un téléchargement peut
être automatique et n'est pas une preuve d'écoute complète. OP3 n'est pas listé
comme certifié dans le registre IAB Tech Lab actuel.

Sources :

- <https://op3.dev/api/docs>
- <https://op3.dev/download-calculation>
- <https://github.com/skymethod/op3/blob/master/worker/routes/api_shared.ts>
- <https://iabtechlab.com/compliance-programs/compliant-companies/#podcast>

## Décision

### 1. Rendu fondé uniquement sur le cache

Les routes HTTP n'appellent jamais OP3. Elles peuvent lire le cache PostgreSQL si
la base est déjà connue comme lisible. Une erreur revient au contenu éditorial ou
masque le badge sans dégrader la réponse HTTP.

`/podcast` ne lance pas de probe PostgreSQL. Le fallback « Le podcast est sorti »
reste indépendant de la base, de `pg-boss`, du RSS et d'OP3.

### 2. Cache

Le cache stocke :

- `item_guid` ;
- `downloads_7`, fenêtre glissante de sept jours calculée localement ;
- `downloads_30`, fenêtre glissante de trente jours calculée localement ;
- `downloads_all`, cumul OP3 ;
- `fetched_at`, date d'une écriture complète réussie.

La migration `008` étend la table créée par `007` sans supprimer de données.

### 3. Rafraîchissement transactionnel

Un job quotidien charge les métriques OP3, suit la pagination de la fenêtre
trente jours, valide les identifiants et les entiers non négatifs, puis effectue
les upserts dans une transaction.

Si la DB n'est pas `read_write`, aucune écriture n'est tentée. Si OP3 échoue ou
si une réponse est invalide, aucune ligne n'est écrite et `fetched_at` n'avance
pas. Les champs absents ne sont jamais transformés en zéros.

Le bearer token reste dans l'en-tête `Authorization`, jamais dans l'URL ni les
logs.

### 4. Singleton `pg-boss`

La queue `op3-stats-refresh`, son worker et son schedule cron sont enregistrés
sur le même candidat `PgBoss` que `resolve-episode`, avant publication du
singleton. La clé de schedule est stable et évite les doublons.

Il n'existe ni second `PgBoss`, ni seconde boucle de connexion, ni déclenchement
de job depuis une requête HTTP.

L'absence de `OP3_API_TOKEN` ou `OP3_GUID` désactive silencieusement le refresh.

### 5. Exposition progressive

`OP3_PUBLIC_STATS_ENABLED=true` contrôle seulement l'affichage public. Le cache
peut être rempli et inspecté avant activation. Un seul flag public suffit.

La rotation des secrets OP3 et Spotify exposés dans l'historique Git est un gate
obligatoire avant activation production. Ce gate a été confirmé satisfait le
20 août 2026 dans le PRD, sans consigner les nouvelles valeurs.

### 6. Sélection et fraîcheur

- moins de trois épisodes publiés : fallback éditorial ;
- snapshot d'au plus 36 heures : meilleur `downloads_7` si au moins 10 ;
- sinon meilleur `downloads_all` si au moins 10 ;
- snapshot de plus de 36 heures et d'au plus 7 jours : historique seulement ;
- snapshot de plus de 7 jours : aucune preuve sociale ;
- égalité : publication la plus récente.

## Conséquences

### Positives

- aucun impact OP3 sur la latence ou la disponibilité HTTP ;
- dernier snapshot valable conservé pendant une panne ;
- wording public conforme à la nature de la métrique ;
- activation et rollback indépendants du remplissage du cache ;
- cycle de vie et observabilité du worker déjà éprouvés réutilisés.

### Coûts

- le calcul hebdomadaire exact nécessite l'endpoint de téléchargements paginé en
  plus de l'agrégat historique ;
- la correspondance entre identifiants d'épisode OP3 est validée avant écriture ;
- l'encart ne peut porter que sur les épisodes récents exposés par le contrat
  agrégé OP3.

## Alternatives rejetées

### Utiliser directement `downloads7`

Rejeté : ce champ mesure les sept premiers jours après publication, pas les sept
derniers jours calendaires.

### Appeler OP3 pendant le rendu

Rejeté : ajoute latence, indisponibilité externe et risque de rafale.

### Créer une queue OP3 séparée

Rejeté : double le cycle de vie `pg-boss` et viole les invariants de singleton et
de retry du projet.

### Présenter des « écoutes » ou une certification IAB

Rejeté : le téléchargement ne garantit pas l'écoute et la certification actuelle
n'est pas établie par une source officielle.

## Rollback

Le rollback public consiste à désactiver `OP3_PUBLIC_STATS_ENABLED`. Le worker et
la table peuvent rester en place. Ne pas supprimer la table ou les colonnes dans
l'urgence ; un rollback SQL éventuel doit être planifié séparément après sauvegarde.
