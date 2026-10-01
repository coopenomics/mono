/**
 * Выход пайщика из кооператива в цепи — тем путём, каким он идёт после
 * подтверждения заявления: registrator::exitcoop от кооператива, решение
 * совета, выплата паевого шлюзом (gateway::outcomplete → completexit) либо
 * отказ совета (soviet::declinedec → declinexit).
 *
 * Это подготовка состояния для наборов, которым важен сам факт завершённого
 * или отклонённого выхода (отзыв свидетельств карты и т.п.); путь заявления
 * через API проверяет membership.exit.
 */
import type { Who } from './auth'
import { randomHash, tableRows, transact } from './chain'
import { authorizeDecisionOnChain, awaitDecision, declineDecisionOnChain, voteOnDecision } from './council'
import { chainDoc } from './documents'
import { COOP } from './env'
import { waitFor } from './wait'
import { COOP_SIGNER } from './wallet'

async function exitRow(username: string): Promise<any | undefined> {
  const rows = await tableRows<any>('registrator', COOP, 'exits')
  return rows.find(r => r.username === username)
}

/** Заявление на выход подано: в цепи строка выхода и вопрос в повестке совета. */
export async function requestExit(member: Who): Promise<string> {
  const exitHash = randomHash()
  await transact(COOP_SIGNER, [{
    account: 'registrator',
    name: 'exitcoop',
    data: { coopname: COOP, username: member.account, exit_hash: exitHash, statement: chainDoc([member]) },
  }])
  return exitHash
}

/**
 * Одобренный советом выход доводится до конца: паевой выплачен шлюзом, строки
 * выхода в цепи больше нет. Нулевой возврат завершает выход сразу, без выплаты.
 */
export async function payOutExit(member: Who, exitHash: string): Promise<void> {
  const authorized = await waitFor(async () => {
    const row = await exitRow(member.account)
    return !row || row.status === 'authorized' ? { row } : null
  }, { timeoutMs: 60_000, intervalMs: 1_000, label: `выход ${member.account} одобрен советом` })
  if (!authorized.row)
    return
  await transact(COOP_SIGNER, [{ account: 'gateway', name: 'outcomplete', data: { coopname: COOP, outcome_hash: exitHash } }])
  await waitFor(async () => ((await exitRow(member.account)) ? null : true),
    { timeoutMs: 60_000, intervalMs: 1_000, label: `выход ${member.account} завершён` })
}

/** Выход доведён до конца: совет одобрил, паевой выплачен, пайщика в кооперативе нет. */
export async function completeExit(member: Who): Promise<string> {
  const exitHash = await requestExit(member)
  const decision = await awaitDecision(exitHash, `решение совета о выходе ${member.account}`)
  await voteOnDecision(Number(decision.id), 'for')
  await authorizeDecisionOnChain(Number(decision.id))
  await payOutExit(member, exitHash)
  return exitHash
}

/** Совет отклонил заявление на выход: членство сохраняется. */
export async function declineExit(member: Who): Promise<string> {
  const exitHash = await requestExit(member)
  const decision = await awaitDecision(exitHash, `решение совета о выходе ${member.account}`)
  await voteOnDecision(Number(decision.id), 'against')
  await declineDecisionOnChain(Number(decision.id))
  await waitFor(async () => ((await exitRow(member.account)) ? null : true),
    { timeoutMs: 60_000, intervalMs: 1_000, label: `выход ${member.account} отклонён советом` })
  return exitHash
}
