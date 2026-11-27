#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# catalog-release.sh — один шаг CI издателя (487-27, 487-31):
#   1. обновить в package.json coopenomics.frontend.{tarball,installSha256}
#      по фактическому install.js и coopenomics.backend.image по версии пакета;
#      у изолированного фронта (coopenomics.frontend.frame) install.js —
#      описатель, скрипт собирает его из страницы приложения;
#   2. контейнерное приложение (объявлен coopenomics.backend.image): собрать
#      docker-образ и положить его в каталог — `docker push` тем же ключом;
#   3. `npm publish` в catalog-delivery каталога publisher-токеном;
#   4. `POST /v1/releases` — первый релиз пакета → модерация; следующие
#      активируются сразу и доезжают до подписчиков через on-chain setrelease,
#      пока обновление не просит у ядра новых портов и действий цепи
#      (coopenomics.ports, coopenomics.chainActions) — такое обновление
#      возвращается на модерацию.
#
# Вход (env):
#   CATALOG_URL              — catalog-delivery контура, напр. https://catalog-dev.blago.coop
#   CATALOG_PUBLISHER_TOKEN  — токен `cpt_…`, выданный со стола разработчика
#   PACKAGE_DIR              — папка пакета (default: cwd)
#   RELEASE_BRIEF            — текст для заявки (default: git log -1)
#   SKIP_RELEASE=1           — только publish, без POST /v1/releases
#   IMAGE_CONTEXT            — папка с Dockerfile бэкенда (default: backend)
#   IMAGE_SOURCE             — готовый локальный образ вместо сборки (тег или id)
#   DOCKER_BUILD_ARGS        — доп. аргументы `docker build`
#   IMAGE_PLATFORM           — платформа образа (default: linux/amd64 — узлы
#                              кооперативов; на Mac с процессором Apple образ
#                              по умолчанию собрался бы под arm64)
#                              (default: --provenance=false --sbom=false)
#   SKIP_IMAGE=1             — образ уже лежит в каталоге, не собирать и не слать
#
# Образ кладётся по адресу <хост CATALOG_URL>/<scope>/<name>:<version>; этот же
# адрес записывается в манифест, по нему образ забирают оркестраторы
# подписчиков. Тег в каталоге неизменяем: другой образ под занятой версией
# каталог отклоняет — поднимите версию пакета.
#
# Порядок «образ → npm → релиз» выбран намеренно: версия npm в каталоге
# записывается один раз, и манифест с адресом образа обязан выйти после
# того, как образ принят.
#
# Идемпотентность: повтор шага с тем же образом и той же версией проходит
# (слои уже на складе, тег совпал); если версия уже в реестре (409 от
# catalog-delivery / Nexus ALLOW_ONCE), publish считается выполненным и скрипт
# идёт к релизу; если релиз этой версии уже подан (409 RELEASE_CONFLICT) —
# выходим 0. Любой другой отказ — ненулевой код и тело ответа в stderr.
# ---------------------------------------------------------------------------
set -euo pipefail

: "${CATALOG_URL:?CATALOG_URL is required}"
: "${CATALOG_PUBLISHER_TOKEN:?CATALOG_PUBLISHER_TOKEN is required}"
PACKAGE_DIR="${PACKAGE_DIR:-$(pwd)}"
cd "$PACKAGE_DIR"
if [[ ! -f package.json ]]; then
  printf '[catalog-release] нет package.json в %s\n' "$PACKAGE_DIR" >&2
  printf '[catalog-release] запустите команду из папки приложения либо укажите её в PACKAGE_DIR\n' >&2
  exit 2
fi

CATALOG_URL="${CATALOG_URL%/}"
REGISTRY_URL="${CATALOG_URL}/registry/"
# host[:port]/path без схемы — так npm матчит _authToken по registry.
REGISTRY_KEY="${REGISTRY_URL#http://}"; REGISTRY_KEY="${REGISTRY_KEY#https://}"

PKG_NAME="$(node -p "require('./package.json').name")"
PKG_VERSION="$(node -p "require('./package.json').version")"
PKG_SCOPE="${PKG_NAME%%/*}"   # @voskhod
log() { printf '[catalog-release] %s\n' "$*" >&2; }

