FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL is intentionally left unset here — nginx.conf proxies /api/ to the
# backend container internally, so the SPA can call same-origin relative paths
# (see src/lib/api.ts's fallback to "/api/v1") and never needs a build-time API host.
RUN npm run build

# ---------- Production nginx image ----------
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
