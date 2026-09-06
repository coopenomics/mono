import { SovietContract } from 'cooptypes'
import { getTotalRamUsage } from '../../utils/getTotalRamUsage'
import type Blockchain from '../../blockchain'
import { signVote } from '../shared/signVote'
import { signProtocol } from '../shared/signProtocol'

// Голосующие члены совета на тестовом стенде (`pnpm run reboot:extra` создаёт
// расширенный совет из 5 человек). Soviet-контракт требует консенсус по
// большинству — 3+ голоса из 5. Голосуем тремя (chairman + 2 member): минимум
// для прохождения. Все члены используют один и тот же default_public_key
// (см. infra.ts:407 — changeKey всем установлен config.default_public_key),
// поэтому транзакция подписывается тем же WIF, и расширять signing-pool не нужно.
const VOTERS: ReadonlyArray<string> = ['ant', 'petr', 'anna']
const COOP = 'voskhod'
const CHAIRMAN = 'ant'

/**
 * Голосует за решение и утверждает его протоколом одной транзакцией.
 *
 * Голоса и протокол подписаны по-настоящему: контракт проверяет привязку хэша голоса
 * к решению и принадлежность ключа подписи разрешению аккаунта, поэтому фиксированные
 * заготовки больше не проходят.
 */
export async function processDecision(blockchain: Blockchain, decisionId: number) {
  const voteActions = await Promise.all(VOTERS.map(async (voter) => {
    const voteData = await signVote(COOP, voter, decisionId)
    return {
      account: SovietContract.contractName.production,
      name: SovietContract.Actions.Decisions.VoteFor.actionName,
      authorization: [{ actor: voter, permission: 'active' }],
      data: voteData,
    }
  }))

  const authData: SovietContract.Actions.Decisions.Authorize.IAuthorize = {
    coopname: COOP,
    chairman: CHAIRMAN,
    decision_id: decisionId,
    document: await signProtocol(CHAIRMAN, decisionId),
    permission: 'active',
  }

  const execData: SovietContract.Actions.Decisions.Exec.IExec = {
    executer: CHAIRMAN,
    coopname: COOP,
    decision_id: decisionId,
  }

  const result = await blockchain.api.transact(
    {
      actions: [
        ...voteActions,
        {
          account: SovietContract.contractName.production,
          name: SovietContract.Actions.Decisions.Authorize.actionName,
          // soviet::authorize и soviet::exec требуют require_auth(coopname) —
          // подпись председателя их не удовлетворяет (в отличие от votefor,
          // который принимает и пайщика, и кооператив). С actor: 'ant' вызов
          // падал «missing authority of voskhod».
          authorization: [{ actor: COOP, permission: 'active' }],
          data: authData,
        },
        {
          account: SovietContract.contractName.production,
          name: SovietContract.Actions.Decisions.Exec.actionName,
          authorization: [{ actor: COOP, permission: 'active' }],
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
