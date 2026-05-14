# Образ-артефакт для всей пачки контрактов кооперативной экономики.
#
# Назначение: переносить wasm/abi всех контрактов между этапами CI/CD
# и потребителями (ke-bootstrap, локальные dev-окружения, аудит).
# Сам по себе образ ничего не запускает на блокчейне — его пара —
# отдельный образ ke-bootstrap, который при старте ноды деплоит
# контракты на неё через `cleos set contract`.
#
# Содержимое:
#   /contracts/<name>/<name>.wasm
#   /contracts/<name>/<name>.abi
#   /contracts/manifest.json    — список контрактов + sha256 + build_mode
#
# Способы потребления:
#
#   1) Multi-stage в bootstrap-образе (production):
#        FROM dicoop/contracts:testnet AS contracts
#        ...
#        COPY --from=contracts /contracts /work/contracts
#
#   2) Volume-mount (debug / ad-hoc):
#        docker run --rm -v $PWD/out:/out dicoop/contracts:testnet
#        → ./out/<name>/{wasm,abi} + manifest.json
#
#   3) Точечно один контракт:
#        docker run --rm -v $PWD/out:/out dicoop/contracts:testnet copy apps
#        → ./out/apps/{wasm,abi}
#
# Сборка артефактов идёт в CI до docker build через CDT-образ
# `dicoop/blockchain_v5.1.1:dev` (см. components/contracts/build-all.sh).
# Этот Dockerfile только упаковывает результат в slim alpine.
FROM alpine:3.20

RUN mkdir -p /contracts
COPY contracts/  /contracts/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

LABEL org.opencontainers.image.title="coopenomics-contracts"
LABEL org.opencontainers.image.description="WASM+ABI артефакты всех контрактов кооперативной экономики"
LABEL org.opencontainers.image.source="https://github.com/coopenomics/mono"

ENTRYPOINT ["/entrypoint.sh"]
CMD ["copy"]
