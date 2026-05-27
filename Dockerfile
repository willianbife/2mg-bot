FROM node:22-alpine AS deps
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

FROM node:22-alpine AS runner
WORKDIR /app
ARG APP
ENV NODE_ENV=production
COPY --from=build /app ./
CMD ["sh", "-c", "npm run start -w @neon/${APP}"]
