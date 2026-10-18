/**
 * Общие шаги общего собрания: состав голосующих уполномоченных, бюллетени,
 * чтение собрания. Используют полный цикл собрания (full-cycle.test.ts) и замер
 * памяти собрания (ram-cost/general-meet.test.ts).
 */
import ecc from 'eosjs-ecc'
import type { Who } from '../core'
import { COOP, COOP_SIGNER, chainDoc, fixture, gql, grantMemberKey, signDocument, tableRows, tokenOf, transact } from '../core'

export const AGGREGATE = `rawDocument{ full_title html hash meta binary }
  document{ version hash doc_hash meta_hash meta signatures{ id signer public_key signature signed_at signed_hash meta } }`
export const MEET = `hash
  processing{ hash isVoted extendedStatus
    meet{ id hash status quorum_passed current_quorum_percent decision1{ ${AGGREGATE} } }
    questions{ id number title context decision counter_votes_for counter_votes_against } }
  processed{ hash quorum_passed results{ number title context decision votes_for votes_against accepted } }`
export const GET_MEET = `query($d:GetMeetInput!){ getMeet(data:$d){ ${MEET} } }`
export const GENERATED = 'full_title html hash meta binary'

export async function meetAs(who: Who, hash: string): Promise<any> {
  return (await gql<any>(await tokenOf(who), GET_MEET, { d: { coopname: COOP, hash } })).getMeet
}

/**
 * Уполномоченные участков стенда: фикстуры docs-harness и уполномоченные
 * участков, заведённых другими наборами. У вторых ключа у набора нет —
 * кооператив выдаёт им ключ, и их бюллетень подаётся прямо в цепь.
 */
export async function meetVoters(): Promise<{ trustees: Who[], strangers: Who[] }> {
  const trustees = [fixture('chairkrg'), fixture('chairodn'), fixture('chairmyt')]
  const branches = await tableRows<any>('branch', COOP, 'branches')
  const known = new Set(trustees.map(t => t.account))
  const strangers: Who[] = []
  for (const branch of branches) {
    const account = String(branch.trustee)
    if (known.has(account))
      continue
    const wif = await ecc.randomKey()
    await grantMemberKey(account, ecc.privateToPublic(wif))
    strangers.push({ account, email: '', wif })
  }
  return { trustees, strangers }
}

/** Бюллетени «за» по всем вопросам: уполномоченные-фикстуры — через API, остальные — прямо в цепь. */
export async function castBallots(meetHash: string, trustees: Who[], strangers: Who[] = []): Promise<void> {
  for (const trustee of trustees) {
    const token = await tokenOf(trustee)
    const questions = (await meetAs(trustee, meetHash)).processing.questions as any[]
    const ballot = (await gql<any>(token, `mutation($d:AnnualGeneralMeetingVotingBallotGenerateDocumentInput!){
      generateBallotForAnnualGeneralMeetDocument(data:$d){ ${GENERATED} } }`, {
      d: { coopname: COOP, username: trustee.account, meet_hash: meetHash, answers: questions.map(q => ({ id: String(q.id), number: String(q.number), vote: 'for' })) },
    })).generateBallotForAnnualGeneralMeetDocument
    await gql(token, 'mutation($d:VoteOnAnnualGeneralMeetInput!){ voteOnAnnualGeneralMeet(data:$d){ hash } }', {
      d: {
        coopname: COOP,
        hash: meetHash,
        username: trustee.account,
        ballot: await signDocument(trustee.wif, ballot, trustee.account, 1),
        votes: questions.map(q => ({ question_id: Number(q.id), vote: 'for' })),
      },
    })
  }
  if (!strangers.length)
    return
  const ref = trustees[0] ?? strangers[0]
  const questionIds = ((await meetAs(ref, meetHash)).processing.questions as any[]).map(q => Number(q.id))
  for (const stranger of strangers) {
    await transact(COOP_SIGNER, [{
      account: 'meet',
      name: 'vote',
      data: { coopname: COOP, hash: meetHash, username: stranger.account, ballot: chainDoc([stranger]), votes: questionIds.map(id => ({ question_id: id, vote: 'for' })) },
    }])
  }
}
