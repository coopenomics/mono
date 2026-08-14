#!/usr/bin/env bash
# Единая точка проверки кодовой базы: один прогон — один вердикт (exit 0/1).
#
# Устройство — два яруса, по-разному строгих:
#
#   Ярус A «границы» — на всю кодовую базу, жёстко.
#     Сюда попадают только правила, которых код УЖЕ придерживается
#     (нарушений ноль), поэтому включение ничего не ломает и ничего не требует
#     чинить. Сегодня это архитектурные границы: ядро не знает про расширения,
#     расширения не ходят друг в друга и в ядро напрямую — только через порты
#     @coopenomics/innercoop (статические импорты ловит eslint, динамические и
#     относительные пути — check-extension-boundaries.mjs); и
#     согласованность реестров имён процессов ledger2 между контрактом,
#     cooptypes и локатором бэкенда (см. check-ledger2-processes.mjs).
#
#   Ярус B «канон» — только на изменённые файлы, храповиком.
#     Правила, которым старый код массово не соответствует (сложность, размер
#     функций, прямые q-* вместо обёрток канона). Разовая зачистка 185 файлов
#     не нужна: гейт смотрит ровно то, что тронуто в текущей ветке.
#     Сравнение идёт с версией файла из базы, и вердикт роняет только РОСТ
#     числа нарушений. Прежняя пофайловая проверка требовала, чтобы тронутый
#     файл был чист целиком, — на легаси это означало несвязанный рефакторинг
#     при любой правке, и такой гейт обходят. Для нового файла база пуста,
#     поэтому правило работает в полную силу. См. scripts/lib/lint-ratchet.mjs.
#
#   Ярус C «реестр тестов» — на изменённые файлы.
#     Тронул код уже зарегистрированной фичи — обнови её файл в test-registry/.
#     Области, ещё не заведённые в реестр, показываются как долг и вердикт не
#     роняют: реестр наполняется постепенно, а блокировка здесь заставила бы
#     заводить фичи формально, лишь бы прошло. Объём долга — `pnpm registry:audit`.
#
# Прочие накопленные ошибки линта показываются как долг и вердикт не роняют —
# гейт падает только от того, что объявлено гейтом.
#
# Чего эти гейты НЕ делают: они защищают от забывчивости, а не от халтуры.
# Тест, написанный «чтобы позеленело», пройдёт их все. От этого защищает
# только мутационное тестирование — `pnpm mutate:changed`.
#
# Использование:
#   pnpm check                      всё
#   pnpm check:boundaries           только ярус A
#   pnpm check:ledger2              только реестры процессов ledger2
#   pnpm check:changed              ярусы B и C
#   pnpm check:registry             только ярус C
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

gate_extension_boundaries() {
  node "$REPO_ROOT/scripts/check-extension-boundaries.mjs"
}

gate_changed() {
  bash "$REPO_ROOT/scripts/lint-changed.sh"
}

gate_registry() {
  node "$REPO_ROOT/scripts/check-registry.mjs"
}

gate_ledger2_processes() {
  node "$REPO_ROOT/scripts/check-ledger2-processes.mjs"
}

gate_unit_tests() {
  pnpm run test:unit
}

case "$MODE" in
  boundaries)
    run_gate "границы: controller" gate_boundaries_controller
    run_gate "границы: расширения (динамика и относительные пути)" gate_extension_boundaries
    run_gate "границы: desktop" gate_boundaries_desktop
    run_gate "реестры процессов ledger2" gate_ledger2_processes
    ;;
  ledger2)
    run_gate "реестры процессов ledger2" gate_ledger2_processes
    ;;
  changed)
    run_gate "канон: изменённые файлы" gate_changed
    run_gate "реестр тестов" gate_registry
    ;;
  registry)
    run_gate "реестр тестов" gate_registry
    ;;
  all)
    run_gate "границы: controller" gate_boundaries_controller
    run_gate "границы: расширения (динамика и относительные пути)" gate_extension_boundaries
    run_gate "границы: desktop" gate_boundaries_desktop
    run_gate "реестры процессов ledger2" gate_ledger2_processes
    run_gate "канон: изменённые файлы" gate_changed
    run_gate "реестр тестов" gate_registry
    # Тесты по умолчанию ВЫКЛЮЧЕНЫ намеренно: CLAUDE.md запрещает гонять
    # полный набор локально — живой dev-стек в docker вешает CPU/RAM.
    # В CI и вручную — CHECK_WITH_TESTS=1 pnpm check.
    if [ "${CHECK_WITH_TESTS:-0}" = "1" ]; then
      run_gate "тесты: unit" gate_unit_tests
    fi
    ;;
  *)
    echo "неизвестный режим: $MODE (ожидается all | boundaries | changed | registry | ledger2)" >&2
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
