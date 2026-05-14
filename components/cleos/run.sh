docker run --rm -it --name cleos \
  --volume ./eosio-wallet:/root/eosio-wallet \
  --volume ./scripts:/root/scripts \
  -w /root/scripts \
  dicoop/blockchain:latest /bin/bash

