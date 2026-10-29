import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BranchMeetingDecision } from '../Templates'

export { BranchMeetingDecision as Template } from '../Templates'

/** Протокол собрания участка: председатель собрания и итоги из данных. */
export const Factory = defineBuilder<BranchMeetingDecision.Action, BranchMeetingDecision.Model>()({
  registry_id: BranchMeetingDecision.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    chairmanUser: () => f.getUser(data.chairman, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, chairmanUser } }) => ({
    meta,
    coop,
    vars,
    protocol_number: data.protocol_number,
    chairman_full_name: Format.commonUser(chairmanUser).full_name_or_short_name,
    open_at_datetime: data.open_at_datetime,
    close_at_datetime: data.close_at_datetime,
    current_quorum_percent: data.current_quorum_percent,
    questions: data.questions,
  }),
  signer: ({ reads: { chairmanUser } }) => Format.commonUser(chairmanUser).full_name_or_short_name,
})
