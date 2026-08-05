#!/usr/bin/env bash
# Единая точка проверки кодовой базы: один прогон — один вердикт (exit 0/1).
#
# Устройство — два яруса, по-разному строгих:
#
#   Ярус A «границы» — на всю кодовую базу, жёстко.
#     Сюда попадают только правила, которых код УЖЕ придерживается
#     (нарушений ноль), поэтому включение ничего не ломает и ничего не требует
#     чинить. Сегодня это архитектурные границы: ядро не знает про расширения,
#     расширения не ходят друг в друга напрямую — только через inter.
#
#   Ярус B «канон» — только на изменённые файлы.
#     Правила, которым старый код массово не соответствует (сложность, размер
#     функций, прямые q-* вместо обёрток канона). Разовая зачистка 185 файлов
#     не нужна: гейт смотрит ровно то, что тронуто в текущей ветке.
#
# Прочие накопленные ошибки линта показываются как долг и вердикт не роняют —
# гейт падает только от того, что объявлено гейтом.
#
# Использование:
#   pnpm check                      всё
#   pnpm check:boundaries           только ярус A
#   pnpm check:changed              только ярус B
#   CHECK_BASE=origin/dev pnpm check   с какой веткой сравнивать ярус B
#   CHECK_WITH_TESTS=1 pnpm check      добавить юнит-тесты (по умолчанию выключены:
#                                      CLAUDE.md запрещает полный прогон локально)

# Намеренно БЕЗ pipefail: в конвейере `eslint | eslint-gate.mjs` вердикт выносит
# именно фильтр, а не eslint. eslint возвращает 1 при любой ошибке, включая
# накопленный долг вне гейта — с pipefail этот код протекал бы наружу и ронял
# гейт, который как раз обязан такой долг игнорировать.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 2

GATE="$REPO_ROOT/scripts/lib/eslint-gate.mjs"
MODE="${1:-all}"

GATE_NAMES=()
GATE_RESULTS=()
OVERALL=0

run_gate() {
  local name="$1"
  shift
  echo ""
  echo "▸ $name"
  local started
  started=$(date +%s)

  "$@"
  local code=$?

  local elapsed=$(( $(date +%s) - started ))
  GATE_NAMES+=("$name")
  if [ $code -eq 0 ]; then
    echo "  ✓ пройден (${elapsed}с)"
    GATE_RESULTS+=("ok")
  else
    echo "  ✗ ПРОВАЛЕН (${elapsed}с)"
    GATE_RESULTS+=("fail")
    OVERALL=1
  fi
}

gate_boundaries_controller() {
  ( cd components/controller && pnpm exec eslint "src/**/*.ts" -f json 2>/dev/null ) \
    | node "$GATE" no-restricted-imports
}

gate_boundaries_desktop() {
  ( cd components/desktop && pnpm exec eslint --ext .js,.ts,.vue ./src ./extensions -f json 2>/dev/null ) \
    | node "$GATE" no-restricted-imports
}

gate_changed() {
  bash "$REPO_ROOT/scripts/lint-changed.sh"
}

gate_unit_tests() {
  pnpm run test:unit
}

case "$MODE" in
  boundaries)
    run_gate "границы: controller" gate_boundaries_controller
    run_gate "границы: desktop" gate_boundaries_desktop
    ;;
  changed)
    run_gate "канон: изменённые файлы" gate_changed
    ;;
  all)
    run_gate "границы: controller" gate_boundaries_controller
    run_gate "границы: desktop" gate_boundaries_desktop
    run_gate "канон: изменённые файлы" gate_changed
    # Тесты по умолчанию ВЫКЛЮЧЕНЫ намеренно: CLAUDE.md запрещает гонять
    # полный набор локально — живой dev-стек в docker вешает CPU/RAM.
    # В CI и вручную — CHECK_WITH_TESTS=1 pnpm check.
    if [ "${CHECK_WITH_TESTS:-0}" = "1" ]; then
      run_gate "тесты: unit" gate_unit_tests
    fi
    ;;
  *)
    echo "неизвестный режим: $MODE (ожидается all | boundaries | changed)" >&2
    exit 2
    ;;
esac

echo ""
echo "─────────────────────────────────────────"
for i in "${!GATE_NAMES[@]}"; do
  if [ "${GATE_RESULTS[$i]}" = "ok" ]; then
    printf '  ✓  %s\n' "${GATE_NAMES[$i]}"
  else
    printf '  ✗  %s\n' "${GATE_NAMES[$i]}"
  fi
done
echo "─────────────────────────────────────────"

if [ $OVERALL -eq 0 ]; then
  echo "ВЕРДИКТ: чисто"
else
  echo "ВЕРДИКТ: есть нарушения"
fi

exit $OVERALL
