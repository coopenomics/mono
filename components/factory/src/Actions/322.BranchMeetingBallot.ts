import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchMeetingBallot } from '../Templates'

export { BranchMeetingBallot as Template } from '../Templates'

/** Бюллетень собрания участка: пайщик, вопросы и ответы из данных. */
export const Factory = defineBuilder<BranchMeetingBallot.Action, BranchMeetingBallot.Model>()({
  registry_id: BranchMeetingBallot.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData } }) => ({
    meta,
    coop,
    vars,
    user: Format.commonUser(userData),
    answers: data.answers,
    questions: data.questions,
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
