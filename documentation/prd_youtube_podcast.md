# PRD — Épisodes vidéo YouTube sur les pages podcast

**Version :** 1.0  
**Date :** 2026-09-04  
**Statut :** implémenté et validé localement, activation production à réaliser

## Problème

Le podcast dispose désormais d'une chaîne YouTube et d'épisodes vidéo. La page
générale doit rendre la chaîne visible. Une page épisode doit ouvrir la vidéo
correspondante sans imposer une association manuelle fragile dans le code.

## Expérience attendue

- `/podcast` affiche une carte YouTube vers la chaîne publique.
- `/podcast/:season/:episode` ouvre la vidéo précise si elle a été résolue.
- Tant que la vidéo n'est pas résolue, la même carte ouvre la chaîne et indique
  que son référencement est en cours lorsque l'API est active.
- L'absence de PostgreSQL, de `pg-boss` ou de configuration YouTube ne doit pas
  empêcher le rendu des pages garanti par le mode dégradé existant.

## Contrat éditorial

Chaque description YouTube contient l'URL canonique exacte de l'épisode :

```text
https://saletesincere.fr/podcast/{saison}/{episode}
```

Exemple pour S3E1 :

```text
https://saletesincere.fr/podcast/3/1
```

Le titre et la date de publication ne sont pas utilisés pour l'association. Un
lien vers `/podcast/3/10` ne correspond donc pas à `/podcast/3/1`.

## Fonctionnement

1. Une visite de page épisode lit `episode_links.youtube_url` avec les autres
   liens de plateformes.
2. Si YouTube est configuré et le lien manque, l'intention rejoint le job
   `resolve-episode` déjà utilisé par `pg-boss`.
3. Le worker appelle `playlistItems.list` sur la playlist d'uploads, 50 vidéos
   par page, et cherche l'URL canonique dans `snippet.description`.
4. Le `videoId` validé devient `https://www.youtube.com/watch?v={videoId}` et est
   conservé dans `episode_links.youtube_url`.
5. Une visite suivante reçoit le lien vidéo direct. Le cache HTTP reste court
   tant que ce lien manque lorsque la résolution est activée.

La méthode `playlistItems.list` expose la description, `resourceId.videoId` et
la pagination avec un coût annoncé de 1 unité par appel. Référence :
[YouTube Data API — PlaylistItems.list](https://developers.google.com/youtube/v3/docs/playlistItems/list).
La playlist d'uploads est la playlist `contentDetails.relatedPlaylists.uploads`
d'une chaîne : [YouTube Data API — Channels](https://developers.google.com/youtube/v3/docs/channels).

## Configuration

```text
YOUTUBE_CHANNEL_URL=https://www.youtube.com/@nom_de_la_chaine
YOUTUBE_UPLOADS_PLAYLIST_ID=UU...
YOUTUBE_API_KEY=<secret>
```

- `YOUTUBE_CHANNEL_URL` est public et suffit pour afficher la carte de chaîne.
- La résolution des épisodes n'est active que si la playlist et la clé API sont
  toutes les deux présentes.
- La clé reste côté serveur, n'est jamais transmise au navigateur et ne doit pas
  être copiée dans les logs ou la documentation.

## Données et retour arrière

La migration `sql/009_add_youtube_episode_url.sql` ajoute uniquement la colonne
nullable `youtube_url`. Elle préserve les lignes existantes. Le retour arrière
consiste à retirer les trois variables YouTube, puis éventuellement à supprimer
la colonne ; cette dernière opération perd les liens déjà résolus.

## Sécurité, résilience et accessibilité

- Les données YouTube sont lues par HTTPS depuis l'API officielle.
- Les identifiants vidéo sont limités aux 11 caractères autorisés avant de
  construire le lien public.
- Chaque requête est bornée à 5 secondes et le parcours à 20 pages ; les jetons
  de pagination répétés sont arrêtés.
- Une erreur API rend `null` et laisse le lien de chaîne utilisable.
- La carte est un lien clavier standard, ouvert dans un nouvel onglet avec
  `noopener noreferrer`, et son libellé texte expose explicitement YouTube.

## Critères d'acceptation

- La page générale affiche la chaîne lorsque son URL est configurée.
- Une vidéo contenant le bon lien canonique est résolue, y compris après
  pagination.
- Les titres similaires, les autres numéros d'épisode, les réponses en erreur et
  les identifiants vidéo invalides ne créent aucun lien.
- YouTube ne rend pas le cache incomplet lorsque l'intégration API est désactivée.
- Une fois activé, un lien YouTube manquant garde le cache HTTP à 60 secondes et
  provoque une nouvelle intention de résolution selon la déduplication existante.

## Activation production à réaliser

1. Vérifier que la description de la première vidéo contient son URL canonique.
2. Créer une clé YouTube Data API v3 restreinte à cette API et aux IP possibles
   de l'hébergement lorsque cette restriction est compatible avec Clever Cloud.
3. Appliquer la migration 009.
4. Configurer les trois variables sans révéler la clé.
5. Déployer, ouvrir la page épisode, attendre le worker, puis vérifier en lecture
   seule `youtube_url` et le lien public.

## Vérifications du 2026-09-04

- `npm test` : un passage complet réussi avec 137 tests, 125 réussis et 12
  intégrations externes ignorées par configuration. Une relance a exposé le test
  mémoire Jimp fluctuant (63,45 Mo pour un seuil de 60 Mo) sans toucher au code
  d'image ; isolé avec GC explicite, il passe avec une croissance négative. Les
  30 tests ciblant les plateformes, les routes YouTube et le cycle de vie du
  worker passent tous (18 réussis, 12 intégrations externes ignorées).
- `npm run build` : réussi. Le CSS généré localement par Tailwind 4.1.11 n'a pas
  été conservé car le dépôt contient un artefact produit par une autre version et
  la carte réutilise uniquement des classes déjà présentes.
- migrations 005, 006 puis 009 : exécutées avec succès sur un PostgreSQL 14
  éphémère ; `episode_links.youtube_url` est nullable et de type `text`.
- la playlist et l'API YouTube réelles ont résolu S3E2 vers sa vidéo publique ;
  le worker local a ensuite conservé ce lien en base et la page l'a rendu comme
  destination de la carte YouTube.
- le pictogramme YouTube dédié a été contrôlé visuellement sur la page locale et
  conserve un libellé décoratif vide puisque le nom de la plateforme est adjacent.
- `git diff --check` : réussi.

À ce stade, aucun changement de production, de variable Clever Cloud ou de base
de données distante n'a été fait.
