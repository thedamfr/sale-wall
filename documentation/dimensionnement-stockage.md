# Dimensionnement et réduction du stockage PostgreSQL

État du 30 septembre 2026 : **migration OVH effectuée et vérifiée sur staging et production**.
Suivi : [issue 52](https://github.com/thedamfr/site-saletesincere/issues/52).
Décision : [ADR 0023](adr/adr_0023_dimensionnement_stockage_postgresql.md).

## Budget cible

| Usage | Nombre de PVC | Demande par PVC |
| --- | --- | --- |
| PostgreSQL production | 1 | 1 Gio |
| PostgreSQL staging | 1 | 1 Gio |
| Restauration temporaire, une à la fois | 1 | 1 Gio |
| Quota total | 3 | 3 Gio cumulés |

Le budget inclut les fichiers internes PostgreSQL, index et WAL. Les mesures
en lecture seule motivent une réduction par rapport aux anciennes demandes ;
elles ne constituent pas un test de croissance ni une recette de restauration.
Réévaluer le budget lorsque le répertoire complet atteint 50 % de 1 Gio, ou
avant une opération qui nécessite de l'espace temporaire important. Examiner
la croissance des WAL, caches et jobs avant d'augmenter la demande.

Le quota porte sur la somme des capacités demandées, indépendamment des octets
réellement écrits. Avec `microk8s-hostpath`, le répertoire peut dépasser la
capacité du PVC : une demande de 1 Gio ne protège pas, à elle seule, les autres
applications contre une saturation du disque partagé. Vérifier l'occupation
du répertoire et la capacité du système de fichiers, y compris les inodes.
Lors d'un déménagement, vérifier que le stockage choisi applique la limite
physique attendue ; ne pas présenter `requests.storage` comme cette garantie.

## Installation neuve et livraison courante

Les manifests [production](../k8s/ovh/postgres.yaml) et
[staging](../k8s/staging/postgres.yaml) demandent 1 Gio chacun. Le
[quota](../k8s/ovh/quota.yaml) décrit l'état final à 3 Gio.
La livraison continue ne modifie pas les StatefulSets ou PVC ; fusionner cette
correction ne migre pas les volumes. Ne jamais réappliquer l'ensemble des
manifests d'amorçage sur la production pour effectuer cette opération.

## Transition des volumes historiques

Cette procédure conserve le chemin de transition des anciens PVC de 4 Gio.
Elle a été appliquée aux deux environnements le 30 septembre 2026. Une réduction
en place du PVC ou du `volumeClaimTemplates` d’un StatefulSet existant n’est
pas une mise à jour Kubernetes ordinaire.

1. Vérifier la cible OVH et le namespace du Site selon le
   [guide d'hébergement](hebergement-deploiement.md). Relever les volumes,
   leur politique de rétention, les images réellement actives et la configuration
   des StatefulSets sans afficher les secrets. Refaire les mesures du répertoire
   complet et vérifier qu'il tient dans 1 Gio avec une marge suffisante.
2. Préparer et tester la restauration PostgreSQL en environnement isolé avant
   toute bascule de production : données, schéma, rôles/droits, extensions,
   séquences et jobs doivent être conservés. Une copie de production de recette
   ne doit jamais démarrer de worker ou accéder aux services externes réels.
   Conserver les sauvegardes dans un emplacement privé avec accès restreint,
   hors Git et hors journaux ; vérifier leur intégrité et leur restauration.
3. Planifier l'indisponibilité de la base de l'environnement concerné et
   l'interruption de ses consommateurs, dont le worker. Commencer par staging.
   Suspendre le timer de livraison, attendre le service et prendre le verrou
   commun suivant [le runbook](livraison-continue.md), afin d'éviter une livraison
   pendant la maintenance. Observer la santé avant, pendant et après la bascule.
4. Préparer une marge transitoire bornée : **3 PVC / 9 Gio** suffisent pour les
   deux anciens PVC de 4 Gio et un nouveau de 1 Gio. Cette exception doit être
   limitée à la maintenance, consignée et retirée après migration. Ne pas
   appliquer le quota final de 3 Gio alors que les anciens PVC subsistent.
   Les pods temporaires doivent aussi tenir dans les quotas CPU/mémoire.
5. Pour chaque environnement, créer un nouveau PVC de 1 Gio. Préparer le
   StatefulSet de remplacement avec l'image PostgreSQL réellement active,
   les identifiants de cet environnement, ses droits, ses montages et son
   isolation réseau. Ne pas faire correspondre simultanément deux serveurs
   PostgreSQL actifs au sélecteur du Service.
6. Arrêter proprement les consommateurs avant la sauvegarde finale, puis
   PostgreSQL si une copie physique est utilisée. Ne jamais copier un `PGDATA`
   vivant par simple copie de fichiers. Restaurer le nouveau volume, vérifier
   les données et les droits, puis basculer le Service et redémarrer les
   consommateurs. Garder l'ancien volume intact, sans écriture, jusqu'à la
   validation du nouvel environnement. Consigner les noms finaux des ressources
   et aligner les manifests sur ces noms avant clôture.
7. Vérifier la persistance après recréation du pod PostgreSQL, les lectures,
   les droits et une écriture contrôlée en staging. Vérifier le worker, les
   parcours podcast et `/health` (`normal/read_write/ready`). En production,
   suivre aussi la recette publique et la surveillance du guide de livraison.
8. Après validation et sauvegarde restaurable, préparer le retrait de l'ancien
   PVC de l'environnement migré. Vérifier sa politique `Delete` ou `Retain` :
   supprimer un PVC peut supprimer ses fichiers. **Aucune suppression sans
   autorisation explicite de la ressource ciblée.** Ne pas passer à la base
   suivante tant que la place pour son nouveau PVC n'est pas disponible.
9. Quand seuls les deux PVC de 1 Gio restent, appliquer le quota final de
   **3 PVC / 3 Gio**, vérifier l'état réel et les manifests, puis reprendre
   le timer de livraison. Notifier le résultat selon le guide commun. Ne pas
   clôturer l'issue sur la seule modification des manifests.

## Retour arrière

Avant la reprise des écritures sur la nouvelle base, arrêter sa nouvelle
instance et réorienter le Service vers l'ancienne base intacte ; vérifier la
santé et reprendre les consommateurs. Ne jamais démarrer les deux bases derrière
le même Service. Après la reprise des écritures, l'ancien volume est périmé :
un retour exige de préserver et retransférer les nouvelles écritures, avec une
nouvelle interruption contrôlée. Ne pas simplement réactiver l'ancienne copie.

## Résultats vérifiés le 30 septembre 2026

- Les deux PVC actifs et les deux `volumeClaimTemplates` demandent **1 Gio**.
  Le quota final est **3 PVC / 3 Gio**, dont **2 PVC / 2 Gio** utilisés.
- Les noms des PVC, StatefulSets, Services et les références aux Secrets sont
  conservés. Les images applicatives et PostgreSQL sont restées identiques.
- Les consommateurs ont été arrêtés avant sauvegarde logique, puis PostgreSQL
  avant archive physique. L'archive de chaque environnement a été restaurée
  sur son nouveau volume : les empreintes des fichiers étaient identiques.
- La copie isolée a démarré sans worker ni Service. Les exports SQL complets
  étaient identiques avant copie, après restauration, après le test de
  persistance/droits et après rattachement au PVC définitif. Seules les lignes
  de contrôle aléatoires `\restrict` / `\unrestrict` des exports ont été
  exclues de cette comparaison ; les données, rôles et droits ont été comparés.
- Staging, puis production ont réussi les parcours publics et une fenêtre de
  60 secondes de santé `normal/read_write/ready`. La sonde de production a
  observé environ **50 secondes d'indisponibilité planifiée**, puis le retour
  stable du service. Il ne s'agit pas d'une migration sans interruption.
- `npm run test:storage` a réussi sous le quota final : restauration, droits,
  persistance après remplacement du pod, refus/reprise de quota et nettoyage
  des ressources synthétiques. Le garde-fou a auparavant refusé de lancer la
  recette sous le quota transitoire.
- La livraison automatique a été réactivée. Les sondes Prometheus sont récentes
  et saines ; les alertes de quota du namespace ont disparu au contrôle final.

Les deux anciens objets PV ont été retirés après autorisation explicite du
propriétaire, vérification de leur état `Released / Retain`, de l'absence de
PVC associé et de l'intégrité des archives. Leurs fichiers et les archives
privées restent conservés pour retour arrière ; aucun ancien fichier de données
n'a été supprimé. Les deux PV actifs de 1 Gio sont en `Retain`.

Le contrôle automatique avait initialement refusé ce retrait faute d'autorisation
explicite. Cette étape est désormais terminée. Un retour vers un ancien volume
exigerait de recréer son objet PV à partir du snapshot privé et de préserver les
écritures intervenues depuis la bascule.

Les archives, exports et snapshots de configuration restent uniquement dans le
répertoire privé du Site sur OVH, avec accès restreint ; aucun contenu de base ou
secret n'est ajouté au dépôt. Les contrôles établissent la restauration sur cet
hôte, pas l'existence d'une sauvegarde hors serveur. La limite physique du
stockage hostpath reste celle décrite plus haut.

## Recette isolée reproductible

Pendant une maintenance autorisée, depuis le dépôt avec l'accès SSH habituel :

```bash
npm run test:storage
```

Cette commande exige le quota final de 3 Gio / 3 PVC, les deux bases à 1 Gio et
le timer de livraison arrêté. Elle prend le verrou commun. Elle crée un PVC et
un pod PostgreSQL de test, sans Service ni accès aux Secrets applicatifs, sous
l'isolation réseau du namespace. Les données sont entièrement synthétiques.
Elle vérifie l'écriture, la sauvegarde/restauration, la lecture et les droits
après recréation du pod, ainsi que le refus d'une allocation hors quota et sa
reprise après nettoyage. Les refus sont testés avec `--dry-run=server`.
Le pod, le PVC et le PV de test sont supprimés puis leur nettoyage est vérifié.
Ne pas exécuter cette commande en parallèle d'une migration de volumes.
