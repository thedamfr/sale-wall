# Views / Templates

Ce dossier contient les templates pour le rendu des pages HTML.

## 🔄 Migration en cours : Pug → HTML

Le projet migre progressivement de **Pug** vers **HTML pur** pour améliorer la lisibilité et maintenabilité.

### Fichiers actuels

#### ✅ HTML (moderne - à privilégier)
- `podcast.html` - Page liens podcast (style Linktree)

#### ⚠️ Pug (legacy - migration progressive)
- `index.pug` - Homepage avec enregistrement vocal
- `manifeste.pug` - Page manifeste
- `newsletter.pug` - Formulaire inscription newsletter
- `layout.pug` - Layout principal (header/footer)

## 📝 Convention de nommage

| Type | Extension | Utilisation |
|------|-----------|-------------|
| **Nouvelle page** | `.html` | ✅ Toujours créer en HTML |
| **Page existante** | `.pug` | ⚠️ Migrer si refonte importante |

## 🚀 Créer une nouvelle vue

### Option 1 : HTML pur (recommandé)

```html
<!-- server/views/ma-page.html -->
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ma Page - Saleté Sincère</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body class="min-h-screen bg-[#0B0B0B] text-[#F2F2EF]">
    <main class="container mx-auto px-4 py-12">
        <h1>Ma Page</h1>
        <!-- Votre contenu ici -->
    </main>
</body>
</html>
```

**Route dans `server.js` :**
```javascript
const path = require('path');

app.get("/ma-page", {
  config: { rateLimit: pageLimiter }
}, (req, reply) =>
  reply.sendFile("ma-page.html", path.join(__dirname, "server", "views"))
);
```

### Option 2 : Pug (legacy - éviter)

```pug
//- server/views/ma-page.pug
extends layout

block content
  main
    h1 Ma Page
    //- Votre contenu ici
```

**Route dans `server.js` :**
```javascript
app.get("/ma-page", {
  config: { rateLimit: pageLimiter }
}, (req, reply) =>
  reply.view("ma-page.pug", { title: "Ma Page" })
);
```

## 🔧 Migrer une vue Pug → HTML

### Checklist de migration

1. [ ] Créer `nouvelle-page.html` à partir de `ancienne-page.pug`
2. [ ] Convertir la syntaxe Pug en HTML standard
3. [ ] Inclure le `<head>` complet (charset, viewport, CSS)
4. [ ] Appliquer les classes Tailwind CSS directement
5. [ ] Remplacer `reply.view()` par `reply.sendFile()` dans `server.js`
6. [ ] Tester en local : http://localhost:3000/nouvelle-page
7. [ ] Vérifier le responsive mobile (DevTools)
8. [ ] Supprimer le fichier `.pug` si tout fonctionne
9. [ ] Commit : `refactor(views): migrate [page] from Pug to HTML`

### Exemple de conversion

**Avant (Pug) :**
```pug
extends layout

block content
  main.container.mx-auto.px-4
    h1.text-3xl.font-bold.mb-4 Titre
    p.text-gray-400 Description
```

**Après (HTML) :**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Titre - Saleté Sincère</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body class="min-h-screen bg-[#0B0B0B] text-[#F2F2EF]">
    <main class="container mx-auto px-4">
        <h1 class="text-3xl font-bold mb-4">Titre</h1>
        <p class="text-gray-400">Description</p>
    </main>
</body>
</html>
```

## 🎨 Styles disponibles

Toutes les vues ont accès à **Tailwind CSS v4** via `/style.css` (compilé).

### Classes utiles

```html
<!-- Layout -->
<div class="container mx-auto px-4 py-12"></div>
<div class="max-w-md mx-auto"></div>

<!-- Couleurs du thème -->
<body class="bg-[#0B0B0B] text-[#F2F2EF]"></body>
<div class="bg-[#D6B977]"></div>  <!-- Doré -->

<!-- Typographie -->
<h1 class="text-3xl font-bold mb-4"></h1>
<p class="text-gray-400 text-sm"></p>

<!-- Boutons -->
<button class="px-6 py-3 bg-[#D6B977] text-[#0B0B0B] rounded-full hover:opacity-90"></button>

<!-- Cards -->
<div class="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-6"></div>
```

## 📚 Documentation

- **ADR complet** : `documentation/adr/adr_0008_migration_pug_vers_html.md`
- **README projet** : Section "Système de Templates"
- **Fastify sendFile** : https://fastify.dev/docs/latest/Reference/Reply/#sendfile

## ❓ Questions fréquentes

### Pourquoi migrer vers HTML ?

- ✅ Lisibilité universelle (pas de syntaxe propriétaire)
- ✅ Pas de compilation nécessaire
- ✅ Meilleur support IDE (autocomplétion, validation)
- ✅ Debugging plus simple
- ✅ Facilite les contributions

### Peut-on garder Pug pour certaines pages ?

Oui, si la page nécessite beaucoup de **logique côté serveur** (boucles, conditions complexes), Pug peut être conservé. Mais privilégiez HTML + API JavaScript côté client.

### Comment gérer les données dynamiques en HTML ?

**Option 1 : Fetch API (recommandé)**
```html
<script>
  fetch('/api/data')
    .then(r => r.json())
    .then(data => renderData(data));
</script>
```

**Option 2 : Template literals côté serveur**
```javascript
const html = fs.readFileSync("template.html", "utf-8")
  .replace("{{title}}", dynamicTitle);
reply.type("text/html").send(html);
```

### Quid des headers/footers communs ?

Pour l'instant, chaque page HTML est **standalone**. Si besoin de composants réutilisables, on pourra :
- Utiliser des **includes JavaScript** côté client
- Créer un **script de build** qui injecte les composants
- Garder `layout.pug` pour les pages très dynamiques

---

**Date de dernière mise à jour** : 21 octobre 2025  
**Responsable** : @thedamfr
