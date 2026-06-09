# Образ orchestrator'а (Apollo Federation Gateway + install pipeline).
# Как и остальные dev-сервисы mono: образ только готовит runtime,
# код монтируется bind-mount'ом ./:/app, команда — pnpm dev (см. compose).
FROM node:22-slim

RUN npm install -g pnpm@8.15.4

# docker CLI + compose plugin — orchestrator шеллит `docker pull` /
# `docker compose up -d <ext>` через смонтированный /var/run/docker.sock.
# Ставим из официального apt-репозитория Docker: в debian-репах есть только
# docker.io (тянет демона целиком, он тут не нужен).
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
