import { SovietContract } from 'cooptypes'
import { getTotalRamUsage } from '../../utils/getTotalRamUsage'
import { fakeDocument } from '../shared/fakeDocument'
import type Blockchain from '../../blockchain'
import { fakeVote } from '../shared/fakeVote'

// Голосующие члены совета на тестовом стенде (`pnpm run reboot:extra` создаёт
// расширенный совет из 5 человек). Soviet-контракт требует консенсус по
// большинству — 3+ голоса из 5. Голосуем тремя (chairman + 2 member): минимум
// для прохождения. Все члены используют один и тот же default_public_key
// (см. infra.ts:407 — changeKey всем установлен config.default_public_key),
// поэтому транзакция подписывается тем же WIF, и расширять signing-pool не нужно.
const VOTERS: ReadonlyArray<string> = ['ant', 'petr', 'anna']

export async function processDecision(blockchain: Blockchain, decisionId: number) {
  const voteActions = VOTERS.map((voter) => {
    const voteData: SovietContract.Actions.Decisions.VoteFor.IVoteForDecision = {
      ...fakeVote,
      username: voter,
      decision_id: decisionId,
    }
    return {
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.VoteFor.actionName,
      authorization: [{ actor: voter, permission: 'active' }],
      data: voteData,
    }
  })

  const authData: SovietContract.Actions.Decisions.Authorize.IAuthorize = {
    coopname: 'voskhod',
    chairman: 'ant',
    decision_id: decisionId,
    document: fakeDocument,
  }

  const execData: SovietContract.Actions.Decisions.Exec.IExec = {
    executer: 'ant',
    coopname: 'voskhod',
    decision_id: decisionId,
  }

  const result = await blockchain.api.transact(
    {
      actions: [
        ...voteActions,
        {
          account: SovietContract.contractName.production,
          name: SovietContract.Actions.Decisions.Authorize.actionName,
          authorization: [{ actor: 'ant', permission: 'active' }],
          data: authData,
        },
        {
          account: SovietContract.contractName.production,
          name: SovietContract.Actions.Decisions.Exec.actionName,
          authorization: [{ actor: 'ant', permission: 'active' }],
          data: execData,
        },
      ],
    },
    {
      blocksBehind: 3,
      expireSeconds: 30,
    },
  )

  getTotalRamUsage(result)
}
