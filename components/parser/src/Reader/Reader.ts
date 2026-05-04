import type {
  EosioReaderAbisMap,
  EosioReaderActionFilter,
  EosioReaderConfig,
  EosioReaderTableRowFilter,
  ShipTableDeltaName,
} from '@blockmatic/eosio-ship-reader'
import type { RpcInterfaces } from 'eosjs'

import {
  createEosioShipReader,
} from '@blockmatic/eosio-ship-reader'

import { eosioApi, finishBlock, shipApi, startBlock, subscribedContracts, subsribedActions } from '../config'
import type { Database } from '../Database'
import { extractTablesFromAbi, fetchAbi, getInfo } from '../Utils/Blockchain'
import { initializeFromBlockchain } from '../Initializer'

const actions_whitelist: () => EosioReaderActionFilter[] = () => subsribedActions
console.log('Actions whitelist (auto-generated from subscribedContracts):', subsribedActions)

export async function loadReader(db: Database): Promise<ReturnType<typeof createEosioShipReader>> {
  let currentBlock = await db.getCurrentBlock()

  const info = await getInfo()

  // console.log('startBlock: ', startBlock)
  // console.log('currentBlock Before: ', currentBlock)

  if (Number(startBlock) === 1) { // при 1 стартуем с head блока
    if (currentBlock === 0) {
      currentBlock = Number(info.head_block_num)

      // Передаём currentBlock в Initializer — он пишет дельты с этим же
      // block_num. Финальный purgeAfterBlock(currentBlock) использует $gt,
      // т.е. записи с block_num == currentBlock не стираются.
      // Без передачи параметра Initializer сам делал getInfo() и брал
      // head_2 (который мог быть > currentBlock), и финальный purge
      // стирал его дельты — Mongo оставалась пустой по cooperative/boards.
      await initializeFromBlockchain(db, currentBlock)
    }
    // Если currentBlock !== 0 — парсер уже работал, продолжаем с сохранённого
    // блока из БД. Финальный purge ниже подчистит orphan-записи > currentBlock
    // (нужен на случай fork/replay).
  }
  else {
    currentBlock = Number(startBlock)// при не 1 стартуем с startBlock
  }

  console.log('Стартуем с блока: ', currentBlock)
  console.log('Завершим на блоке: ', finishBlock)
  console.log('Высота цепочки: ', info.head_block_num)
  console.log('Очищаем действия и дельты после блока: ', currentBlock)

  await db.purgeAfterBlock(currentBlock)

  const unique_contract_names = [...new Set([...subscribedContracts, ...actions_whitelist().map(row => row.code)])]
  const abisArr = await Promise.all(unique_contract_names.map(account_name => fetchAbi(account_name)))
  const abiMap = new Map<string, RpcInterfaces.Abi>()
  abisArr.forEach(({ account_name, abi }) => {
    if (abi) {
      abiMap.set(account_name, abi)
    }
    else {
      console.warn(`ABI not found for ${account_name}, skipped`)
    }
  })

  const contract_abis: () => EosioReaderAbisMap = () => abiMap

  // Формируем whitelist таблиц динамически из ABI контрактов
  const table_rows_whitelist: () => EosioReaderTableRowFilter[] = () => {
    const tables: EosioReaderTableRowFilter[] = []
    abiMap.forEach((abi, account_name) => {
      if (subscribedContracts.includes(account_name)) {
        const tableNames = extractTablesFromAbi(abi)
        tableNames.forEach((tableName) => {
          tables.push({ code: account_name, table: tableName })
        })
      }
    })
    return tables
  }

  const tablesWhitelist = table_rows_whitelist()
  console.log('Tables whitelist (auto-generated from ABI):', tablesWhitelist)

  const delta_whitelist: () => ShipTableDeltaName[] = () => [
    'account_metadata',
    'contract_table',
    'contract_row',
    'contract_index64',
    'resource_usage',
    'resource_limits_state',
  ]

  const eosioReaderConfig: EosioReaderConfig = {
    ws_url: shipApi,
    rpc_url: eosioApi,
    ds_threads: 2,
    ds_experimental: false,
    delta_whitelist,
    table_rows_whitelist,
    actions_whitelist,
    contract_abis,
    request: {
      start_block_num: currentBlock,
      end_block_num: Number(finishBlock), // info.head_block_num,
      max_messages_in_flight: 50,
      have_positions: [],
      irreversible_only: true,
      fetch_block: true,
      fetch_traces: true,
      fetch_deltas: true,
    },
    auto_start: true,
  }

  const reader = await createEosioShipReader(eosioReaderConfig)

  // Обновляем ABI на лету при получении новых описаний от SHiP,
  // чтобы десериализация всегда использовала актуальные типы.
  // Тип события: { account_name, abi }
  // abis$ типизирован как Abi, но фактически отдаёт { account_name, abi }
  reader.abis$?.subscribe((payload: any) => {
    const { account_name, abi } = payload as { account_name: string, abi: RpcInterfaces.Abi }
    if (abi) {
      abiMap.set(account_name, abi)
      console.log('ABI updated for', account_name)
    }
  })

  return reader
}
