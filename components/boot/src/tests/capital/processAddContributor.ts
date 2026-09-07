import { expect } from 'vitest'
import { CapitalContract } from 'cooptypes'
import type Blockchain from '../../blockchain'
import { getTotalRamUsage } from '../../utils/getTotalRamUsage'
import { getSegment } from './getSegment'

export async function processAddContributor(
  blockchain: Blockchain,
  coopname: string,
  project_hash: string,
  username: string,
  user_shares: string,
) {
  // Состояние сегмента до добавления (может не существовать)
  let segmentBefore: any = null
  try {
    segmentBefore = await getSegment(blockchain, coopname, project_hash, username)
  }
  catch (error) {
    // Сегмент может не существовать - это нормально
  }

  // regshare регистрирует долю пайщика в проекте: user_shares — его баланс
  // в целевой программе (Благорост), см. processRegShare.
  const data: CapitalContract.Actions.RegisterShare.IRegisterShare = {
    coopname,
    project_hash,
    username,
    user_shares,
  }

  // Выполняем добавление участника в проект
  const txAdd = await blockchain.api.transact(
    {
      actions: [
        {
          account: CapitalContract.contractName.production,
          name: CapitalContract.Actions.RegisterShare.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data,
        },
      ],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
  getTotalRamUsage(txAdd)
  expect(txAdd.transaction_id).toBeDefined()

  // Состояние сегмента после добавления
  const segmentAfter = await getSegment(blockchain, coopname, project_hash, username)

  return {
    transactionId: txAdd.transaction_id,
    segmentBefore,
    segmentAfter,
  }
}
