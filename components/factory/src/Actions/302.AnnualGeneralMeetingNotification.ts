import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { AnnualGeneralMeetingNotification } from '../Templates'

export { AnnualGeneralMeetingNotification as Template } from '../Templates'

/** Уведомление о проведении общего собрания: собрание, вопросы и председатель собрания. */
export const Factory = defineBuilder<AnnualGeneralMeetingNotification.Action, AnnualGeneralMeetingNotification.Model>()({
  registry_id: AnnualGeneralMeetingNotification.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    meet: () => f.getMeet(data.coopname, data.meet_hash, data.block_num),
  }),
  derive: ({ data, f, reads: { meet } }) => ({
    questions: () => f.getMeetQuestions(data.coopname, Number(meet.id), data.block_num),
    presider: () => f.getUser(meet.presider, data.block_num),
  }),
  assemble: ({ meta, reads: { coop, vars, meet }, derived: { questions, presider } }) => ({
    meta,
    coop,
    vars,
    meet,
    questions,
    user: Format.commonUser(presider),
  }),
  signer: ({ derived: { presider } }) => Format.commonUser(presider).full_name_or_short_name,
})
