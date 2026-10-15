import { CapitalContract } from 'cooptypes'
import type Blockchain from '../../blockchain'

/** Благорост на свежей цепи не настроен: без конфигурации кооператива проект не завести. */
export async function ensureCapitalConfigured(blockchain: Blockchain, coopname: string) {
  const state = await blockchain.getTableRows(CapitalContract.contractName.production, CapitalContract.contractName.production, 'state', 1, coopname, coopname)
  if (state.length)
    return

  const data: CapitalContract.Actions.SetConfig.ISetConfig = {
    coopname,
    config: {
      coordinator_bonus_percent: 4,
      expense_pool_percent: 100,
      coordinator_invite_validity_days: 30,
      voting_period_in_days: 7,
      authors_voting_percent: 38.2,
      creators_voting_percent: 38.2,
      energy_decay_rate_per_day: 0.11,
      level_depth_base: 1000,
      level_growth_coefficient: 1.5,
      energy_gain_coefficient: 0.01,
    },
  }
  await blockchain.api.transact(
    {
      actions: [{
        account: CapitalContract.contractName.production,
        name: CapitalContract.Actions.SetConfig.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data,
      }],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )
}
