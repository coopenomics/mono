#!/bin/bash
set -e

# Режет релиз СТРОГО на dev. Версия бампается ОДИН раз (lerna) и дальше едет
# вверх по fast-forward dev → testnet → main без повторных бампов и merge —
# отсюда ноль конфликтов (см. scripts/RELEASE.md).
#
# Сам по себе cut НЕ деплоит: CI триггерится push'ем в testnet/main, не в dev.
# Деплой запускается промоушном: scripts/promote.sh testnet → scripts/promote.sh main.

git fetch origin

# Режем от свежего origin/dev.
git checkout dev
git pull --ff-only origin dev

# Версия: vYYYY.M.D (без лидирующих нулей), для повторных релизов того же дня — суффикс -N.
BASE_VERSION="v$(date +%Y).$(date +%-m).$(date +%-d)"

MAX_SUFFIX=0
HAS_BASE=0
for TAG in $(git tag --list | grep "^$BASE_VERSION" | sort -V); do
  if [[ "$TAG" == "$BASE_VERSION" ]]; then
    HAS_BASE=1
  elif [[ "$TAG" =~ ^${BASE_VERSION}-([0-9]+)$ ]]; then
    SUFFIX="${BASH_REMATCH[1]}"
    (( SUFFIX > MAX_SUFFIX )) && MAX_SUFFIX=$SUFFIX
  fi
done

if (( HAS_BASE == 0 )) && (( MAX_SUFFIX == 0 )); then
  VERSION="$BASE_VERSION"
else
  VERSION="$BASE_VERSION-$((MAX_SUFFIX + 1))"
fi

echo "Режем релиз на dev: $VERSION"

# lerna сам бампит все package.json + lerna.json, коммитит chore(release): publish,
# вешает тег и пушит dev. Тег нужен как маркер версии и для GitHub Release —
# триггером деплоя он больше НЕ является (деплой по push в ветку).
lerna version "$VERSION" --yes --no-push=false --no-git-tag-version=false --force-publish

echo
echo "Готово. Версия $VERSION закоммичена на dev."
echo "Дальше: scripts/promote.sh testnet   (staging-деплой)"
echo "потом:  scripts/promote.sh main       (production-деплой + npm publish + доки)"
