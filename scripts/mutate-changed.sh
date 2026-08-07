#!/usr/bin/env bash
# Проверка добросовестности тестов мутациями — по ИЗМЕНЁННЫМ файлам.
#
# Зачем это отдельно от остальных гейтов. Границы, канон и реестр защищают от
# забывчивости: не дают забыть про правило или не записать сценарий. Ни один из
# них не отличает работающий тест от написанного «чтобы позеленело» — оба
# зелёные. Мутатор портит исходник (`>` на `>=`, `&&` на `||`, выкидывает
# строку) и смотрит, покраснеет ли тест. Не покраснел — тест ничего не
# проверяет, сколько бы ассертов в нём ни было.
#
# Только по изменённым файлам: полный прогон по 1930 файлам controller'а
# занял бы часы и потому не запускался бы никогда.
#
# Использование:
#   pnpm mutate:changed                     по diff с базовой веткой
#   CHECK_BASE=origin/dev pnpm mutate:changed
#   pnpm mutate:changed <файл> [<файл>...]  по явному списку

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

if [ "$#" -gt 0 ]; then
  FILES="$*"
else
  BASE="${CHECK_BASE:-}"
  if [ -z "$BASE" ]; then
    for candidate in origin/dev dev origin/main main; do
      if git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
        BASE="$candidate"
        break
      fi
    done
  fi
  MERGE_BASE="$(git merge-base HEAD "$BASE" 2>/dev/null || true)"
  DIFF_FROM="${MERGE_BASE:-HEAD}"

  FILES="$(
    {
      git diff --name-only --diff-filter=ACMR "$DIFF_FROM" 2>/dev/null
      git ls-files --others --exclude-standard 2>/dev/null
    } | sort -u \
      | grep -E '^components/controller/src/.*\.ts$' \
      | grep -vE '\.(spec|test)\.ts$' \
      | grep -vE '\.(module|dto|entity)\.ts$' \
      | sed 's|^components/controller/||' \
      | tr '\n' ',' | sed 's/,$//'
  )"
fi

if [ -z "$FILES" ]; then
  echo "  изменённых исходников controller нет — мутировать нечего"
  exit 0
fi

echo "  мутируем: $FILES"
echo "  (модули, DTO и сущности исключены — в них нет логики, только проводка)"

cd components/controller || exit 2
exec pnpm exec stryker run --mutate "$FILES"
