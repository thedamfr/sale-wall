# ADR-0009: Migration Pug vers Handlebars

**Date**: 2025-10-21  
**Statut**: ✅ Accepté  
**Décideurs**: @thedamfr  
**Contexte**: Suite à ADR-0008 (sortie de Pug), remplacement par Handlebars

---

## Contexte

Suite à la décision ADR-0008 de migrer progressivement hors de Pug, le projet doit choisir un nouveau moteur de templating côté serveur pour remplacer Pug sur les vues existantes.

### Problèmes persistants avec Pug

- **Syntaxe propriétaire** : Indentation obligatoire, classes CSS complexes difficiles à écrire
- **Lisibilité limitée** : Contributeurs doivent apprendre une syntaxe spécifique
- **Debugging cryptique** : Erreurs de syntaxe difficiles à comprendre
- **Maintenance** : Barrière à l'entrée pour contributions externes

### Contraintes du projet

1. **Templating côté serveur requis** : Homepage avec données dynamiques (posts, stats)
2. **Compatible @fastify/view** : Plugin Fastify existant
3. **Migration progressive** : Coexistence temporaire possible avec Pug
4. **Performance** : Pas de régression de temps de rendu
5. **Maintenabilité** : Syntaxe universellement comprise

---

## Décision

**Adoption de Handlebars comme moteur de templating par défaut** pour remplacer Pug.

### Pourquoi Handlebars ?

1. **Syntaxe proche du HTML** : `{{variable}}` au lieu de syntaxe propriétaire
2. **Courbe d'apprentissage minimale** : 5 minutes pour être productif
3. **Logique limitée** : Force à garder la logique métier côté serveur (bonne pratique)
4. **Support natif Fastify** : Compatible `@fastify/view` sans configuration complexe
5. **Partials intégrés** : Header/footer réutilisables facilement
6. **Expérience positive** : Développeur déjà familier avec la syntaxe

### Syntaxe comparative

**Avant (Pug)** :
```pug
if posts && posts.length > 0
  each post in posts
    article.flex.items-center
      h2.font-serif.font-bold.text-xl #{post.title}
      p.text-gray-400 #{post.duration}
else
  p.text-center Aucun récit
```

**Après (Handlebars)** :
```handlebars
{{#if posts.length}}
  {{#each posts}}
  <article class="flex items-center">
    <h2 class="font-serif font-bold text-xl">{{title}}</h2>
    <p class="text-gray-400">{{duration}}</p>
  </article>
  {{/each}}
{{else}}
  <p class="text-center">Aucun récit</p>
{{/if}}
```

**Gain de lisibilité** : ✅ HTML standard, classes Tailwind directement lisibles

---

## Implémentation

### Configuration Fastify

```javascript
// server.js
import handlebars from "handlebars";

await app.register(fastifyView, {
  engine: { handlebars },
  root: path.join(__dirname, "server/views"),
  options: {
    partials: path.join(__dirname, "server/views/partials")
  }
});

// Usage identique à Pug
app.get("/", async (req, reply) => {
  reply.view("index.hbs", { 
    title: "Saleté Sincère",
    posts,
    stats
  });
});
```

### Structure des vues

```
server/views/
├── layout.hbs           # Template parent
├── index.hbs            # Homepage
├── manifeste.hbs        # Manifeste
├── podcast.html         # Nouvelle page (HTML statique, ADR-0008)
└── partials/
    └── header.hbs       # Header réutilisable
```

### Helpers Handlebars custom (si besoin)

```javascript
// Enregistrer des helpers globaux
handlebars.registerHelper('formatDate', (date) => {
  return new Date(date).toLocaleDateString('fr-FR');
});

// Usage dans template
<p>{{formatDate created_at}}</p>
```

---

## Plan de Migration

### Phase 1 : Setup (aujourd'hui)
- [x] ADR rédigé
- [ ] `npm install handlebars`
- [ ] Configuration `server.js`
- [ ] Création `layout.hbs` + `partials/header.hbs`

### Phase 2 : Migration vues principales
- [ ] `index.pug` → `index.hbs` (homepage avec posts dynamiques)
- [ ] `manifeste.pug` → `manifeste.hbs` (page simple)
- [ ] Tests manuels en local

### Phase 3 : Validation et cleanup
- [ ] Tests fonctionnels complets (enregistrement, lecture, filtres)
- [ ] Validation accessibilité (transcriptions toujours présentes)
- [ ] Suppression fichiers `.pug` obsolètes
- [ ] Désinstallation `pug` de `package.json`
- [ ] Mise à jour README.md

---

## Conséquences

### Positives

- ✅ **Lisibilité universelle** : Tout développeur comprend HTML + `{{}}`
- ✅ **Maintenance facilitée** : Pas de syntaxe propriétaire à documenter
- ✅ **Debugging simple** : Erreurs HTML standard
- ✅ **Meilleur support IDE** : Autocomplétion Tailwind dans classes HTML
- ✅ **Performance identique** : Compilation côté serveur similaire à Pug
- ✅ **Migration douce** : Coexistence temporaire Pug/Handlebars possible

