#!/usr/bin/env bash
# Дифференциальный ярус проверок: правила канона применяются ТОЛЬКО к файлам,
# которые изменены относительно базовой ветки.
#
# Почему так, а не на всю базу. Замер на текущем коде:
#   complexity>10 / функция>60 строк / вложенность>4 — 119 файлов из 1930 в controller,
#   66 из 1283 в desktop; прямые q-* вне shared/ui — 136 файлов из 229.
# Чинить это разом никто не будет, а как гейт «только на изменённое» оно
# не стоит ни часа: старый код не трогаем, новый писать плохо нельзя.
#
# Сравнение — храповиком (scripts/lib/lint-ratchet.mjs): для каждого файла
# берётся его версия из базы, и вердикт роняет только РОСТ числа нарушений.
# Пофайловая проверка «файл обязан быть чист целиком» на легаси требовала
# несвязанного рефакторинга при любой правке — такой гейт обходят.
# Для нового файла база пуста, поэтому правило работает в полную силу.
#
# База сравнения: $CHECK_BASE (по умолчанию origin/dev -> dev -> origin/main -> main).

# Намеренно БЕЗ pipefail — см. комментарий в check.sh: вердикт в конвейере
# `eslint | eslint-gate.mjs` выносит фильтр, а не код возврата eslint.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

GATE="$REPO_ROOT/scripts/lib/eslint-gate.mjs"
RATCHET="$REPO_ROOT/scripts/lib/lint-ratchet.mjs"

# --- база сравнения --------------------------------------------------------
BASE="${CHECK_BASE:-}"
if [ -z "$BASE" ]; then
  for candidate in origin/dev dev origin/main main; do
    if git rev-parse --verify --quiet "$candidate" >/dev/null 2>&1; then
      BASE="$candidate"
      break
    fi
  done
fi

if [ -n "$BASE" ]; then
  MERGE_BASE="$(git merge-base HEAD "$BASE" 2>/dev/null || true)"
else
  MERGE_BASE=""
fi

if [ -n "$MERGE_BASE" ]; then
  DIFF_FROM="$MERGE_BASE"
  echo "  база сравнения: $BASE ($(git rev-parse --short "$MERGE_BASE"))"
else
  DIFF_FROM="HEAD"
  echo "  база сравнения не найдена — сравниваю с HEAD"
fi

CHANGED="$(
  {
    git diff --name-only --diff-filter=ACMR "$DIFF_FROM" 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null
  } | sort -u
)"

if [ -z "$CHANGED" ]; then
  echo "  изменённых файлов нет — проверять нечего"
  exit 0
fi

STATUS=0

# --- controller: сложность, размер функций, вложенность, статус-enum -------
CTRL_FILES="$(echo "$CHANGED" \
  | grep -E '^components/controller/src/.*\.ts$' \
  | grep -vE '\.(spec|test)\.ts$' \
  | sed 's|^components/controller/||' || true)"

if [ -n "$CTRL_FILES" ]; then
  echo "  controller: $(echo "$CTRL_FILES" | wc -l | tr -d ' ') файл(ов)"
  echo "$CTRL_FILES" | node "$RATCHET" components/controller components/controller "$DIFF_FROM" '{
      "complexity": ["error", 10],
      "max-depth": ["error", 4],
      "max-lines-per-function": ["error", {"max": 60, "skipBlankLines": true, "skipComments": true}],
      "no-restricted-syntax": ["error",
        {"selector": "PropertyDefinition[key.name=/^(status|state)$/] > TSTypeAnnotation > TSStringKeyword",
         "message": "Статус — enum (registerEnumType -> Zeus -> фронт), не string."},
        {"selector": "TSPropertySignature[key.name=/^(status|state)$/] > TSTypeAnnotation > TSStringKeyword",
         "message": "Статус — enum (registerEnumType -> Zeus -> фронт), не string."}
      ]
    }' complexity max-depth max-lines-per-function no-restricted-syntax || STATUS=1
fi

# --- desktop: то же + канон вёрстки ----------------------------------------
# shared/ui/** исключён: обёртки канона обязаны использовать q-* внутри себя.
# pages/_dev/** исключён: это витрина канона, она демонстрирует компоненты.
DESK_FILES="$(echo "$CHANGED" \
  | grep -E '^components/desktop/(src|extensions)/.*\.(ts|vue)$' \
  | grep -vE '^components/desktop/src/shared/ui/' \
  | grep -vE '^components/desktop/src/pages/_dev/' \
  | grep -vE '\.(spec|test)\.ts$' \
  | sed 's|^components/desktop/||' || true)"

if [ -n "$DESK_FILES" ]; then
  echo "  desktop: $(echo "$DESK_FILES" | wc -l | tr -d ' ') файл(ов)"
  echo "$DESK_FILES" | node "$RATCHET" components/desktop components/desktop "$DIFF_FROM" '{
      "complexity": ["error", 10],
      "max-depth": ["error", 4],
      "max-lines-per-function": ["error", {"max": 60, "skipBlankLines": true, "skipComments": true}],
      "vue/no-restricted-html-elements": ["error",
        {"element": "q-btn",      "message": "Канон: BaseButton из shared/ui/base."},
        {"element": "q-input",    "message": "Канон: BaseInput из shared/ui/base."},
        {"element": "q-select",   "message": "Канон: BaseSelect из shared/ui/base."},
        {"element": "q-card",     "message": "Канон: BaseCard из shared/ui/base."},
        {"element": "q-table",    "message": "Канон: BaseTable из shared/ui/base."},
        {"element": "q-chip",     "message": "Канон: BaseChip из shared/ui/base."},
        {"element": "q-badge",    "message": "Канон: BaseBadge из shared/ui/base."},
        {"element": "q-dialog",   "message": "Канон: BaseDialog из shared/ui/base."},
        {"element": "q-banner",   "message": "Канон: BaseBanner из shared/ui/base."},
        {"element": "q-checkbox", "message": "Канон: BaseCheckbox из shared/ui/base."}
      ]
    }' complexity max-depth max-lines-per-function vue/no-restricted-html-elements || STATUS=1
fi

if [ -z "$CTRL_FILES" ] && [ -z "$DESK_FILES" ]; then
  echo "  среди изменённых нет файлов controller/desktop — проверять нечего"
fi

exit $STATUS
