# PRD — Traction podcast et preuve sociale OP3

## Statut

- **Version** : 1.1
- **Date** : 20 août 2026
- **Statut** : implémenté et vérifié localement ; activation production bloquée
- **Périmètre** : `/podcast`, `/podcast/:season/:episode`, cache OP3 et worker `pg-boss`

## 1. Résumé produit

OP3 sert ici à montrer qu'un épisode a déjà attiré d'autres personnes. La feature
n'est ni un dashboard de statistiques ni une mesure du temps d'écoute.

Un téléchargement OP3 est un signal serveur filtré. Il peut résulter d'un
téléchargement automatique et ne prouve donc ni un démarrage de lecture ni une
écoute complète. Toute interface publique parle de **téléchargements mesurés par
OP3**, jamais d'écoutes garanties.

## 2. Faits vérifiés pendant le preflight

### 2.1 Dépôt, documentation et baseline

- La branche `codex/op3-podcast-traction` part de `origin/main` au commit
  `c821d9c` et le worktree était propre avant modification.
- `CLAUDE.md` est déjà supprimé. `AGENTS.md` est présent et
  `.github/copilot-instructions.md` renvoie vers cette source canonique.
- Node.js `24.3.0` respecte le minimum du projet.
- `pg-boss` réellement installé est en version `11.1.2` et expose
  `createQueue`, `work`, `send`, `schedule` et `unschedule`.
- Après installation des dépendances, la baseline comptait 93 tests réussis. Les
  12 échecs et 11 annulations restants dépendaient d'une base locale implicite ou
  d'identifiants/appels réels de plateformes. Ces tests ont été rendus opt-in et
  l'image distante des tests OG a été remplacée par un fixture local.
- `npm audit` signale une vulnérabilité haute préexistante dans
  `@fastify/static`. Elle ne provient pas d'OP3 et doit être traitée séparément
  pour ne pas mélanger les périmètres.

### 2.2 Implémentation existante

- `refreshOp3StatsCache()` est un stub.
- Le client OP3 mappe seulement `downloads30` et `downloadsAll`, remplace
  certaines valeurs absentes par zéro, et ne valide pas complètement la réponse.
- `op3StatsQueue.js` construit un second `PgBoss`, journalise l'URI de base et
  n'est pas relié au worker principal. Son test est commenté.
- Le boot HTTP tente un lookup OP3 et émet un avertissement si la configuration
  est absente.
- `/podcast` rend toujours l'état éditorial avec `episodeData: null`.
- La page épisode lit déjà le cache PostgreSQL sans appeler OP3 pendant le rendu,
  mais le wording parle d'« écoutes » et affirme à tort une certification IAB.
- La migration `007_op3_stats.sql` ne contient que `downloads_30` et
  `downloads_all`. La prochaine évolution est additive et numérotée `008`.

### 2.3 Production, en lecture seule le 20 août 2026

- `GET /podcast` répond 200.
- `GET /podcast/` et `GET /podcast/?season=2&episode=1` répondent 404.
- PostgreSQL n'est ni en recovery ni en lecture seule au moment du contrôle.
- La table `op3_stats` n'existe pas en production. Aucune migration n'a été
  lancée pendant ce preflight.
- Les noms de variables Clever ne contiennent ni `OP3_API_TOKEN`, ni `OP3_GUID`,
  ni `OP3_PUBLIC_STATS_ENABLED`.
- Aucune variable Clever n'a été créée ou modifiée.

### 2.4 Contrat OP3 officiel actuel

- `GET /queries/episode-download-counts` renvoie les épisodes récents et les
  champs `itemGuid`, `pubdate`, `downloads1`, `downloads3`, `downloads7`,
  `downloads30` et `downloadsAll`. Les robots sont exclus et la réponse est mise
  à jour quotidiennement.
- Les métriques `downloads1`, `downloads3`, `downloads7` et `downloads30` sont
  cumulées depuis la publication pendant les 1, 3, 7 ou 30 premiers jours. Elles
  ne sont pas des fenêtres glissantes et peuvent être absentes.
