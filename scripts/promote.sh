#!/bin/bash
set -e

# Деплой в окружение. По умолчанию летит ТЕКУЩИЙ HEAD (твой чекаут) в указанную
# ветку окружения. testnet и main независимы — каждый двигается своим темпом;
# только вперёд по fast-forward (живут на линейной истории dev → нет диверджа и
# конфликтов).
#
#   scripts/promote.sh testnet              # текущий HEAD → testnet (staging)
#   scripts/promote.sh main                 # текущий HEAD → main    (production)
#   scripts/promote.sh main v2026.6.16      # конкретную версию (тег) → main
#   scripts/promote.sh main testnet         # ровно то, что сейчас на testnet → main
#
# Деплой (release.yaml) стартует, только если в улетающем коммите есть изменение
# lerna.json (релизный бамп от scripts/cut-release.sh), которого ещё нет в целевой
# ветке. Без свежего cut ветка передвинется, но пересборки не будет.
#
# Только FF (без --force): сервер отвергнет non-fast-forward — это ГАРД, не баг
# (цель не является предком ref). Откат на старую версию / редеплой без движения
# ветки — через workflow_dispatch в release.yaml (inputs: environment + ref).

usage() { echo "Использование: $0 <testnet|main> [<ref: ветка|тег|sha, по умолчанию HEAD>]"; }

TARGET="$1"
case "$TARGET" in
  testnet | main) ;;
  *)
    usage
    exit 1
    ;;
esac

git fetch --tags --force origin

# По умолчанию — текущий HEAD. Второй аргумент: ветка (testnet/main/dev), тег или sha.
REF="${2:-HEAD}"
if [ "$REF" != "HEAD" ] && git show-ref --verify --quiet "refs/remotes/origin/$REF"; then
  SRC="origin/$REF"
else
  SRC="$REF"
fi

REF_SHA="$(git rev-parse --verify "${SRC}^{commit}")"
REF_VERSION="$(git show "${REF_SHA}:lerna.json" \
  | sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -1)"

echo "Деплой: $REF → $TARGET (версия из lerna.json: v${REF_VERSION}, коммит ${REF_SHA:0:9})"

# Server-side fast-forward: двигаем удалённый TARGET на REF. Рабочее дерево не трогаем.
# Без --force: сервер отвергнет, если это не fast-forward.
git push origin "${REF_SHA}:refs/heads/${TARGET}"

if [ "$TARGET" = "main" ]; then
  ENV_LABEL="PRODUCTION (+ npm publish + доки)"
else
  ENV_LABEL="staging/testnet"
fi

echo
echo "Готово. origin/$TARGET = $REF (v${REF_VERSION})."
echo "CI задеплоит: $ENV_LABEL (если в диапазоне есть релизный бамп lerna.json)."
