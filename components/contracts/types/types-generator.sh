#!/bin/zsh

declare -A contract_params_test=(
  [gateway]="gateway"
  [draft]="draft"
  [marketplace]="marketplace"
  [edubridge]="edubridge"
  [soviet]="soviet"
  [registrator]="registrator"
  [fund]="fund"
  [branch]="branch"
  [capital]="capital"
  [wallet]="wallet"
  [loan]="loan"
  [meet]="meet"
  [ledger]="ledger"
)

NODE_URL="http://127.0.0.1:8888"

rm -rf ./generated/*

for contract in "${(@k)contract_params_test}"; do
  abi_contract="${contract_params_test[$contract]}"
  curl -s -X POST "$NODE_URL/v1/chain/get_abi" \
    -H "Content-Type: application/json" \
    -d "{\"account_name\": \"$abi_contract\"}" \
  | jq '.abi' \
  | eosio-abi2ts -e "./generated/${contract}.ts" -p I -n 2
done
