#!/usr/bin/env bash
# Проверка типов по ТРОНУТЫМ пакетам — храповиком, как ярус B в check.sh.
#
# Зачем отдельный гейт. Ни eslint, ни `pnpm check` код не компилируют, а сборка
# пакетов (unbuild/esbuild) типы не проверяет вовсе: она их просто срезает.
# Поэтому обычная ошибка типов доезжает до стенда и падает в рантайме. Так
# 07.09.2026 дважды: фабрика собирала документ без обязательного поля модели,
# а селектор SDK спрашивал у схемы несуществующее поле. Обе — TS2322/TS2741,
# то есть ловятся компилятором за секунды.
#
# CI (`.github/workflows/typecheck.yaml`) проверяет только desktop и controller
# и только на ветках dev/testnet/main, а зеркало Gitea → GitHub обновляется раз
# в 8 часов. Для рабочего цикла это не обратная связь; отсюда локальный гейт.
#
# Храповик, а не «должно быть чисто»: boot и cooptypes несут старый долг
# (отсутствующие @types, недогенерированные интерфейсы). Требовать его разбора
# при любой правке — значит получить гейт, который обходят. Вердикт роняет
# только РОСТ числа ошибок против базы в scripts/lib/typecheck-baseline.json.
#
# Использование:
#   pnpm typecheck:changed                  тронутые пакеты
#   TYPECHECK_ALL=1 pnpm typecheck:changed  все пакеты
#   CHECK_BASE=origin/dev pnpm typecheck:changed
#
# desktop проверяется голым tsc: он не разбирает <template> и не видит типы,
# экспортируемые из .vue, — отсюда его база. Полную проверку разметки даёт
# vue-tsc, она тяжёлая и живёт в CI.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
BASELINE="$REPO_ROOT/scripts/lib/typecheck-baseline.json"

# пакет|каталог|команда
PACKAGES=(
  "cooptypes|components/cooptypes|npx tsc --noEmit"
  "factory|components/factory|npx tsc --noEmit"
  "sdk|components/sdk|npx tsc --noEmit"
  "controller|components/controller|npx tsc --noEmit"
  "boot|components/boot|npx tsc --noEmit"
  "desktop|components/desktop|npx tsc --noEmit --skipLibCheck"
)

# --- база сравнения (та же логика, что в lint-changed.sh) ------------------
BASE="${CHECK_BASE:-}"
if [ -z "$BASE" ]; then
  for candidate in origin/dev dev origin/main main; do
    if git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
      BASE="$candidate"
      break
    fi
  done
fi
MERGE_BASE=""
if [ -n "$BASE" ]; then
  MERGE_BASE="$(git merge-base HEAD "$BASE" 2>/dev/null || true)"
fi
DIFF_FROM="${MERGE_BASE:-HEAD}"

CHANGED="$(
  {
    git diff --name-only --diff-filter=ACMR "$DIFF_FROM" 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null
  } | sort -u
)"

baseline_for() {
  node -e "
    const fs=require('fs');
    let b={};
    try { b=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); } catch {}
    process.stdout.write(String(b[process.argv[2]] ?? 0));
  " "$BASELINE" "$1"
}

STATUS=0
RAN=0

for entry in "${PACKAGES[@]}"; do
  IFS='|' read -r name dir cmd <<< "$entry"

  if [ "${TYPECHECK_ALL:-}" != "1" ]; then
    echo "$CHANGED" | grep -q "^$dir/" || continue
  fi

  RAN=1
  echo "── $name"
  OUT="$( (cd "$dir" && eval "$cmd") 2>&1 )"
  COUNT="$(printf '%s\n' "$OUT" | grep -c 'error TS' || true)"
  BASE_COUNT="$(baseline_for "$name")"

  if [ "$COUNT" -gt "$BASE_COUNT" ]; then
    printf '%s\n' "$OUT" | grep 'error TS' | head -20
    echo "  ✖ ошибок $COUNT, в базе $BASE_COUNT — стало хуже"
    STATUS=1
  elif [ "$COUNT" -lt "$BASE_COUNT" ]; then
    echo "  ✔ ошибок $COUNT, в базе $BASE_COUNT — опустите базу в scripts/lib/typecheck-baseline.json"
  else
    [ "$COUNT" = "0" ] && echo "  ✔ чисто" || echo "  ✔ ошибок $COUNT — весь старый долг, роста нет"
  fi
done

if [ "$RAN" = "0" ]; then
  echo "изменений в проверяемых пакетах нет"
fi
exit $STATUS
