#!/usr/bin/env bash
# Связка двух локальных кооперативов одной командой (487-34):
#   pnpm run reboot:extra2coop                       (ведомый — ~/mono-ai-4)
#   SLAVE_DIR=../mono-ai-1 pnpm run reboot:extra2coop
#
# Запускается в чекауте ведущего (voskhod). По очереди: ведущий
# (two_coop_master.sh), затем ведомый partner1 в своём чекауте
# (two_coop_slave.sh). Параллельно нельзя: ведомому нужны готовая цепь
# ведущего и провайдер, знающий partner1, а две компиляции контроллера разом
# сервер не держит.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MASTER_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SLAVE_DIR="$(cd "${SLAVE_DIR:-$MASTER_ROOT/../mono-ai-4}" && pwd)" || {
  echo "✗ Чекаут ведомого не найден: SLAVE_DIR=<чекаут ведомого>"
  exit 1
}
if [ "$SLAVE_DIR" = "$MASTER_ROOT" ]; then
  echo "✗ Ведомый и ведущий — один чекаут. SLAVE_DIR должен указывать на другой."
  exit 1
fi
if [ "$(git -C "$SLAVE_DIR" rev-parse HEAD)" != "$(git -C "$MASTER_ROOT" rev-parse HEAD)" ]; then
  echo "⚠ Ведомый ($SLAVE_DIR) не на том же коммите, что ведущий: узлы связки работают на разном коде."
fi

bash "$SCRIPT_DIR/two_coop_master.sh" || exit 1
(cd "$SLAVE_DIR" && MASTER_DIR="$MASTER_ROOT" pnpm run reboot:extra2coop:slave) || exit 1

echo
echo "Связка готова. Проверка полного пути: pnpm run test:two-coop"
