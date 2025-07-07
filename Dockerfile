# ─── Stage build ───
FROM node:24-slim AS builder
WORKDIR /app

# 1) Copier les manifests root + workspace manifests
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/

# 2) Installer TOUTES les dépendances npm (workspaces)
RUN npm ci

# 3) Copier tout le code et builder
COPY . .
RUN npm run build

# ─── Stage runtime ───
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000

# 4) Récupérer uniquement le serveur buildé + ses deps prod
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/routes ./server/routes
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/package-lock.json ./
# On n'installe pas les deps dans server/ car tout est géré à la racine
# et le build ne nécessite que le code compilé et les deps root

EXPOSE 3000
CMD ["node", "server/server.js"]