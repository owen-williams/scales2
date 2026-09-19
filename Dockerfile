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

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
