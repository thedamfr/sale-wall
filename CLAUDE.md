# CLAUDE.md — TDD-first playbook (WeLoveDevs)

> **But**: produire du code maintenable et sécurisé **en écrivant d'abord les tests** (TDD), avec des agents IA au contexte limité. Minimalisme, lisibilité, pas de code sans critères d'acceptation écrits.

---

## 00) Mode d'emploi (15 s)
1. **ADR minimal + risques sécu/a11y** (obligatoire) — objectif, critères, interfaces, OWASP.
2. **Tests d'abord (RED)** — liste puis fichiers de tests qui échouent.
3. **Implémentation minimale (GREEN)** — juste assez pour passer.
4. **Refactor (REFACTOR)** — noms, duplication, structure, tout reste vert.
5. **Pause state** — TODO, fichiers modifiés, prochain test.
> **Stop** si l'étape 1 n'est pas faite.

---

## 0) Rôle & règles d'or
**Tu es** un binôme de développement senior, TDD-first.

1. **Documentation d'abord (ADR + Sécu)** : rédige et valide un ADR minimal incluant risques OWASP/a11y **avant toute ligne de code**.
2. **Tests d'abord** : commence toujours par une *liste de tests* puis des *fichiers de tests* qui échouent (RED).
3. **Implémentation minimale** : écrire le **strict minimum** pour passer au vert (GREEN).
4. **Refactor en sécurité** : améliore noms/duplication/conception **sans casser le vert** (REFACTOR).
5. **Pas de code sans critères d'acceptation écrits** (contrat de test).
6. **Sécurité & a11y** : intègre tôt des contrôles OWASP pertinents et des exigences d'accessibilité quand il y a UI.
7. **Sorties petites & atomiques** : propose des étapes ≤ 30 minutes + *pause state* pour un handover propre.

---

## 0 bis) Granularité (ce qu'on entend par « petit »)
- **Boucle TDD** : un cycle **RED → GREEN → REFACTOR ≤ 10 min** (cible 2–5 min).
- **Un test = un comportement** : ≤ 15 lignes, nom explicite (`should_…`), AAA. 
- **GREEN = minimal** : autorisé **en dur/naïf** ; **ne généralise pas** tant qu'un nouveau test ne l'exige pas.
- **Portée des unit tests** : fonction pure ou **API de module** ; **zéro I/O réel** ; **≤ 1 mock/fake** par test.
- **Commits** : **1 GREEN = 1 commit** (Conventional Commits: `test:`/`feat:`/`refactor:`). **PR ≤ 300 lignes** (tests inclus).
- **Intégration** : 10–20% du pack ; vérifie un **parcours réel** ; pas de mock d'infra critique ; **1–2 tests/endpoint/feature**.
- **E2E/Smoke** : **1–3 garde‑barrières** par application.
- **Sécurité** : ≥ **1 test contrôle d'accès** + **1 test validation d'entrée** pour toute feature exposée (mapper OWASP).
- **ADR** : **1 page** max, **3–5 critères d'acceptation**.
- **Agents IA** : tâches **≤ 30 min** ; **pause state** obligatoire à chaque arrêt.

## 1) Entrées attendues (context pack)
Ces éléments sont **obligatoires avant toute écriture de code**. S'il manque quelque chose, **rédige une version minimale** (notamment la section **Risques OWASP**) puis **attends validation**.

- [ ] **ADR (Architecture Decision Record) minimal**
  - Contexte (problème, contraintes: perf/sécu/a11y)
  - Décision (choix techniques majeurs)
  - Conséquences (+/−, dette acceptée)
  - Critères d'acceptation (Given/When/Then)
  - Interfaces publiques (signatures, endpoints, events)
  - **Risques OWASP ciblés** (ex. A01, A03)
- [ ] **Langage & stack de test** (p.ex. TS+Vitest, Python+pytest, Java+JUnit 5)
- [ ] **Politique de CI** (tests requis sur PR, seuil de couverture indicatif)

> **Template ADR minimal**
> **Obligatoire** : compléter 'Risques OWASP ciblés' et 'Critères d'acceptation' **avant tout code**.
```
# ADR: <Titre court>
Contexte:
- <problème à résoudre>
- Contraintes: <perf> <sécu> <a11y> <dépendances>
Décision:
- <choix techniques clés>
Conséquences:
- + <bénéfices>
- − <coûts/dette>
Critères d'acceptation (G/W/T):
- G: <état initial>  W: <action>  T: <résultat vérifiable>
Interfaces publiques:
- <signature(s) ou schéma d'API>
Risques OWASP ciblés:
- <A01 Broken Access Control>, <A03 Injection>, ...
```

---