- `downloadsAll` est le cumul historique. Une métrique absente est une donnée
  insuffisante, pas un zéro.
- L'endpoint agrégé porte sur les épisodes récents et en renvoie actuellement
  huit par défaut. Un paramètre interne `limit` existe mais n'appartient pas au
  contrat OpenAPI public ; l'implémentation n'en dépend pas.
- `GET /downloads/show/:showUuid` accepte une fenêtre temporelle, exclut les bots
  par défaut et fournit une pagination avec `continuationToken` et une limite de
  20 000 lignes par page.
- OP3 indique lui-même qu'un téléchargement ne correspond pas nécessairement à
  une écoute.
- OP3 n'apparaît pas dans le registre courant des sociétés certifiées IAB Tech
  Lab et son dépôt présente encore la certification comme un objectif futur.

Sources officielles :

- <https://op3.dev/api/docs>
- <https://op3.dev/download-calculation>
- <https://github.com/skymethod/op3/blob/master/worker/routes/api_shared.ts>
- <https://github.com/skymethod/op3/blob/master/worker/routes/api_docs_swagger.ts>
- <https://iabtechlab.com/compliance-programs/compliant-companies/#podcast>

### 2.5 Incident potentiel de secrets

- ADR-0015 contient un token OP3 littéral.
- ADR-0011 contient un secret client Spotify littéral.
- Un script exploratoire journalise un préfixe du token OP3.
- L'ancienne queue OP3 journalise l'URI PostgreSQL complète.

Ces valeurs sont retirées du dépôt courant sans réécriture d'historique. La
révocation/rotation OP3 et Spotify reste un gate obligatoire avant activation ou
prochain déploiement exposant ces intégrations.

## 3. Objectifs

1. Faire de `/podcast` une entrée vivante vers un épisode populaire lorsqu'un
   signal fiable existe.
2. Conserver l'état éditorial actuel sans dépendance PostgreSQL, RSS ou OP3.
3. Afficher une preuve sociale exacte et accessible sur les pages épisode.
4. Alimenter un cache local quotidien sans appel OP3 dans les routes HTTP.
5. Réutiliser l'unique cycle de vie `pg-boss`, y compris ses retries et son arrêt.
6. Préparer une activation progressive, réversible par un seul flag public.

## 4. Hors périmètre

- dashboard créateur ou administrateur ;
- analytics individuels, temps d'écoute ou tracking propriétaire ;
- statistiques Spotify, Apple ou Deezer ;
- personnalisation par visiteur ;
- liste exhaustive d'épisodes sur `/podcast` ;
- nouvelle dépendance applicative ;
- déploiement, migration ou modification de variables Clever.

## 5. Expérience `/podcast`

### 5.1 État éditorial

L'état proche de « Le podcast est sorti » reste rendu immédiatement si :

- le flag public n'est pas activé ;
- le nombre d'épisodes publiés exploitables est inférieur à trois ;
- la base n'est pas déjà connue comme lisible ;
- le cache est absent, insuffisant ou trop ancien ;
- la lecture PostgreSQL échoue ;
- le RSS échoue ou ne permet pas d'associer épisodes et statistiques.

Ce fallback ne lance aucun probe PostgreSQL, aucun appel OP3 et aucun job.

### 5.2 Populaire sur les sept derniers jours

Le libellé public est « Le plus populaire cette semaine » lorsque :

- au moins trois épisodes publiés sont disponibles ;
- le snapshot est récent ;
- une vraie fenêtre glissante de sept jours comporte au moins dix
  téléchargements pour un épisode.

La colonne locale `downloads_7` contient cette fenêtre glissante calculée depuis
`/downloads/show/:showUuid`. Elle ne contient pas le champ OP3 homonyme
`downloads7`, qui représente les sept premiers jours après publication.

### 5.3 Fallback historique

Sans signal hebdomadaire atteignant dix, l'épisode publié ayant le plus grand
`downloads_all` est affiché sous « L'épisode le plus populaire », si le seuil de
dix est atteint et si le snapshot reste utilisable pour l'historique.

