#!/bin/sh
# Entrypoint образа dicoop/contracts.
# Команды:
#   copy [<name>]   — копировать в $OUT_DIR (по умолчанию /out):
#                     без имени  — всё дерево /contracts;
#                     с именем   — только /contracts/<name>/.
#   manifest        — вывести manifest.json в stdout.
#   sha256 [<name>] — sha256 wasm/abi для всех или одного контракта.
#   ls [<name>]     — листинг /contracts (рекурсивно для всего, или один).
#   list            — печать имён контрактов через newline (для скриптов).
#
# Default: copy (всё дерево).
set -eu

cmd="${1:-copy}"
shift || true

list_names() {
  # Имена контрактов = имена subdirectories в /contracts.
  for d in /contracts/*/; do
    [ -d "$d" ] || continue
    basename "$d"
  done
}

assert_contract() {
  name="$1"
  if [ ! -d "/contracts/$name" ]; then
    echo "Контракт '$name' не найден в образе. Доступные:" >&2
    list_names >&2
    exit 65
  fi
}

case "$cmd" in
  copy)
    DEST="${OUT_DIR:-/out}"
    mkdir -p "$DEST"
    if [ $# -ge 1 ]; then
      name="$1"
      assert_contract "$name"
      mkdir -p "$DEST/$name"
      cp /contracts/"$name"/*.wasm "$DEST/$name/" 2>/dev/null || true
      cp /contracts/"$name"/*.abi  "$DEST/$name/" 2>/dev/null || true
      echo "[contracts] copied $name → $DEST/$name"
    else
      cp -R /contracts/. "$DEST/"
      echo "[contracts] copied all artifacts → $DEST"
    fi
    ls -la "$DEST" 2>/dev/null || true
    ;;
  manifest)
    cat /contracts/manifest.json
    ;;
  sha256)
    if [ $# -ge 1 ]; then
      name="$1"
      assert_contract "$name"
      sha256sum /contracts/"$name"/*.wasm /contracts/"$name"/*.abi
    else
      find /contracts -name '*.wasm' -o -name '*.abi' | sort | xargs sha256sum
    fi
    ;;
  ls)
    if [ $# -ge 1 ]; then
      name="$1"
      assert_contract "$name"
      ls -la /contracts/"$name"/
    else
      ls -la /contracts/
      echo "---"
      find /contracts -mindepth 2 -maxdepth 2 | sort
    fi
    ;;
  list)
    list_names
    ;;
  *)
    cat >&2 <<EOF
Usage: docker run --rm dicoop/contracts <cmd> [name]

Commands:
  copy [<name>]    Copy all contracts (or one) to \$OUT_DIR (default: /out).
  manifest         Print manifest.json (list of contracts, sha256, build mode).
  sha256 [<name>]  sha256 of wasm/abi (all or one contract).
  ls [<name>]      List directory contents.
  list             Print contract names, one per line.
EOF
    exit 64
    ;;
esac
