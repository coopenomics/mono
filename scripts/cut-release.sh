#!/bin/bash
set -e

# Режет релиз на ТЕКУЩЕЙ ветке (решение ant 04.09.2026). Версия бампается ОДИН раз
# (lerna) и дальше едет вверх по fast-forward в testnet/main без повторных бампов и
# merge — отсюда ноль конфликтов (см. scripts/RELEASE.md).
#
# Раньше скрипт делал `git checkout dev` и резал строго там. Это молча уводило с
# рабочей ветки: человек резал релиз, стоя на feature-ветке, получал версию на dev, а
# следующий `promote.sh testnet` отправлял в контур HEAD — то есть dev, а не то, что
# он собирался выкатить. Теперь ветку выбирает тот, кто режет.
#
# Обычный путь остаётся прежним: режем на dev. Ветка нужна, когда на стенд надо
# выкатить feature-ветку целиком (проверка эпика в контуре до слияния).
#
# Сам по себе cut НЕ деплоит: CI триггерится push'ем в testnet/main, не в ветку.
# Деплой запускается промоушном: scripts/promote.sh testnet → scripts/promote.sh main.

git fetch origin

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Ветки окружений — цели промоушна, а не источник релиза: бамп на них разорвал бы
# fast-forward-модель (testnet и main обязаны оставаться указателями на историю веток).
case "$BRANCH" in
  HEAD)
    echo "Отсоединённый HEAD: встаньте на ветку, релиз режется на ней." >&2
    exit 1
    ;;
  testnet | main)
    echo "На ветке окружения «$BRANCH» релиз не режут — это цель промоушна." >&2
    echo "Встаньте на dev или на свою feature-ветку и повторите." >&2
    exit 1
    ;;
esac

# Незакоммиченные правки уехали бы в релизный коммит lerna незамеченными.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Есть незакоммиченные изменения — закоммитьте или спрячьте их перед нарезкой:" >&2
  git status --short --untracked-files=no >&2
  exit 1
fi

# Режем от свежей вершины: иначе lerna запушит бамп поверх устаревшей ветки и упрётся
# в non-fast-forward уже после того, как проставит тег локально.
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git pull --ff-only origin "$BRANCH"
fi

# Версия: vYYYY.M.D (без лидирующих нулей), для повторных релизов того же дня — суффикс -N.
# Суффикс считается по ВСЕМ тегам репозитория, поэтому релизы с разных веток в один день
# не сталкиваются номерами.
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

echo "Режем релиз на ветке $BRANCH: $VERSION"
if [ "$BRANCH" != "dev" ]; then
  echo "Ветка не dev — этот релиз живёт вне основной истории; в main его промоутить только осознанно."
fi

# lerna сам бампит все package.json + lerna.json, коммитит chore(release): publish,
# вешает тег и пушит текущую ветку. Тег нужен как маркер версии и для GitHub Release —
# триггером деплоя он больше НЕ является (деплой по push в ветку окружения).
lerna version "$VERSION" --yes --no-push=false --no-git-tag-version=false --force-publish

echo
echo "Готово. Версия $VERSION закоммичена на ветке $BRANCH."
echo "Дальше: scripts/promote.sh testnet   (staging-деплой)"
echo "потом:  scripts/promote.sh main       (production-деплой + npm publish + доки)"