En cas d'égalité, l'épisode publié le plus récemment est sélectionné.

### 5.4 Contenu de l'encart

L'encart affiche, si disponibles dans le RSS : image, saison et numéro, titre,
extrait court, durée, compteur de téléchargements et CTA vers
`/podcast/:season/:episode`.

## 6. Expérience page épisode

- Utiliser `downloads_all` pour une preuve sociale stable.
- Masquer le badge sous dix téléchargements.
- Afficher « N téléchargements mesurés par OP3 ».
- Fournir une explication visible au focus clavier et aux technologies
  d'assistance : OP3 mesure des téléchargements, pas nécessairement des écoutes.
- Ne faire aucune affirmation de certification IAB.
- Ne jamais appeler OP3 ni créer un job OP3 pendant le rendu.
- Respecter le flag `OP3_PUBLIC_STATS_ENABLED` pour toute exposition publique.

## 7. URL canonique

- `/podcast` reste la route canonique et répond 200.
- `/podcast/` répond 301 vers `/podcast`.
- Les paramètres sont préservés pendant la canonicalisation.
- `/podcast/?season=2&episode=1` aboutit directement au comportement de
  compatibilité `/podcast/2/1`.
- Aucune option globale de routage Fastify n'est activée.

## 8. Fraîcheur

Politique locale :

- **récent** : `fetched_at` a au plus 36 heures ; hebdomadaire et historique
  sont utilisables ;
- **légèrement ancien** : plus de 36 heures et au plus 7 jours ; seul
  l'historique est utilisable ; le prochain passage worker rafraîchira le cache ;
- **trop ancien** : plus de 7 jours ; aucune preuve sociale n'est affichée.

Le manque de nouveaux téléchargements OP3 ne permet pas d'inférer la date de
fabrication de la réponse. `fetched_at` est donc le timestamp local d'une réponse
complète, validée et écrite avec succès.

## 9. Architecture retenue

### 9.1 Cache PostgreSQL

Schéma logique minimal :

- `item_guid` ;
- `downloads_7` : fenêtre glissante locale de sept jours ;
- `downloads_30` : fenêtre glissante locale de trente jours ;
- `downloads_all` : valeur historique OP3 ;
- `fetched_at`.

La migration `008` ajoute `downloads_7` et rend explicite la sémantique glissante
de `downloads_30`, sans détruire les lignes existantes.

### 9.2 Rafraîchissement OP3

Le job quotidien :

1. vérifie que la DB est `read_write` et que `OP3_API_TOKEN`/`OP3_GUID` sont
   complets ;
2. résout le `showUuid` en mémoire sans logger le token ;
3. charge les statistiques historiques des épisodes récents ;
4. charge la correspondance des identifiants d'épisode ;
5. parcourt les téléchargements des trente derniers jours avec pagination et
   calcule les fenêtres 7/30 jours ;
6. valide les GUID, identifiants, dates et entiers non négatifs ;
7. écrit toutes les lignes valides dans une transaction.

Une réponse invalide ou un échec OP3 provoque zéro écriture. Le dernier snapshot
et son `fetched_at` restent inchangés. Le token est transmis seulement dans
l'en-tête `Authorization`.

### 9.3 Worker unique

La queue `op3-stats-refresh` est créée et consommée par le même candidat
`PgBoss` que `resolve-episode`, avant publication du singleton. Un schedule cron
quotidien identifié par une clé stable assure la déduplication. Aucun second
`PgBoss` et aucune seconde boucle de retry ne sont autorisés.

L'absence de configuration OP3 est l'état silencieux `disabled` : ni schedule,
ni appel réseau, ni avertissement répétitif.

### 9.4 Rendu HTTP

- Les routes lisent uniquement PostgreSQL.
- `/podcast` consulte l'état DB déjà connu ; il ne lance pas de probe.
- Toute erreur de lecture est interceptée et revient au fallback éditorial.
- Une panne RSS revient au fallback éditorial.
- Aucun rendu n'appelle OP3, ne programme un schedule ou ne multiplie des jobs.

## 10. Activation progressive

Ordre de rollout futur, hors de cette livraison :

