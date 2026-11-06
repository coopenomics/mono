import { expect } from 'vitest'
import { CapitalContract } from 'cooptypes'
import type Blockchain from '../../blockchain'
import { getTotalRamUsage } from '../../utils/getTotalRamUsage'
import { getCoopProgramWallet, getLedgerAccountById } from '../wallet/walletUtils'
import { processLastDecision } from '../soviet/processLastDecision'
import { setDocumentSignatures } from '../../utils/setDocumentSignatures'
import { generateRandomSHA256 } from '../../utils/randomHash'
import { processApprove } from './processApprove'
import { capitalProgramId, circulationAccountId } from './consts'
import { getContributor } from './programInvest'

/** Транзакция действия capital от имени кооператива. */
async function transactCapital(blockchain: Blockchain, coopname: string, name: string, data: any) {
  const tx = await blockchain.api.transact(
    {
      actions: [
        {
          account: CapitalContract.contractName.production,
          name,
          authorization: [{ actor: coopname, permission: 'active' }],
          data,
        },
      ],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
  getTotalRamUsage(tx)
  expect(tx.transaction_id).toBeDefined()
  return tx
}

/**
 * Подставной документ со своим хэшем: одобрение председателя заводится под
 * хэшем одобряемого документа, и у заявления и акта хэши должны различаться.
 */
export function documentWithHash(hash: string, signers: string[]) {
  return { ...setDocumentSignatures(signers), hash }
}

/**
 * Шаг 1: пайщик подаёт заявление — оно подписано им самим, контракт сверяет
 * подписанта. Возвращает хэш заявления — ключ одобрения председателя.
 */
export async function submitProgramPropertyStatement(
  blockchain: Blockchain,
  data: CapitalContract.Actions.CreateProgramProperty.ICreateProgramProperty,
) {
  const statementHash = generateRandomSHA256()
  const tx = await transactCapital(blockchain, data.coopname, CapitalContract.Actions.CreateProgramProperty.actionName, {
    ...data,
    statement: documentWithHash(statementHash, [data.username]),
  })
  return { tx, statementHash }
}

/** Шаги 2–3: председатель одобряет заявление (ключ — хэш заявления), совет принимает решение. */
export async function authorizeProgramProperty(blockchain: Blockchain, coopname: string, statementHash: string) {
  await processApprove(blockchain as any, coopname, statementHash)
  await processLastDecision(blockchain, coopname)
}

/**
 * Шаг 4: пайщик подписывает акт, контракт ставит председателю запрос
 * одобрения акта. Возвращает хэш акта — ключ этого одобрения.
 */
export async function signProgramPropertyAct1(blockchain: Blockchain, coopname: string, username: string, property_hash: string) {
  const actHash = generateRandomSHA256()
  const data: CapitalContract.Actions.Act1ProgramProperty.IAct1ProgramProperty = {
    coopname,
    username,
    property_hash,
    act: documentWithHash(actHash, [username]) as any,
  }
  const tx = await transactCapital(blockchain, coopname, CapitalContract.Actions.Act1ProgramProperty.actionName, data)
  return { tx, actHash }
}

/** Строка предложения в цепи по hash; после приёма или отказа строки нет. */
export async function getProgramProperty(blockchain: Blockchain, coopname: string, property_hash: string) {
  const rows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    CapitalContract.Tables.ProgramProperties.tableName,
    1,
    property_hash,
    property_hash,
    3,
    'sha256',
  )
  return rows[0]
}

export async function processCreateProgramProperty(
  blockchain: Blockchain,
  data: CapitalContract.Actions.CreateProgramProperty.ICreateProgramProperty,
) {
  const { coopname, username, property_hash } = data
  const hash = property_hash as unknown as string

  // Состояния до: кошелек программы благороста, паевой счет в бухгалтерии, показатели пайщика
  const programWalletBefore = await getCoopProgramWallet(blockchain, coopname, capitalProgramId)
  const ledgerShareBefore = await getLedgerAccountById(blockchain, coopname, circulationAccountId)
  const contributorBefore = await getContributor(blockchain, username)

  const { tx: txCreate, statementHash } = await submitProgramPropertyStatement(blockchain, data)
  await authorizeProgramProperty(blockchain, coopname, statementHash)
  const { tx: txAct1, actHash } = await signProgramPropertyAct1(blockchain, coopname, username, hash)

  // Шаг 5: председатель ('ant') подтверждает одобрение акта (ключ — хэш акта);
  // совет вызывает act2pgprp с актом, подписанным пайщиком и председателем.
  const txAct2 = await processApprove(blockchain as any, coopname, actHash, documentWithHash(actHash, [username, 'ant']))

  // Состояния после
  const programWalletAfter = await getCoopProgramWallet(blockchain, coopname, capitalProgramId)
  const ledgerShareAfter = await getLedgerAccountById(blockchain, coopname, circulationAccountId)
  const contributorAfter = await getContributor(blockchain, username)

  return {
    propertyHash: property_hash,
    txCreateId: txCreate.transaction_id,
    txAct1Id: txAct1.transaction_id,
    txAct2Id: txAct2.transaction_id,
    programWalletBefore,
    programWalletAfter,
    ledgerShareBefore,
    ledgerShareAfter,
    contributorBefore,
    contributorAfter,
    propertyAfter: await getProgramProperty(blockchain, coopname, hash),
  }
}
