# ADR-0016 : Restructuration routing homepage/landing

**Date** : 27 décembre 2025  
**Statut** : Accepté  
**Contexte** : PRD Homepage v3.1

---

## Contexte

Le PRD v3.1 positionne Saleté Sincère comme **une invitation** (pas un garde-fou).

Problèmes actuels :
- La homepage (`/`) affiche directement le sale-wall sans contexte
- Pas de réponse explicite à "Dans quel cas précis c'est utile pour moi ?"
- Le `/manifeste` n'est plus pertinent selon la discovery produit
- Manque de distinction entre découverte et passage à l'action

Le produit doit répondre aux 3 JTBD (TON, INCARNATION, ESPACE SÉCURISÉ) avant d'inviter à l'action.

---

## Décision

### Nouvelle structure de routing

1. **`/` → Landing homepage**
   - Page découverte alignée PRD v3.1
   - Explicite les JTBD et la proposition de valeur
   - CTA vers `/wall` (passage à l'action)
   - Mobile-first, sobre, textuelle

2. **`/wall` → Sale-wall (posts vocaux)**
   - Ancien contenu de `/` (liste posts)
   - Conserve toute la logique existante
   - Espace de prise de parole

3. **`/podcast` → Inchangé**
   - Reste à son emplacement actuel
   - Artefact central ("Charbon & Wafer")

4. **`/manifeste` → Supprimé**
   - Plus pertinent selon discovery
   - Pas de redirection (hard NO contre posture élitiste)

---

## Conséquences

### ✅ Bénéfices

- **Alignement PRD** : Explicabilité, tri naturel, désir
- **Parcours cohérent** : Découverte → passage à l'action
- **Mobile-first** : Landing optimisée pour découverte rapide
- **Tri naturel** : Les non-concernés se détectent vite

### ❌ Coûts/Dette

- Migration SEO si URLs indexées (301 recommandés)
- Création template `landing.hbs`
- Tests manuels parcours utilisateur

---

## Critères d'acceptation

**Given** : Un visiteur arrive sur `/`  
**When** : Il lit la landing  
**Then** : Il peut répondre à "Saleté Sincère est utile pour moi si..."

**Given** : Un utilisateur veut poster  
**When** : Il accède à `/wall`  
**Then** : Il retrouve l'interface actuelle (posts + formulaire)

**Given** : Un ancien lien `/manifeste` est partagé  
**When** : Visite de l'URL  
**Then** : 404 ou redirection `/` (à décider)

---

## Interfaces publiques

### Routes créées
```javascript
app.get("/", ...) // Landing PRD v3.1

app.get("/wall", ...) // Sale-wall (ancien index)
```

### Routes modifiées
```javascript
// /manifeste supprimée
```

### Routes inchangées
```javascript
app.get("/podcast", ...)
app.get("/podcast/:season/:episode", ...)
```

---

## Risques OWASP ciblés

Aucun (changement routing uniquement, pas de nouvelle surface d'attaque).

---

## Notes d'implémentation

1. Créer `server/views/landing.hbs` (PRD sections 2, 3, 8)
2. Modifier `server.js` routes
3. Mettre à jour liens internes (footer, navigation)
4. Test manuel parcours complet
5. Décider gestion `/manifeste` (404 ou 301 vers `/`)