1. révoquer et remplacer les secrets OP3 et Spotify exposés historiquement ;
2. appliquer les migrations autorisées et vérifier le rollback ;
3. configurer `OP3_API_TOKEN` et `OP3_GUID`, flag public absent ou faux ;
4. laisser le worker remplir le cache ;
5. inspecter en lecture seule fraîcheur, association GUID et volumes ;
6. activer `OP3_PUBLIC_STATS_ENABLED=true` ;
7. vérifier `/podcast`, une page épisode et `/health`.

Rollback public : remettre uniquement `OP3_PUBLIC_STATS_ENABLED=false`. Ne pas
supprimer la table ni les données dans l'urgence.

## 11. Sécurité et accessibilité

- aucun token, préfixe de token ou URI PostgreSQL complète dans les logs ;
- erreurs publiques sans détail d'infrastructure ;
- requêtes SQL paramétrées ;
- transaction tout-ou-rien pour le refresh ;
- aucune écriture en `read_only`, recovery ou DB indisponible ;
- liens CTA internes et contenus RSS échappés par Handlebars ;
- explication OP3 accessible au clavier, sans dépendre uniquement du survol ;
- image avec texte alternatif utile ;
- wording honnête sur les téléchargements.

## 12. Plan TDD et critères d'acceptation

Les cycles RED/GREEN couvrent :

1. slash canonique et anciennes query URLs ;
2. sélection hebdomadaire, fallback historique, égalité et seuil ;
3. fraîcheur récente/légèrement ancienne/trop ancienne ;
4. encart `/podcast` et fallbacks DB/RSS ;
5. absence d'appel OP3 ou de job pendant le rendu ;
6. mapping et écriture `downloads_7`, `downloads_30`, `downloads_all` ;
7. conservation du cache sur échec ou réponse invalide ;
8. refus d'écriture read-only ;
9. singleton PgBoss, schedule quotidien, retry et arrêt gracieux ;
10. absence de secrets dans les logs ;
11. wording téléchargement et accessibilité.

La livraison est prête lorsque les tests ciblés, `npm test`, `npm run build` et
`git diff --check` ont été exécutés et que tout échec restant est explicitement
attribué à l'environnement ou à une dette préexistante.

## 13. Résultats de livraison

### 13.1 Cycles RED/GREEN observés

Les nouveaux tests ont d'abord échoué sur les seams ou comportements absents,
puis sont passés après chaque implémentation : canonicalisation du slash,
sélection populaire, parsing RSS complet, refresh transactionnel, pagination,
queue OP3 sur singleton, rendu/fallbacks et wording accessible.

### 13.2 Vérifications locales

| Vérification | Résultat |
|---|---|
| Tests OP3, RSS, routes podcast, worker et mode dégradé | réussis |
| `npm test` | 110 réussis, 0 échec, 12 intégrations externes opt-in ignorées |
| `npm run build` | réussi ; CSS Tailwind recompilé |
| `git diff --check` | réussi |
| Syntaxe des fichiers serveur/services/queues/scripts OP3 | valide |
| PostgreSQL 16, migrations sur base vide | 8/8 appliquées |
| Évolution 007 → 008 avec ligne existante | données préservées, nouvelle colonne nullable |
| Réapplication de 008 | réussie, colonne existante ignorée |

Le conteneur PostgreSQL temporaire sans volume persistant a été arrêté et
supprimé après ces contrôles. Aucun accès d'écriture production n'a eu lieu.

### 13.3 Gates avant production

- révoquer/rotater les secrets OP3 et Spotify historiquement exposés ;
- faire autoriser et appliquer les migrations Clever ;
- créer `OP3_API_TOKEN` et `OP3_GUID` sans activer le flag public ;
- laisser le singleton worker remplir le cache puis l'inspecter en lecture seule ;
- activer ensuite `OP3_PUBLIC_STATS_ENABLED=true` après validation humaine ;
- exécuter les smoke tests de rollout et conserver le rollback par flag.

La PR ne déploie pas, ne merge pas et ne modifie aucune variable Clever.
