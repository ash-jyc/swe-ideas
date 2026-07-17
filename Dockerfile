# Build stage: install everything (incl. native better-sqlite3) and build the UI.
FROM node:22-slim AS build
WORKDIR /app
# Toolchain for better-sqlite3's native addon.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY sandbox-runtime/package.json sandbox-runtime/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Runtime stage: carry the built app + installed modules (native addon already
# compiled). Generated apps resolve their deps via a symlink into these modules.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/var/data
# `ping` etc. live here; generated apps run as untrusted child processes.
COPY --from=build /app /app
RUN mkdir -p /var/data
EXPOSE 3001
CMD ["npm", "start"]
