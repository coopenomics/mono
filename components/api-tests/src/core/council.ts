/**
 * Совет стенда в цепи: решение по хэшу процесса, голоса членов совета,
 * утверждение председателем и отклонение большинством «против».
 *
 * У совета стенда общий ключ boot, поэтому голоса всех членов уходят одной
 * транзакцией. Так решения проводят наборы, которым важен исход решения, а
 * не путь голосования через рабочий стол.
 */
import { tableRows, transact } from './chain'
import { chainDoc } from './documents'
import { COOP, DEFAULT_WIF } from './env'
import { CHAIRMAN } from './roles'
import { waitFor } from './wait'
import { COOP_SIGNER } from './wallet'

/** Решение совета по хэшу процесса, который его породил. */
export async function decisionByHash(hash: string): Promise<any | undefined> {
  const rows = await tableRows<any>('soviet', COOP, 'decisions')
  return rows.find(d => String(d.hash).toLowerCase() === hash.toLowerCase())
}

/** То же с ожиданием: повестку создаёт действие контракта, в таблице она появляется с блоком. */
export async function awaitDecision(hash: string, label = `решение совета по ${hash.slice(0, 8)}`): Promise<any> {
  return waitFor(async () => (await decisionByHash(hash)) ?? null, { timeoutMs: 60_000, intervalMs: 1_000, label })
}

/** Голосующие члены совета; у совета из одного председателя — он сам. */
export async function votingBoardMembers(): Promise<string[]> {
  const boards = await tableRows<any>('soviet', COOP, 'boards')
  const board = boards.find(b => b.type === 'soviet') ?? boards[0]
  const members = (board?.members ?? []).filter((m: any) => Boolean(Number(m.is_voting) || m.is_voting === true)).map((m: any) => m.username as string)
  return members.length ? members : [CHAIRMAN.account]
}

/**
 * Голоса членов совета, ещё не голосовавших. По умолчанию голосуют все
 * голосующие члены; `voters` сужает состав.
 */
export async function voteOnDecision(decisionId: number, side: 'for' | 'against' = 'for', voters?: readonly string[]): Promise<void> {
  const { Classes } = await import('@coopenomics/sdk')
  const decision = (await tableRows<any>('soviet', COOP, 'decisions')).find(d => Number(d.id) === decisionId)
  const voted = new Set<string>([...(decision?.votes_for ?? []), ...(decision?.votes_against ?? [])])
  const signer: any = new (Classes as any).Vote(DEFAULT_WIF)
  const actions: any[] = []
  for (const member of voters ?? await votingBoardMembers()) {
    if (voted.has(member))
      continue
    const data = side === 'for'
      ? await signer.voteFor(COOP, member, decisionId, 'active')
      : await signer.voteAgainst(COOP, member, decisionId, 'active')
    actions.push({ account: 'soviet', name: side === 'for' ? 'votefor' : 'voteagainst', authorization: [{ actor: member, permission: 'active' }], data })
  }
  if (actions.length)
    await transact(COOP_SIGNER, actions)
}

/** Утверждение решения председателем с протоколом и исполнение. */
export async function authorizeDecisionOnChain(decisionId: number, protocol: unknown = chainDoc([CHAIRMAN])): Promise<void> {
  await transact(COOP_SIGNER, [
    {
      account: 'soviet',
      name: 'authorize',
      data: { coopname: COOP, chairman: CHAIRMAN.account, decision_id: decisionId, document: protocol, permission: 'active' },
    },
    { account: 'soviet', name: 'exec', data: { executer: CHAIRMAN.account, coopname: COOP, decision_id: decisionId } },
  ])
}

/** Отклонение решения, против которого высказалось большинство совета. */
export async function declineDecisionOnChain(decisionId: number): Promise<void> {
  await transact(COOP_SIGNER, [{ account: 'soviet', name: 'declinedec', data: { coopname: COOP, decision_id: decisionId } }])
}
