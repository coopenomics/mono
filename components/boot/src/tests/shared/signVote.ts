import type { SovietContract } from 'cooptypes'
import { private_key } from '../../configs'

/**
 * Настоящая подпись голоса члена совета для контракта soviet.
 *
 * Контракт привязывает хэш голоса к действию, кооперативу, решению и времени и
 * проверяет, что ключ подписи принадлежит указанному разрешению аккаунта
 * (assert_recover_key_account), поэтому «фальшивый» голос с фиксированной подписью
 * больше не проходит. По умолчанию подписывает ключом стенда: у всех членов совета
 * стенда он же стоит в active.
 *
 * @param username член совета, от чьего имени голос
 * @param decision_id номер решения
 * @param wif приватный ключ подписи (по умолчанию ключ стенда)
 * @param permission разрешение аккаунта, которому принадлежит ключ: active — ручной голос, иное — разрешение робота
 */
export async function signVote(
  coopname: string,
  username: string,
  decision_id: number | string,
  wif: string = private_key,
  permission: string = 'active',
  action: 'votefor' | 'voteagainst' = 'votefor',
): Promise<SovietContract.Actions.Decisions.VoteFor.IVoteForDecision> {
  const { Classes } = await import('@coopenomics/sdk')
  const signer = new Classes.Vote(wif)
  const id = Number(decision_id)
  return action === 'votefor'
    ? await signer.voteFor(coopname, username, id, permission)
    : await signer.voteAgainst(coopname, username, id, permission)
}
