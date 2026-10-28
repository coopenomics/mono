import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchMeetingProposal } from '../Templates'

export { BranchMeetingProposal as Template } from '../Templates'

/** Предложение о проведении собрания участка: автор, вид и вопросы из данных. */
export const Factory = defineBuilder<BranchMeetingProposal.Action, BranchMeetingProposal.Model>()({
  registry_id: BranchMeetingProposal.registry_id,
  version: 1,
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
    type: data.type,
    questions: data.questions,
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
