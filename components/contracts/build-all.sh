#!/usr/bin/env bash
# Локальная сборка всех контрактов: оборачивает build_contracts_cdt.sh в
# CDT-образ. Сам cmake/make живёт в build_contracts_cdt.sh — он же
# используется в CI (там CDT ставится из .deb, без docker), поэтому
# флаги сборки в одном месте и не разъезжаются.

mode="${1:-prod}"
BLOCKCHAIN_IMAGE="${BLOCKCHAIN_IMAGE:-dicoop/blockchain:latest}"

docker run --rm --name cdt \
  --volume "$(pwd):/project" \
  -w /project \
  "$BLOCKCHAIN_IMAGE" \
  /bin/bash -c "./build_contracts_cdt.sh $mode"
