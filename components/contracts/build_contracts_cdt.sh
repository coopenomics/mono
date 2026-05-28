#!/usr/bin/env bash
# Компиляция всех контрактов кооперативной экономики через CDT.
#
# ВАЖНО: скрипт запускается УЖЕ внутри окружения с установленным CDT —
# тулчейн ожидается по пути /cdt/build/lib/cmake/cdt/CDTWasmToolchain.cmake
# (он захардкожен в CMakeLists.txt). Здесь НЕТ docker — только cmake/make.
#
# Два способа подготовить это окружение:
#   - локально:  build-all.sh оборачивает скрипт в `docker run dicoop/blockchain:latest`
#                (в образе CDT уже лежит в /cdt/build);
#   - в CI:      CDT ставится из .deb (C9S/cdt), а /cdt/build симлинкуется на
#                /usr/opt/cdt/<ver> (см. .github/workflows/release.yaml).
#
# Один источник cmake-флагов для обоих путей — чтобы локальная и CI-сборка
# не разъезжались.
set -euo pipefail

mode="${1:-prod}"
if [ "$mode" = "test" ]; then
  is_testnet="ON"
else
  is_testnet="OFF"
fi

mkdir -p build
cd build
cmake -DBUILD_TARGET= -DTEST_TARGET= -DVERBOSE=ON -DBUILD_TESTS=OFF -DIS_TESTNET="$is_testnet" ..
make