### Négatives

- ❌ **Verbosité** : HTML plus long que syntaxe Pug (acceptable)
- ❌ **Logique limitée** : Pas de boucles complexes (mais c'est une bonne pratique)
- ❌ **Refactoring nécessaire** : Toutes les vues `.pug` à migrer
- ❌ **Coexistence temporaire** : Deux moteurs pendant la transition

### Risques OWASP

**A03 Injection (Templates)** :
- ✅ **Handlebars échappe par défaut** : `{{variable}}` auto-escaped
- ⚠️ **Triple-braces non échappées** : `{{{html}}}` à utiliser avec précaution
- ✅ **Pas de code serveur dans templates** : Logique uniquement côté Node.js

**Pratiques sécurité** :
```handlebars
<!-- ✅ Échappé automatiquement -->
<p>{{user_input}}</p>

<!-- ⚠️ NON échappé - UNIQUEMENT pour HTML validé côté serveur -->
<div>{{{sanitized_html}}}</div>

<!-- ✅ Attributs échappés aussi -->
<button data-id="{{post.id}}">Voter</button>
```

**A05 Security Misconfiguration** :
- ✅ Pas de changement de configuration sécurité Fastify
- ✅ Rate limiting toujours actif sur toutes les routes
- ✅ CORS restrictif maintenu

---

## Alternatives Considérées

### EJS (Embedded JavaScript)
- ✅ Syntaxe JS native, très flexible
- ❌ Peut devenir bordélique (trop de logique dans les vues)
- ❌ Moins de séparation présentation/logique

### Nunjucks (Mozilla)
- ✅ Syntaxe claire, similaire Jinja2
- ✅ Filtres intégrés puissants
- ❌ Moins populaire que Handlebars
- ❌ Documentation moins fournie

### Mustache
- ✅ Syntaxe minimaliste
- ❌ Trop limité (pas de helpers)
- ❌ Pas de logique conditionnelle avancée

**Choix final** : Handlebars pour l'équilibre lisibilité/puissance

---

## Critères d'acceptation

- [x] **ADR documenté** : Décision validée et tracée
- [ ] **Handlebars installé** : `npm list handlebars` OK
- [ ] **Configuration Fastify** : `@fastify/view` avec engine Handlebars
- [ ] **Layout fonctionnel** : `layout.hbs` + partials
- [ ] **Homepage migrée** : `index.hbs` avec posts + stats
- [ ] **Manifeste migré** : `manifeste.hbs` validé
- [ ] **Tests manuels** : Enregistrement, lecture, filtres fonctionnels
- [ ] **Cleanup Pug** : Fichiers `.pug` supprimés si tout OK
- [ ] **README mis à jour** : Documentation technique actualisée

---

## Références

- **ADR-0008** : Migration progressive hors de Pug (context général)
- **Handlebars docs** : https://handlebarsjs.com/
- **@fastify/view** : https://github.com/fastify/point-of-view
- **Premier template** : `/server/views/layout.hbs` (à créer)

---

## Rollback Plan

Si problème bloquant lors de la migration :

1. **Garder Pug en parallèle** : Ne pas désinstaller immédiatement
2. **Revenir sur routes** : `reply.view("index.pug")` si `index.hbs` échoue
3. **Tester progressivement** : Migrer une vue à la fois, valider avant suivante
4. **Monitoring production** : Vérifier logs erreurs template après déploiement

**Critère de succès** : Aucune régression fonctionnelle ou performance sur production.

---

## Notes de Migration

### Checklist par vue Pug → Handlebars

1. [ ] Copier structure HTML de base
2. [ ] Remplacer `#{variable}` par `{{variable}}`
3. [ ] Convertir `if/else` : `if posts` → `{{#if posts}}`
4. [ ] Convertir boucles : `each post in posts` → `{{#each posts}}`
5. [ ] Convertir classes : `.class` → `class="class"`
6. [ ] Tester rendu avec données réelles
7. [ ] Valider accessibilité (ARIA, alt, transcriptions)
8. [ ] Commit : `refactor(views): migrate [page] from Pug to Handlebars`

### Commandes utiles

```bash
# Vérifier vues Pug restantes
find server/views -name "*.pug"

# Vérifier routes utilisant Pug
grep -n 'reply.view.*pug' server.js

# Dev avec auto-reload
npm run dev
# Modifier nodemon.json pour watch .hbs au lieu de .pug
```

---

**Validation TDD** : 
- ✅ Documentation avant code (ADR rédigé)
- ✅ Risques OWASP identifiés (A03 injection templates)
- ✅ Plan de rollback défini
- ✅ Critères d'acceptation vérifiables

**Prochaine étape** : Installation et configuration Handlebars dans `server.js`
