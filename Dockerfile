# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Stage 1 — build the Angular bundle
# ---------------------------------------------------------------------------
# For production, pin to a digest in your environment:
#   docker pull node:22-alpine && docker inspect --format '{{index .RepoDigests 0}}' node:22-alpine
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies from the lockfile only (reproducible).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Source copied after deps so code changes do not bust the npm layer.
COPY tsconfig.json tsconfig.app.json tsconfig.spec.json angular.json eslint.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build:prod

# ---------------------------------------------------------------------------
# Stage 2 — static runtime (unprivileged nginx, listens on 8080 as uid 101)
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

USER root
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf /docker-entrypoint.d/*

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY docker/entrypoint.sh /usr/local/bin/sge-frontend-entrypoint
RUN chmod 0555 /usr/local/bin/sge-frontend-entrypoint \
    && chown -R nginx:nginx /usr/share/nginx/html

COPY --from=build --chown=nginx:nginx /app/dist/sge-frontend/browser /usr/share/nginx/html

USER nginx

# API upstream used by the reverse-proxy block. Point this at the backend's
# published Nginx so the browser always talks to a single origin.
ENV API_UPSTREAM="https://host.docker.internal:8443"

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/bin/sh", "-c", "wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1"]

ENTRYPOINT ["/usr/local/bin/sge-frontend-entrypoint"]
