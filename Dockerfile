# syntax=docker/dockerfile:1

# ---- Stage 1: build ----
FROM node:22-slim AS builder

# Prisma a besoin d'OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installer toutes les dépendances (dev incluses) pour build + prisma generate
COPY package*.json ./
RUN npm ci

# Copier le schéma Prisma et générer le client
COPY prisma ./prisma
RUN npx prisma generate

# Copier le reste des sources et compiler le TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:22-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Dépendances de production uniquement
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Client Prisma généré + schéma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Code compilé
COPY --from=builder /app/dist ./dist

# Exécuter en utilisateur non-root (image node fournit l'utilisateur "node")
USER node

EXPOSE 3001

CMD ["node", "dist/server.js"]