# Адрес образа бэкенда в каталоге: <хост каталога>/<scope>/<name>:<version>.
# Пустой — пакет без бэкенда.
REGISTRY_HOST="${REGISTRY_KEY%%/*}"
IMAGE_REF=""
if [[ -n "$(node -p "require('./package.json').coopenomics?.backend?.image || ''")" ]]; then
  IMAGE_REF="${REGISTRY_HOST}/${PKG_NAME#@}:${PKG_VERSION}"
fi

# --- 1. манифест: sha256 install.js ---------------------------------------
MAIN_FILE="$(node -p "require('./package.json').main || 'install.js'")"
# Изолированный фронт (487-18): страница приложения из coopenomics.frontend.frame
# упаковывается в описатель — данные о рабочем столе и HTML. Стол такой файл не
# выполняет, а показывает страницу в изолированной рамке. Описатель — файл
# сборки: он записывается на место MAIN_FILE перед подсчётом хэша.
FRAME_FILE="$(node -p "require('./package.json').coopenomics?.frontend?.frame || ''")"
if [[ -n "$FRAME_FILE" ]]; then
  [[ -f "$FRAME_FILE" ]] || { log "frontend FAILED: нет файла ${FRAME_FILE} из coopenomics.frontend.frame"; exit 1; }
  node - "$FRAME_FILE" "$MAIN_FILE" <<'NODE'
const fs = require('fs');
const [frameFile, mainFile] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const workspace = pkg.coopenomics.frontend.workspace ?? {};
const short = pkg.name.includes('/') ? pkg.name.split('/')[1] : pkg.name;
const descriptor = {
  coopenomicsFrontend: 'frame',
  workspace: {
    name: workspace.name ?? short,
    title: workspace.title ?? short,
    icon: workspace.icon ?? 'extension',
  },
  html: fs.readFileSync(frameFile, 'utf8'),
};
fs.writeFileSync(mainFile, JSON.stringify(descriptor) + '\n');
NODE
  log "frontend: изолированная рамка ${FRAME_FILE} → ${MAIN_FILE}"
fi
SHA=""
# Хэш считает node: утилиты sha256sum на macOS нет.
[[ -f "$MAIN_FILE" ]] && SHA="$(node -e "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.argv[1])).digest('hex'))" "$MAIN_FILE")"
node - "$PKG_NAME" "$PKG_VERSION" "$SHA" "$IMAGE_REF" <<'NODE'
const fs = require('fs');
const [name, version, sha, image] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.coopenomics ??= {};
if (sha) {
  pkg.coopenomics.frontend = {
    ...(pkg.coopenomics.frontend ?? {}),
    tarball: `${name}@${version}`,
    installSha256: sha,
  };
}
if (image) pkg.coopenomics.backend.image = image;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
NODE
[[ -n "$SHA" ]] && log "manifest: ${PKG_NAME}@${PKG_VERSION} installSha256=${SHA:0:12}…"
[[ -n "$IMAGE_REF" ]] && log "manifest: backend image ${IMAGE_REF}"

# --- 2. docker-образ бэкенда -----------------------------------------------
if [[ -n "$IMAGE_REF" && "${SKIP_IMAGE:-0}" != "1" ]]; then
  if ! docker info >/dev/null 2>&1; then
    log "image FAILED: docker не отвечает — запустите Docker Desktop (OrbStack, colima) и повторите"
    exit 1
  fi
  IMAGE_CONTEXT="${IMAGE_CONTEXT:-backend}"
  if [[ -n "${IMAGE_SOURCE:-}" ]]; then
    docker tag "$IMAGE_SOURCE" "$IMAGE_REF"
    log "image: ${IMAGE_SOURCE} → ${IMAGE_REF}"
  elif [[ -f "${IMAGE_CONTEXT}/Dockerfile" ]]; then
    log "image: docker build ${IMAGE_CONTEXT} → ${IMAGE_REF}"
    # shellcheck disable=SC2086 — аргументы сборки передаются словами
    docker build --platform "${IMAGE_PLATFORM:-linux/amd64}" ${DOCKER_BUILD_ARGS---provenance=false --sbom=false} -t "$IMAGE_REF" "$IMAGE_CONTEXT" >&2
  else
    log "image FAILED: нет ${IMAGE_CONTEXT}/Dockerfile и не задан IMAGE_SOURCE"; exit 1
  fi
  # Учётные данные docker — во временной папке: ключ издателя не остаётся
  # в ~/.docker/config.json раннера.
  DOCKER_CONFIG_DIR="$(mktemp -d)"
  trap 'rm -rf "$DOCKER_CONFIG_DIR"' EXIT
  # С временной папкой настроек docker теряет выбранный контекст (Docker
  # Desktop, OrbStack, colima) — адрес демона берётся из текущего контекста.
  if [[ -z "${DOCKER_HOST:-}" ]]; then
    DOCKER_HOST="$(docker context inspect -f '{{.Endpoints.docker.Host}}' 2>/dev/null || true)"
    [[ -n "$DOCKER_HOST" ]] && export DOCKER_HOST
  fi
  printf '%s' "$CATALOG_PUBLISHER_TOKEN" \
    | docker --config "$DOCKER_CONFIG_DIR" login "$REGISTRY_HOST" -u publisher --password-stdin >/dev/null 2>&1 \
    || { log "image FAILED: каталог отклонил ключ издателя (docker login ${REGISTRY_HOST})"; exit 1; }
  set +e
  PUSH_OUT="$(docker --config "$DOCKER_CONFIG_DIR" push "$IMAGE_REF" 2>&1)"
  PUSH_RC=$?
  set -e
  rm -rf "$DOCKER_CONFIG_DIR"; trap - EXIT
  if [[ $PUSH_RC -ne 0 ]]; then
    log "image FAILED:"; printf '%s\n' "$PUSH_OUT" | tail -5 >&2; exit $PUSH_RC
  fi
  log "image: ${IMAGE_REF} ok ($(grep -oE 'sha256:[a-f0-9]{64}' <<<"$PUSH_OUT" | tail -1 | cut -c1-19)…)"
