#!/usr/bin/env bash

mode="${1:-prod}"

if [ "$mode" = "test" ]; then
  is_testnet="ON"
else
  is_testnet="OFF"
fi

docker run --rm --name cdt \
  --volume "$(pwd):/project" \
  -w /project \
  dicoop/blockchain:latest \
  /bin/bash -c "mkdir -p build && cd build && cmake -DBUILD_TARGET= -DTEST_TARGET= -DVERBOSE=ON -DBUILD_TESTS=OFF -DIS_TESTNET=$is_testnet .. && make"
