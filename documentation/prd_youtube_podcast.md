# PRD — Disponibilité vidéo sur les pages podcast

**Version :** 1.2
**Date :** 2026-09-04  
**Statut :** implémenté et validé localement, activation production à réaliser

## Problème

Le podcast dispose d'épisodes vidéo distribués depuis l'hébergeur en MP4 et HLS,
sur Spotify en HD et sur YouTube. Les pages podcast doivent rendre cette
disponibilité visible sans ajouter un encart qui concurrence le contenu principal.

## Expérience attendue

- `/podcast` affiche une petite pastille « Vidéo » suivie des plateformes
  disponibles, dans la continuité des métadonnées existantes.
- L'interface ne crée pas de nouvel encart de disponibilité.
- `/podcast/:season/:episode` ouvre la vidéo précise si elle a été résolue.
- Une page épisode annonce la vidéo lorsque son RSS contient un
  `podcast:alternateEnclosure` MP4 ou HLS valide, ou lorsqu'un lien YouTube
  direct a été résolu.
- Elle ne nomme que les destinations vidéo vérifiables pour cet épisode : site
  officiel, Apple Podcasts avec HLS et lien direct, Spotify (HD) avec lien
  direct, et YouTube avec lien direct.
- La carte Spotify affiche une micro-pastille « Vidéo HD » pour l'épisode
  concerné.
- Tant que la vidéo n'est pas résolue, la même carte ouvre la chaîne et indique
  que son référencement est en cours lorsque l'API est active.
- L'absence de PostgreSQL, de `pg-boss` ou de configuration YouTube ne doit pas
  empêcher le rendu des pages garanti par le mode dégradé existant.

## Contrats éditoriaux

### Flux RSS vidéo

L'épisode filmé contient un ou deux `podcast:alternateEnclosure` du namespace
Podcasting 2.0 : un MP4 et un manifeste HLS. Chaque enclosure doit contenir au
moins un `podcast:source` HTTP(S) valide. Les URLs de médias ne sont ni rendues
ni journalisées par l'application ; seules les capacités MP4/HLS sont exposées
au template.

Apple Podcasts consomme le HLS publié dans le flux. Dans ce podcast, la présence
d'une enclosure vidéo et d'un lien Spotify direct constitue le contrat métier
indiquant que l'épisode correspondant est aussi disponible en HD sur Spotify.

Références : [Podcast Namespace — alternate enclosure](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md#alternate-enclosure) et
[Apple Podcasts — publier une vidéo](https://podcasters.apple.com/support/5593-how-to-publish-video).

### Association YouTube

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

1. La lecture du RSS détecte les enclosures alternatives `video/mp4` et HLS.
2. Une visite de page épisode lit `episode_links.youtube_url` avec les autres
   liens de plateformes.
3. Si YouTube est configuré et le lien manque, l'intention rejoint le job
   `resolve-episode` déjà utilisé par `pg-boss`.
4. Le worker appelle `playlistItems.list` sur la playlist d'uploads, 50 vidéos
   par page, et cherche l'URL canonique dans `snippet.description`.
5. Le `videoId` validé devient `https://www.youtube.com/watch?v={videoId}` et est
   conservé dans `episode_links.youtube_url`.
6. Une visite suivante reçoit le lien vidéo direct. Le cache HTTP reste court
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
- Les enclosures sans type reconnu ou sans source HTTP(S) sont ignorées.
- Les pastilles sont du texte HTML normal et ne remplacent pas le nom accessible
  des liens de plateformes.

## Critères d'acceptation

- La page générale affiche une métadonnée vidéo compacte et aucun encart dédié.
- MP4 et HLS sont détectés depuis `podcast:alternateEnclosure`; les enclosures
  audio et les sources non HTTP(S) ne déclenchent rien.
- Une page épisode vidéo indique discrètement le site officiel, Apple Podcasts,
  Spotify (HD) et YouTube lorsque les conditions de chaque destination sont
  remplies.
- Un épisode uniquement disponible sur YouTube reste identifié comme vidéo.
- Un épisode RSS vidéo reste identifié comme tel pendant la résolution YouTube.
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

Extension d'interface 1.1 :

- 13 tests ciblés des routes podcast, YouTube et mode dégradé passent.
- `npm test` exécute 141 tests : 128 passent, 12 intégrations externes sont
  ignorées et le test mémoire Jimp fluctuant échoue à 58,83 Mo de croissance.
  Les deux tests mémoire passent isolément avec GC explicite.
- `npm run build` réussit. Le CSS généré par Tailwind 4.1.11 n'est pas conservé,
  car l'artefact du dépôt vient de Tailwind 4.3.3 et toutes les classes utilisées
  par le nouveau récapitulatif y sont déjà présentes.
- `/podcast` et `/podcast/3/1` avec une vidéo résolue ont été contrôlés dans le
  navigateur local : hiérarchie accessible, libellés visibles et aucune erreur
  console.

Extension d'interface 1.2 :

- les 13 tests ciblés du parseur RSS et de l'affichage de disponibilité passent ;
  ils couvrent MP4, HLS, les sources invalides, les liens directs et le fallback
  YouTube ;
- `npm run build` réussit. Le CSS régénéré par Tailwind 4.1.11 n'est pas conservé
  car l'artefact versionné vient de Tailwind 4.3.3 ; le rendu final utilise
  uniquement des classes déjà présentes dans cet artefact ;
- la suite complète exécute 143 tests : 108 passent, 12 intégrations sont
  ignorées et 23 échouent hors du changement. Vingt-deux anciens tests dépendent
  des épisodes du flux RSS public, qui répond actuellement HTTP 500 ; le test
  mémoire Jimp fluctue à 58,93 Mo, puis ses deux cas passent isolément avec une
  croissance mesurée de -0,30 Mo et -0,05 Mo ;
- `/podcast` et `/podcast/3/1` ont été contrôlés visuellement via l'aperçu
  Tailscale : aucun encart dédié, une métadonnée vidéo compacte et une
  micro-pastille « Vidéo HD » sur le lien Spotify.

À ce stade, aucun changement de production, de variable Clever Cloud ou de base
de données distante n'a été fait.
