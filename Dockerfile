# Production image for ParcelWatch.
# The SAME image runs the web server (`npm run start`) and the watch worker
# (`npm run worker:prod`) — the deploy/docker-compose.yml picks the command.
#
# We keep the full dependency tree (incl. tsx + drizzle-kit) because the worker
# runs TypeScript via tsx and migrations run drizzle-kit. On a single Lightsail
# box, image size is not a concern; simplicity and "it just works" are.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# A dummy DATABASE_URL lets the Next build evaluate server modules (auth.ts
# constructs the DB client at import) without a live database — no queries run
# at build time for the dynamic routes.
RUN DATABASE_URL="postgres://build:build@localhost:5432/build" \
    AUTH_SECRET="build-time-placeholder" \
    npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