fi

# --- 3. npm publish --------------------------------------------------------
NPMRC="$(mktemp)"
trap 'rm -f "$NPMRC"' EXIT
cat > "$NPMRC" <<RC
${PKG_SCOPE}:registry=${REGISTRY_URL}
//${REGISTRY_KEY}:_authToken=${CATALOG_PUBLISHER_TOKEN}
RC
set +e
PUBLISH_OUT="$(NPM_CONFIG_USERCONFIG="$NPMRC" npm publish --access public --ignore-scripts 2>&1)"
PUBLISH_RC=$?
set -e
if [[ $PUBLISH_RC -ne 0 ]]; then
  if grep -qiE '409|conflict|already published|cannot publish over' <<<"$PUBLISH_OUT"; then
    log "publish: ${PKG_NAME}@${PKG_VERSION} already in registry — continuing"
  else
    log "publish FAILED:"; printf '%s\n' "$PUBLISH_OUT" >&2; exit $PUBLISH_RC
  fi
else
  log "publish: ${PKG_NAME}@${PKG_VERSION} ok"
fi

[[ "${SKIP_RELEASE:-0}" == "1" ]] && { log "SKIP_RELEASE=1 — done"; exit 0; }

# --- 4. POST /v1/releases --------------------------------------------------
BRIEF="${RELEASE_BRIEF:-$(git log -1 --pretty=%s 2>/dev/null || echo "release ${PKG_VERSION}")}"
REQUEST_ID="$(node -e "process.stdout.write(require('crypto').randomUUID())")"
BODY="$(node -e 'console.log(JSON.stringify({request_id:process.argv[1],package_id:process.argv[2],version:process.argv[3],brief:process.argv[4].slice(0,2000)}))' "$REQUEST_ID" "$PKG_NAME" "$PKG_VERSION" "$BRIEF")"
RESP="$(curl -sS -w '\n%{http_code}' -X POST "${CATALOG_URL}/v1/releases" \
  -H "Authorization: Bearer ${CATALOG_PUBLISHER_TOKEN}" \
  -H 'Content-Type: application/json' --data "$BODY")"
CODE="${RESP##*$'\n'}"; RESP_BODY="${RESP%$'\n'*}"
case "$CODE" in
  202)
    OUTCOME="$(node -pe 'JSON.parse(process.argv[1]).outcome' "$RESP_BODY")"
    log "release: ${PKG_NAME}@${PKG_VERSION} → ${OUTCOME}"
    if [[ "$OUTCOME" == "queued" ]]; then
      log "waiting for moderation on the operator's developer desk: first release of the package, or the update asks for new core ports / chain actions"
    fi
    ;;
  409)
    log "release: ${PKG_NAME}@${PKG_VERSION} already submitted — nothing to do"
    ;;
  *)
    log "release FAILED (HTTP ${CODE}):"; printf '%s\n' "$RESP_BODY" >&2; exit 1
    ;;
esac
