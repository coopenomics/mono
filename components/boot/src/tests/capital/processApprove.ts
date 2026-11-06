import { expect } from 'vitest'
import { SovietContract } from 'cooptypes'
import { getTotalRamUsage } from '../../utils/getTotalRamUsage'
import { fakeDocument } from '../shared/fakeDocument'

/**
 * Председатель `ant` подтверждает одобрение. Документ по умолчанию — фикстура
 * с одной подписью председателя; двухподписной акт (вторая подпись поверх
 * подписи пайщика) передаётся явно в `approvedDocument`.
 */
export async function processApprove(blockchain: any, coopname: string, approvalHash: string, approvedDocument?: any) {
  fakeDocument.signatures[0].signer = 'ant'

  const data: SovietContract.Actions.Approves.ConfirmApprove.IConfirmApprove = {
    coopname,
    username: 'ant',
    approval_hash: approvalHash,
    approved_document: approvedDocument ?? fakeDocument,
  }

  const result = await blockchain.api.transact(
    {
      actions: [
        {
          account: SovietContract.contractName.production,
          name: SovietContract.Actions.Approves.ConfirmApprove.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data,
        },
      ],
    },
    {
      blocksBehind: 3,
      expireSeconds: 30,
    },
  )

  getTotalRamUsage(result)
  expect(result.transaction_id).toBeDefined()

  return result
}
