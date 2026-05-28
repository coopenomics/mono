import { SovietContract, WalletContract } from 'cooptypes'
import { getTotalRamUsage } from '../utils/getTotalRamUsage'

async function getCoopProgramWallet(blockchain: any, coopname: string, program_id: number) {
  const program = await blockchain.getTableRows(
    SovietContract.contractName.production,
    coopname,
    'programs',
    1000,
    program_id.toString(),
    program_id.toString(),
  )

  return program[0]
}

interface UserProgramAgreement {
  program_id: number | string
  doc_hash: string
  version: number | string
  draft_id: number | string
  signed_at: string
}

interface WalletUserRecord {
  username: string
  programs: UserProgramAgreement[]
}

// Подписание программного соглашения через `wallet::signagree` (ADR-008, Эпик 2).
// После компонента 48 `soviet::sndagreement` отказывается на program_id > 0 —
// программные соглашения переехали в контракт wallet, источник правды
// «участник ЦПП X» = `wallet::users[username].programs[]`.
//
// Auth: coopname@active (или любой системный контракт из contracts_whitelist
// контракта wallet). В boot-flow ключ кооператива всегда есть в keychain,
// подписываем coopname'ом.
//
// Живёт в init/, а не в tests/, чтобы не тянуть vitest в production-цепочке
// `boot → init/cooperative → init/participant`. Тесты реэкспортируют отсюда.
export async function signProgramAgreement(
  blockchain: any,
  coopname: string,
  username: string,
  program_id: number,
  draft_id: number,
  document: any,
) {
  const data: WalletContract.Actions.SignAgreement.ISignAgreement = {
    coopname,
    username,
    program_id,
    document,
    draft_id,
  }

  const result = await blockchain.api.transact(
    {
      actions: [
        {
          account: WalletContract.contractName.production,
          name: WalletContract.Actions.SignAgreement.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data,
        },
      ],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )

  getTotalRamUsage(result)
  if (!result.transaction_id)
    throw new Error('wallet::signagree не вернул transaction_id')

  const userRows = await blockchain.getTableRows(
    WalletContract.contractName.production,
    coopname,
    WalletContract.Tables.Users.tableName,
    1000,
  ) as WalletUserRecord[]

  const userRecord = userRows.find(r => r.username === username)
  if (!userRecord)
    throw new Error(`wallet::users[${coopname}, ${username}] должен быть создан после signagree`)

  const signedProgram = userRecord.programs.find(p => Number(p.program_id) === program_id)
  if (!signedProgram)
    throw new Error(`wallet::users[${username}].programs[] должен содержать program_id=${program_id}`)

  const program = await getCoopProgramWallet(blockchain, coopname, program_id)
  if (!program)
    throw new Error(`soviet::programs[${coopname}, ${program_id}] должна существовать`)

  return {
    txId: result.transaction_id,
    wallet: { username, ...signedProgram },
    program,
  }
}
