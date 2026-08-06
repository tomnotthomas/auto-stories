# Auto Stories — single Linux container for the whole app.
#
# One Node process serves it all: the NestJS API under /api (and /healthz), the
# marketing landing page at /, and the built Angular product flow under /app (see
# apps/api/src/app.module.ts, which mounts ServeStaticModule at LANDING_ROOT and
# WEB_ROOT). The landing page ships as its committed, self-contained index.html —
# its authoring build (apps/landing/build.py) is a local-only step, not run here.
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
COPY apps/landing/package.json apps/landing/
COPY packages/api-types/package.json packages/api-types/
RUN npm ci

# Build both apps, then strip devDependencies so only runtime deps ship. The
# Angular app is served under /app, so it must be built with that base href for
# its asset URLs to resolve. The landing page needs no build — its committed
# index.html is already self-contained.
COPY . .
RUN npm run build -w web -- --base-href /app/ \
  && npm run build -w @auto-stories/api \
  && npm prune --omit=dev

# ---- Stage 2: lean runtime image ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    # Where the compiled server finds the built Angular app to serve at /app.
    WEB_ROOT=/app/apps/web/dist/web/browser \
    # …and the self-contained landing page to serve at the site root.
    LANDING_ROOT=/app/apps/landing
WORKDIR /app

# Bring over prod node_modules, the compiled API, and the web build. The layout
# mirrors the repo so workspace module resolution just works.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist
# The landing page and the legal pages are each one self-contained file; ship
# just those so LANDING_ROOT holds only what is served. They are named
# individually rather than copied as a directory so the authoring sources
# (page.html, *.page.html, assets/) never reach the runtime image.
COPY --from=builder /app/apps/landing/index.html ./apps/landing/index.html
COPY --from=builder /app/apps/landing/privacy.html ./apps/landing/privacy.html
COPY --from=builder /app/apps/landing/imprint.html ./apps/landing/imprint.html

# Run unprivileged; the `node` user ships with the base image.
USER node
WORKDIR /app/apps/api
EXPOSE 3000

# Liveness matches the app's own probe; no curl needed in the image.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
