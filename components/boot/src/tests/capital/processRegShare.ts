import { expect } from 'vitest'
import { CapitalContract } from 'cooptypes'
import { getTotalRamUsage } from '../../utils/getTotalRamUsage'

/**
 * Регистрирует долю пайщика в проекте через `capital::regshare`.
 *
 * С коммита `da8c4436255` ([562-13]) regshare — отдельное действие кооператива,
 * не inline из apprvappndx. Приложение к проекту и регистрация доли теперь
 * разнесены по разным транзакциям: сначала participant подписывает appendix
 * (getclearance + apprvappndx), затем кооператив отдельным действием
 * регистрирует долю, равную балансу пайщика в целевой программе (Благорост).
 */
export async function processRegShare(
  blockchain: any,
  coopname: string,
  projectHash: string,
  username: string,
  userShares: string,
) {
  const data: CapitalContract.Actions.RegisterShare.IRegisterShare = {
    coopname,
    project_hash: projectHash,
    username,
    user_shares: userShares,
  }

  const result = await blockchain.api.transact(
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
    {
      blocksBehind: 3,
      expireSeconds: 30,
    },
  )

  getTotalRamUsage(result)
  expect(result.transaction_id).toBeDefined()
  return result
}
