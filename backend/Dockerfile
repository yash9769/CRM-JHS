FROM node:20-alpine AS builder

WORKDIR /app

# Native build tools for compiling argon2's bindings, plus openssl so `prisma generate`
# below detects the same libssl version that's installed in the runner stage (without
# it, Prisma guesses a default at generate time that doesn't match the runner's actual
# openssl, and the built engine binary can't load at runtime).
RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

COPY src ./src

RUN npx prisma generate
RUN npm run build

# ---------- Production runner ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Prisma's query engine needs openssl at runtime on Alpine.
RUN apk add --no-cache openssl

# Full node_modules from the builder stage (not a fresh `npm ci --omit=dev`) — the
# `prisma` CLI is a devDependency, but the start command below needs it at runtime to
# run migrations, and argon2's native binding is already built for this exact base image.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 4000

# Applies any pending migrations, then starts the API. One process, one container.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
