# syntax=docker/dockerfile:1

# ── Stage 1: Frontend-Build (Vite → dist/) ──────────────────────────────────
FROM node:26-slim AS build
WORKDIR /app

# pnpm bereitstellen (corepack ist in node:26-slim nicht enthalten).
RUN npm install -g pnpm@10

# Abhängigkeiten zuerst (Layer-Caching).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Quellcode kopieren und Frontend bauen (tsc -b && vite build → dist/).
COPY . .
RUN pnpm build


# ── Stage 2: Laufzeit (Node + tsx, Server liefert API + dist/) ──────────────
FROM node:26-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@10

# Abhängigkeiten installieren (frozen, ohne Lockfile-Drift). `tsx` ist als
# devDependency im Lockfile und wird zur Laufzeit für `tsx server/index.ts`
# benötigt; daher voller Install statt --prod (tsx + Deps sind klein).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Server-Code, geteilte Typen, Seed-Quelle, Build und Illustrationen kopieren.
# public/ wird benötigt, weil seed.ts die Existenz von public/illustrations/<id>.webp
# relativ zum Arbeitsverzeichnis (cwd = /app) prüft.
COPY server ./server
COPY shared ./shared
COPY src/data ./src/data
COPY --from=build /app/dist ./dist
COPY public ./public

EXPOSE 8787
CMD ["pnpm", "exec", "tsx", "server/index.ts"]
