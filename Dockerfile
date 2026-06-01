FROM node:22-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json ./
RUN npm install

FROM deps AS build
ARG APP
RUN npm run db:generate
RUN npm run build -w @neon/core
RUN npm run build -w @neon/database
RUN npm run build -w @neon/${APP}

FROM node:22-slim AS runner
WORKDIR /app
ARG APP
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json ./
RUN npm ci --omit=dev

COPY --from=build /app/apps/${APP}/dist ./apps/${APP}/dist
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/database/prisma ./packages/database/prisma

CMD ["sh", "-c", "npx prisma migrate deploy --schema packages/database/prisma/schema.prisma && npm run start -w @neon/${APP}"]
