#!/usr/bin/env bash
# Забирает отчёт замера оперативной памяти с GitHub и кладёт HTML в общую
# папку артефактов (~/shared/artifacts — S3, видна и с сервера, и с MacBook).
#
# Использование: scripts/ram-cost/pull.sh [номер прогона]
# Без номера берётся последний успешный прогон ram-cost.yaml на ci/ram-cost.
# Выход: ~/shared/artifacts/ram-cost/ram-cost-<номер>.html и latest.html.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${RAM_COST_ARTIFACTS:-$HOME/shared/artifacts/ram-cost}"
REPO=coopenomics/mono

run="${1:-}"
if [ -z "$run" ]; then
  run="$(gh run list --repo "$REPO" --workflow ram-cost.yaml --branch ci/ram-cost --status success --limit 1 --json databaseId -q '.[0].databaseId')"
fi
[ -n "$run" ] || { echo "нет успешного прогона ram-cost" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
gh run download "$run" --repo "$REPO" --name "ram-cost-$run" -D "$tmp" >/dev/null
reports="$tmp/ram-cost"
[ -d "$reports" ] || { echo "в артефакте прогона $run нет каталога ram-cost" >&2; exit 1; }

mkdir -p "$OUT_DIR"
node "$ROOT/scripts/ram-cost/report-html.mjs" "$reports" "$OUT_DIR/ram-cost-$run.html" "$run" >/dev/null
cp "$OUT_DIR/ram-cost-$run.html" "$OUT_DIR/latest.html"
node "$ROOT/scripts/ram-cost/summary.mjs" "$reports" > "$OUT_DIR/ram-cost-$run.md"
echo "$OUT_DIR/ram-cost-$run.html"
