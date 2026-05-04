#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <contract> [mode]"
  echo "  mode: prod (default) or test"
  exit 1
fi

contract="${contract:-$1}"
mode="${mode:-${2:-prod}}"

if [ "$mode" = "test" ]; then
  is_testnet="ON"
else
  is_testnet="OFF"
fi

docker run --rm --name cdt \
  --volume "$(pwd)/:/project" \
  -w /project/build \
  dicoop/blockchain:latest \
  /bin/bash -c "cmake -DBUILD_TARGET='$contract' -DTEST_TARGET= -DVERBOSE=ON -DBUILD_TESTS=OFF -DIS_TESTNET=$is_testnet .. && make"

