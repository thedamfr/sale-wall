# ADR 0023 — Dimensionnement du stockage PostgreSQL

Date : 2026-09-30. Statut : proposé ; migration des volumes existants à réaliser.

## Décision

Demander **1 Gio par base PostgreSQL**, production et staging, au lieu de 4 Gio.
Le quota cible est **3 PVC et 3 Gio** : deux bases permanentes et un volume
temporaire de restauration. Une restauration est menée à la fois. Les ressources
CPU et mémoire restent celles de l'ADR 0020.

Le dimensionnement prend en compte le répertoire PostgreSQL complet, ses WAL,
les index, les caches et les jobs `pg-boss`, pas seulement les données métier.
Les mesures, critères de réévaluation et étapes de transition sont dans le
[guide de stockage](../dimensionnement-stockage.md).

## Conséquences

Les nouvelles installations et les déménagements héritent de ce budget réduit.
Un changement YAML ne réduit pas les PVC existants : Kubernetes ne permet pas
leur réduction en place. Leur remplacement exige une copie cohérente, une
validation des données, une maintenance planifiée et un retour arrière préparé.
Le quota final ne doit être appliqué qu'après la migration des deux bases.

`microk8s-hostpath` ne fait pas respecter la capacité déclarée comme une limite
physique. Ce budget contrôle l'allocation Kubernetes, pas l'isolement disque des
applications colocataires. Toute future cible doit vérifier séparément ce point.
Mettre en place une limite physique sur l'hôte partagé relève d'une décision
d'infrastructure distincte ; cette correction ne modifie pas son stockage global.

## Références

- [Kubernetes : volumes persistants](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [MicroK8s : limites du stockage hostpath](https://canonical.com/microk8s/docs/addon-hostpath-storage)
- [ADR 0020 : livraison et staging](adr_0020_livraison_continue_et_staging.md)
