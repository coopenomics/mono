import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { AnnualGeneralMeetingVotingBallot } from '../Templates'

export { AnnualGeneralMeetingVotingBallot as Template } from '../Templates'

/** Бюллетень голосования: пайщик, собрание, вопросы повестки и ответы из данных. */
export const Factory = defineBuilder<AnnualGeneralMeetingVotingBallot.Action, AnnualGeneralMeetingVotingBallot.Model>()({
  registry_id: AnnualGeneralMeetingVotingBallot.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
    meet: () => f.getMeet(data.coopname, data.meet_hash, data.block_num),
  }),
  derive: ({ data, f, reads: { meet } }) => ({
    questions: async () => (await f.getMeetQuestions(data.coopname, Number(meet.id), data.block_num)).map(question => ({
      id: question.id.toString(),
      number: question.number.toString(),
      title: question.title,
      context: question.context || '',
      decision: question.decision,
    })),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData, meet }, derived: { questions } }) => ({
    meta,
    coop,
    vars,
    user: Format.commonUser(userData),
    meet,
    answers: data.answers,
    questions,
  } as AnnualGeneralMeetingVotingBallot.Model),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