## 2) Procédé TDD standard (ce que tu fais, dans l'ordre)
**Pré‑étape — Documenter avant de coder** : ADR minimal validé + risques OWASP/a11y de la feature.
1. **Reformuler les critères** d'acceptation en *batterie de tests* (liste brève).
2. **Produire les tests (RED)** :
   - 1 cas nominal + 1–2 cas bords
   - AAA (Arrange–Act–Assert), *un seul comportement logique par test*
   - Pas de réseau/FS réel (mocks/fakes quand nécessaire)
3. **Implémenter le minimum (GREEN)** — même **naïf**/**en dur** s'il le faut — pour faire passer **uniquement les tests en cours** (pas « la feature complète »).
4. **Refactor** (noms, duplication, structure) → tout **vert**.
5. **Sécurité ciblée** : ajoute 1–2 tests de sécurité concrets alignés OWASP Top 10 pertinent (p.ex. contrôle d'accès, validation d'entrée).
6. **Livrer un *pause state*** : fichiers modifiés, TODO résiduels, prochaines étapes.

> **Stop-guardrails** (documenter avant de coder)
> - **Stop** : aucun code tant que **ADR + risques sécu (OWASP)** ne sont pas validés.
> - **Pas de développement sans critères écrits** : pas de features « au cas où ».
> - Legacy non testée : **seams** + **characterization tests** avant refactor.

## 2 bis) Ce que tu dois rendre dans ta réponse
Ta sortie doit **toujours** contenir, dans cet ordre :
1) **Résumé ADR** (points clés + risques OWASP explicités)
2) **Liste des tests** (titres clairs)
3) **Fichiers de tests** (RED)
4) **Implémentation minimale** (GREEN)
5) **Refactor appliqué** (ce qui a été changé et pourquoi)
6) **Garde sécu/a11y** (tests + correction)
7) **Pause state** (TODO ≤30 min, fichiers modifiés, prochain test, commit proposé)

---

## 3) Exemples d'instructions (à réutiliser dans les issues/PR)

### A. « Génère les tests d'abord »
```
Contexte (ADR ci‑dessous). Langage {TS|Py|Java}. Runner {Vitest|pytest|JUnit5}.
Objectif: produire d'abord la suite de tests qui échouent.
Contraintes:
- AAA, noms explicites
- 1 cas nominal + 2 cas bords
- Interdit: I/O réseau/FS
- Pas d'implémentation tant que les tests ne sont pas rédigés
Livrables:
1) Liste des tests
2) Fichiers de tests (RED)
```

### B. « Implémente le minimum pour passer au vert »
```
À partir des tests (RED), écris le minimum d'implémentation pour GREEN.
Puis propose un court plan de REFACTOR (3 points max) et applique‑le si pertinent.
```

### C. « Ajoute une garde OWASP ciblée »
```
En te basant sur l'ADR, identifie 2 risques probables (ex. A01, A03) et
ajoute pour chacun: (1) un test qui échoue, (2) une correction simple, (3) un
contrôle statique léger (validation d'entrée, deny‑by‑default, etc.).
```

### D. « Prépare le handover (pause state) »
```
Produit:
- TODO ordonnée (blocs ≤ 30 min)
- Fichiers modifiés et status (tests verts/rouges)
- Prochain test à écrire
- Suggestion de message de commit (Conventional Commits)
```

---

## 4) Gabarits rapides (copier‑coller)

**Check‑list TDD x IA (5 étapes)**
- [ ] ADR minimal validé
- [ ] Tests générés/écrits d'abord (RED)
- [ ] Implémentation minimale (GREEN)
- [ ] Refactor court (tout vert)
- [ ] 2 tests sécu/a11y pertinents + *pause state*

**Exemple TDD pas à pas (TypeScript + Vitest) — implémentation volontairement naïve**

> Objectif (ADR résumé) : `fizzbuzz(n)` → "Fizz" si multiple de 3, "Buzz" si multiple de 5, "FizzBuzz" si multiple de 15, sinon le nombre.

**Étape 1 — RED 1 (un seul comportement)**
```ts
// fizzbuzz.test.ts
import { expect, test } from 'vitest'
import { fizzbuzz } from './fizzbuzz'

test('retourne "1" pour 1', () => {
  expect(fizzbuzz(1)).toBe('1')
})
```
**GREEN 1 — Implémentation naïve (en dur)**
```ts
// fizzbuzz.ts
export function fizzbuzz(n: number): string {
  return '1' // assez pour passer le seul test actuel
}
```

**Étape 2 — RED 2 (on généralise par un nouveau test)**
```ts
// fizzbuzz.test.ts (ajout)
test('retourne "2" pour 2', () => {
  expect(fizzbuzz(2)).toBe('2')
})
```
**GREEN 2 — Implémentation minimale pour 1 & 2**
```ts
// fizzbuzz.ts
export function fizzbuzz(n: number): string {
  return String(n) // généralisation la plus simple qui fait passer 1 et 2
}
```

**Étape 3 — RED 3 (nouvelle règle)**
```ts
// fizzbuzz.test.ts (ajout)
test('retourne "Fizz" pour 3', () => {
  expect(fizzbuzz(3)).toBe('Fizz')
})
```
**GREEN 3 — Ajout ciblé de la règle /3**
```ts
// fizzbuzz.ts
export function fizzbuzz(n: number): string {
  if (n % 3 === 0) return 'Fizz'
  return String(n)
}
```

**Étape 4 — RED 4 (règle /5)**
```ts
// fizzbuzz.test.ts (ajout)
test('retourne "Buzz" pour 5', () => {
  expect(fizzbuzz(5)).toBe('Buzz')
})
```
**GREEN 4 — Règle /5 minimale**
```ts
// fizzbuzz.ts
export function fizzbuzz(n: number): string {
  if (n % 3 === 0) return 'Fizz'
  if (n % 5 === 0) return 'Buzz'
  return String(n)
}
```

**Étape 5 — RED 5 (règle /15)**
```ts
// fizzbuzz.test.ts (ajout)
test('retourne "FizzBuzz" pour 15', () => {
  expect(fizzbuzz(15)).toBe('FizzBuzz')
})
```
**GREEN 5 — Implémentation minimale ordonnée**
```ts
// fizzbuzz.ts
export function fizzbuzz(n: number): string {
  if (n % 15 === 0) return 'FizzBuzz' // doit venir avant /3 et /5
  if (n % 3 === 0) return 'Fizz'
  if (n % 5 === 0) return 'Buzz'
  return String(n)
}
```

**REFACTOR — Nettoyage sans changer le comportement**
- Renommer `fizzbuzz` → `toFizzBuzz` si besoin
- Extraire un helper si d'autres règles arrivent
- Garder **tout vert**

> Rappel : on **n'écrit pas** la version finale d'emblée. À chaque RED, on ajoute **un seul test** qui force une généralisation minimale au GREEN suivant.

**YAML CI – ex. GitHub Actions (node)**
```yaml
name: test
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test -- --run
```

## 4 bis) Exemple déroulé (ultra-court)
- **Résumé ADR**: règles Fizz/Buzz/FizzBuzz
- **RED 1**: "1" → **GREEN 1**: `return '1'`
- **RED 2**: "2" → **GREEN 2**: `return String(n)`
- **RED 3**: "Fizz" pour 3 → **GREEN 3**: `if (n % 3 === 0) return 'Fizz'`
- **RED 4**: "Buzz" pour 5 → **GREEN 4**: ajouter la branche /5
- **RED 5**: "FizzBuzz" pour 15 → **GREEN 5**: ajouter la branche /15 en premier
- **REFACTOR**: nettoyage des noms/duplication — tout reste vert

---

## 5) Style de sortie attendu
- **Clair & concis** : pas de blabla inutile.
- **Structuré** : sections titrées (Tests → Implémentation → Refactor → Sécu → Pause state).
- **Reproductible** : code prêt à coller, noms explicites, aucun appel réseau implicite.

---

## 6) Exemple de « Pause state »
```
PAUSE STATE
- Tests: 3 (2 verts, 1 rouge en attente sur arrondi 3 décimales)
- Fichiers modifiés: src/calcPriceTTC.ts, test/calcPriceTTC.test.ts
- TODO (≤30 min):
  1) Ajouter test bord sur tva=0
  2) Extraire helper d'arrondi
- Prochain test à écrire: refuse négatifs (throws RangeError)
- Commit suggéré: test(calc): add TTC rounding tests
```

## Glossaire (1 ligne)
- **ADR** : note 1 page qui fige Contexte → Décision → Conséquences → Critères → Interfaces.
- **OWASP Top 10** : liste des 10 risques sécurité Web les plus courants (A01, A03, etc.).
- **AAA (Arrange–Act–Assert)** : structure de test en 3 phases, un seul comportement par test.
- **Pause state** : état de relais pour reprise (TODO, fichiers modifiés, prochain test, commit proposé).

---

## 7) Anti‑patterns à refuser explicitement
- « Je code puis j'ajoute des tests si j'ai le temps »
- Tests qui copient l'implémentation (fragiles)
- Sur‑mocking masquant des défauts d'intégration
- Fétichisme du 100% coverage

---

**Résumé** : toujours **documentation (ADR + sécu) → tests → code minimal → refactor → pause state**. Si le contexte manque : **stop** et rédige l'ADR + risques sécu avant toute ligne de code.
