# ADR-0008: Migration progressive de Pug vers HTML

**Date**: 2025-10-21  
**Statut**: ✅ Accepté  
**Décideurs**: @thedamfr  
**Contexte**: Refonte progressive des vues frontend

---

## Contexte

Le projet utilise actuellement **Pug** (anciennement Jade) comme moteur de templates pour générer les pages HTML. Bien que Pug soit puissant et permette d'écrire moins de code, il présente plusieurs inconvénients :

### Problèmes identifiés avec Pug

1. **Lisibilité limitée** : La syntaxe basée sur l'indentation est difficile à lire et à maintenir, surtout pour des contributeurs occasionnels
2. **Courbe d'apprentissage** : Nécessite d'apprendre une syntaxe spécifique, alors que HTML est un standard universel
3. **Debugging complexe** : Les erreurs de syntaxe Pug sont cryptiques (ex: `Unexpected token 'filter'` pour un simple problème de classe CSS)
4. **Incompatibilité avec outils modernes** : Moins de support dans les IDE, linters, et outils de développement
5. **Maintenance du projet** : Barrière à l'entrée pour tout développeur voulant contribuer

### Cas concret

Lors de la création de `/podcast` (ADR-0009), plusieurs erreurs de syntaxe Pug sont survenues :
- Classes CSS avec `:` (ex: `hover:text-white`) non reconnues avec syntaxe point
- Classes avec tirets multiples (`backdrop-blur-sm`) nécessitant des guillemets
- Difficulté à structurer le DOM avec l'indentation

**Temps perdu** : ~30 minutes sur des erreurs de syntaxe qui n'existeraient pas en HTML pur.

---

## Décision

**Migration progressive de Pug vers HTML pur** selon les principes suivants :

### Stratégie de migration

1. **Pas de réécriture massive** : On garde les fichiers `.pug` existants fonctionnels
2. **Nouvelles features en HTML** : Toute nouvelle page/vue sera créée en `.html`
3. **Refonte opportuniste** : Quand on touche une vue existante pour une feature, on la migre en HTML
4. **HTML statique servi par Fastify** : Utilisation de `reply.sendFile()` au lieu de `reply.view()`

### Règles d'implémentation

```javascript
// ✅ Nouvelle approche (HTML)
app.get("/podcast", { config: { rateLimit: pageLimiter }}, (req, reply) =>
  reply.sendFile("podcast.html", path.join(__dirname, "server", "views"))
);

// ⚠️ Approche legacy (Pug - à migrer progressivement)
app.get("/manifeste", { config: { rateLimit: pageLimiter }}, (req, reply) =>
  reply.view("manifeste.pug", { title: "Manifeste" })
);
```

### Avantages HTML pur

- ✅ **Lisibilité universelle** : Tout développeur web connaît HTML
- ✅ **Pas de compilation** : Fichiers servis directement
- ✅ **Meilleur support IDE** : Autocomplétion, validation, formatting natifs
- ✅ **Debugging simple** : Inspection directe du code source
- ✅ **Maintenance facilitée** : Pas de syntaxe propriétaire à apprendre
- ✅ **Performance** : Pas de parsing Pug côté serveur

### Compromis acceptés

- ❌ **Plus verbeux** : HTML est plus long que Pug (acceptable avec Tailwind CSS)
- ❌ **Pas de templating dynamique** : Variables JS nécessitent un autre mécanisme (voir section suivante)
- ❌ **Duplication** : Header/footer à répéter (gérable avec includes JS côté client si besoin)

---

## Gestion du contenu dynamique

Pour les pages nécessitant des données dynamiques (actuellement injecté via Pug) :

### Option 1 : API + JS côté client (recommandé)
```html
<!-- podcast.html -->
<script>
  fetch('/api/podcast-data')
    .then(r => r.json())
    .then(data => renderPodcast(data));
</script>
```

### Option 2 : Template literals côté serveur
```javascript
app.get("/dynamic", (req, reply) => {
  const html = fs.readFileSync("template.html", "utf-8")
    .replace("{{title}}", req.user.name);
  reply.type("text/html").send(html);
});
```

### Option 3 : Garder Pug pour pages très dynamiques
Si une page nécessite beaucoup de logique côté serveur, on peut garder Pug exceptionnellement.

---

## Conséquences

### Positives

- ✅ **Accessibilité** : Tout contributeur peut lire et modifier le code
- ✅ **Rapidité de développement** : Moins de friction, moins de debugging syntaxique
- ✅ **Standardisation** : Alignement avec les pratiques web modernes
- ✅ **Outillage** : Meilleur support VS Code, Prettier, ESLint HTML

### Négatives

- ❌ **Coexistence temporaire** : Deux systèmes de templating pendant la transition
- ❌ **Refactoring progressif** : Vues Pug existantes resteront jusqu'à refonte
- ❌ **Documentation** : Besoin de documenter les deux approches

### Risques OWASP

Aucun nouveau risque introduit :
- **A03 Injection** : HTML statique = pas d'injection de template
- **A05 Security Misconfiguration** : Même configuration Fastify pour `.html` et `.pug`

---

## Plan de migration

### Phase 1 : Nouvelles features (actuel)
- ✅ `/podcast` créé en HTML (premier cas d'usage)
- ⏳ Toute nouvelle route utilise HTML

### Phase 2 : Refonte opportuniste
- [ ] `/manifeste` → HTML lors de prochaine modification
- [ ] `/newsletter` → HTML lors de refonte design
- [ ] Homepage `/` → HTML (dernier, car plus complexe)

### Phase 3 : Cleanup (optionnel)
- [ ] Supprimer dépendance `@fastify/view` si plus aucun `.pug`
- [ ] Supprimer `pug` de `package.json`
- [ ] Supprimer `server/views/layout.pug` si inutilisé

---

## Critères d'acceptation

- [x] **ADR rédigé** : Décision documentée pour futures contributions
- [x] **Premier cas d'usage** : `/podcast` fonctionne en HTML pur
- [ ] **README mis à jour** : Section "Structure des vues" avec nouvelle approche
- [ ] **Convention de nommage** : `.html` pour nouveaux fichiers, `.pug` pour legacy

---

## Références

- Premier fichier HTML : `/server/views/podcast.html`
- Route associée : `server.js` ligne ~658
- Issue déclencheur : Erreurs syntaxe Pug sur page podcast (21/10/2025)

---

## Notes de migration

### Commandes utiles

```bash
# Trouver toutes les vues Pug restantes
find server/views -name "*.pug"

# Vérifier les routes utilisant .view()
grep -n "reply.view" server.js

# Compter les vues par type
ls server/views/*.pug | wc -l    # Legacy
ls server/views/*.html | wc -l   # Moderne
```

### Checklist pour migrer une vue Pug → HTML

1. [ ] Copier le fichier `.pug` en `.html`
2. [ ] Convertir la syntaxe Pug en HTML standard
3. [ ] Remplacer `reply.view()` par `reply.sendFile()` dans la route
4. [ ] Tester la page en local
5. [ ] Supprimer le fichier `.pug` une fois validé
6. [ ] Commit avec message : `refactor(views): migrate [page] from Pug to HTML`

---

**Validation** : Cette approche respecte le principe TDD du projet (pas de tests cassés, nouvelles features testables) et améliore la maintenabilité sans sacrifice fonctionnel.
