FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json ./
RUN npm install

FROM deps AS build
RUN npm run db:generate
RUN npm run build -w @neon/dashboard

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@neon/dashboard"]
