# syntax=docker/dockerfile:1.7

############################
# 1. deps — full install (dev + prod) for build
############################
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

############################
# 2. build — prisma generate + tsc
############################
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node_modules/.bin/prisma generate
RUN npm run build

############################
# 3. prod-deps — slim install (prod only)
############################
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

############################
# 4. runtime — minimal image
############################
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=prod-deps /app/node_modules                         ./node_modules
COPY --from=build     /app/node_modules/.prisma                 ./node_modules/.prisma
COPY --from=build     /app/node_modules/@prisma/client          ./node_modules/@prisma/client
COPY --from=build     /app/dist                                 ./dist
COPY --from=build     /app/prisma                               ./prisma
COPY package.json ./

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 4000
CMD ["node", "dist/server.js"]
