# Static SPA build — deploys directly to Coolify with no backend.
#
# Coolify: create an Application, source = this repository, build pack = Dockerfile,
# port = 80. Nothing else is required; there is no runtime configuration.

FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies from the lockfile only, so the layer caches across code changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# 127.0.0.1, not localhost: the name resolves to ::1 first, and a probe that
# cannot connect leaves the container permanently unhealthy — which a reverse
# proxy like Coolify's reports to the browser as 502 Bad Gateway.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
