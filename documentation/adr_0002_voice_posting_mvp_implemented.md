# ADR 0002 — Feature : Création de post vocal (MVP) ✅ IMPLÉMENTÉ

## Contexte

Saleté Sincère doit permettre aux utilisateur•rices de publier une anecdote vocale (max 3 minutes) avec une transcription obligatoire pour l'accessibilité. Le MVP vise à lancer cette fonctionnalité rapidement, sans lourde intégration ASR, tout en offrant une expérience fluide et conforme à la charte.

## Statut : ✅ TERMINÉ

**Date d'implémentation** : 11 juillet 2025  
**Version** : MVP 1.0  
**Fonctionnalités livrées** : Enregistrement vocal, transcription manuelle, upload local, système de votes

## Décision

Nous avons implémenté un **flow simplifié** pour le prototype :
1. **Enregistrement audio** (MediaRecorder) et saisie d'un **titre**.
2. **Transcription manuelle** obligatoire (textarea) pour garantir une base fiable.
3. **Envoi** du blob audio, du titre et du texte au serveur pour stockage local et modération ultérieure.

La transcription ASR sera déplacée en phase 2, côté serveur, pour alimenter la modération automatique.

## Alternatives considérées

| Option                               | Avantages                                 | Inconvénients                         |
|--------------------------------------|-------------------------------------------|---------------------------------------|
| **ASR full (Whisper-Base)**          | Transcription automatique & rapide        | Modèle lourd (+600 Mo), latence élevée|
| **ASR in-browser (Tiny/Small)**      | Option rapide, client-side                | Qualité FR médiocre, déceptif         |
| **Manuel uniquement (MVP)** ✅       | Pas de dépendance, meilleure qualité finale| Friction de saisie, risque d'abandon  |
| **API cloud ASR**                    | Qualité top, faible latence               | Dépendance réseau & coût              |

## Implémentation réalisée

### 1. ✅ Formulaire inline dans le hero (`views/index.pug`)  
- Formulaire qui se déplie au clic sur "+ Enregistrer votre histoire"
- Conteneur collapse/expand avec :
  - Bouton Enregistrer / Arrêter avec feedback visuel et timer
  - Champ `input` pour le **titre** (obligatoire)
  - Aperçu audio (`<audio>`) avec contrôles
  - Textarea pour la **transcription** obligatoire
  - Sélecteur de badge (Wafer/Charbon) avec feedback visuel
  - Bouton d'envoi avec états disabled/enabled
  - Bouton d'annulation

### 2. ✅ Vanilla JS (`public/js/record.js`)
- Classe `VoiceRecorder` complète avec :
  - Gestion MediaRecorder (start/stop/dataavailable)
  - Timer d'enregistrement avec limite 3 minutes
  - Validation de formulaire en temps réel
  - Génération de Blob audio et preview
  - Upload via FormData multipart
  - Système de notifications (toast)
  - Gestion des erreurs et permissions micro

### 3. ✅ Route API (`POST /api/posts`)
- Fastify + `@fastify/multipart` pour lire :
  - `audio` (file WebM/Opus), `title` (string), `transcription` (string), `badge` (Wafer/Charbon)
- Validation complète des données
- Sauvegarde fichier audio dans `/uploads/` avec nom unique
- Enregistrement en base PostgreSQL avec UUID et timestamps

### 4. ✅ Système de votes (`POST /api/posts/:id/vote`)
- Vote par IP (voter_hash) avec contrainte unique
- Prévention du double vote
- Mise à jour des compteurs en temps réel
- Feedback visuel côté client

### 5. ✅ Base de données PostgreSQL
- Tables `posts` et `votes` avec UUID
- Indexes pour performance
- Triggers pour `updated_at`
- Données de test intégrées

### 6. ✅ UX/UI conforme à la charte
- Couleurs respectées (noir-charbon, or-kintsugi, ivoire-sale)
- Formulaire avec fond semi-transparent et bordures dorées
- Boutons avec états visuels clairs
- Responsive design
- Micro-interactions (hover, scale, pulse)

## Conséquences

+ **✅ Simple à développer** : MVP livré rapidement sans complexité ASR
+ **✅ UX maîtrisée** : L'utilisateur contrôle entièrement la transcription
+ **✅ Extensible** : Architecture prête pour ASR en phase 2
+ **✅ Accessibilité** : Transcription validée, compatible screen-readers
+ **✅ Performance** : Aucune latence de traitement, upload immédiat
+ **✅ Robuste** : Validation côté client et serveur, gestion d'erreurs complète

## Métriques de succès

- **Temps d'implémentation** : ~2 jours (estimation respectée)
- **Taux de conversion** : À mesurer (formulaire → post publié)
- **Qualité transcription** : 100% (manuelle)
- **Compatibilité navigateur** : Chrome, Firefox, Safari (MediaRecorder supporté)
- **Taille fichiers** : ~100kb pour 60s d'audio (WebM/Opus)

## Évolutions futures (Phase 2)

- [ ] Intégration S3 pour stockage en production
- [ ] Whisper-Base ou wav2vec2-french en option serveur
- [ ] Transcription streaming/chunking pour longs formats
- [ ] Modération automatique avec IA
- [ ] Analytics et métriques d'usage
- [ ] Export en Web Component réutilisable
- [ ] Tests automatisés (Jest + Playwright)

## Retour d'expérience

### Ce qui a bien fonctionné
- MediaRecorder API : Excellent support navigateur
- Tailwind CSS v4 : Compilation rapide et classes utilitaires
- Pug + Fastify : SSR simple et performant
- PostgreSQL : Robuste avec UUID et contraintes

### Points d'amélioration
- Rebuild CSS manuel parfois nécessaire
- Gestion des permissions micro à améliorer
- Feedback utilisateur à enrichir (progress, success states)

### Leçons apprises
- La transcription manuelle est acceptable en MVP
- L'UX du formulaire inline est plus fluide qu'une page dédiée
- La validation temps réel améliore significativement l'expérience
- Les classes CSS custom sont parfois plus simples que les utilitaires Tailwind complexes
