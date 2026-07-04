# Auto Stories — single Linux container for the whole app.
#
# One Node process serves both halves: the NestJS API under /api (and /healthz),
# and the built Angular app as static files for everything else (see
# apps/api/src/app.module.ts, which mounts ServeStaticModule at WEB_ROOT).
#
#   docker build -t auto-stories .
#   docker run --rm -p 3000:3000 --env-file .env auto-stories
#   # open http://localhost:3000

# ---- Stage 1: build the web app and the API, then drop dev dependencies ----
FROM node:22-slim AS builder
WORKDIR /app

# Install against the lockfile first so this layer caches until deps change.
# Every workspace manifest is needed for `npm ci` to resolve the workspaces.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/api-types/package.json packages/api-types/
RUN npm ci

# Build both apps, then strip devDependencies so only runtime deps ship.
COPY . .
RUN npm run build -w web \
  && npm run build -w @auto-stories/api \
  && npm prune --omit=dev

# ---- Stage 2: lean runtime image ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    # Where the compiled server finds the built Angular app to serve.
    WEB_ROOT=/app/apps/web/dist/web/browser
WORKDIR /app

# Bring over prod node_modules, the compiled API, and the web build. The layout
# mirrors the repo so workspace module resolution just works.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Run unprivileged; the `node` user ships with the base image.
USER node
WORKDIR /app/apps/api
EXPOSE 3000

# Liveness matches the app's own probe; no curl needed in the image.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
