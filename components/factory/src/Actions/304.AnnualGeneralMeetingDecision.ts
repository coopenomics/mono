import { defineBuilder } from '../Builder'
import { AnnualGeneralMeetingDecision } from '../Templates'

export { AnnualGeneralMeetingDecision as Template } from '../Templates'

/**
 * Протокол решения общего собрания: собрание по хэшу с именами председателя
 * и секретаря, вопросы повестки с итогами и решение собрания (кворум из
 * собрания, дата из меты).
 */
export const Factory = defineBuilder<AnnualGeneralMeetingDecision.Action, AnnualGeneralMeetingDecision.Model>()({
  registry_id: AnnualGeneralMeetingDecision.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    meet: () => f.getMeet(data.coopname, data.meet_hash, data.block_num),
  }),
  derive: ({ data, f, meta, reads: { meet } }) => ({
    questions: () => f.getMeetQuestions(data.coopname, Number(meet.id), data.block_num),
    decision: () => f.getGeneralMeetingDecision(meet, meta.created_at, meta.timezone),
  }),
  assemble: ({ meta, reads: { coop, vars, meet }, derived: { questions, decision } }) => ({
    meta,
    coop,
    vars,
    decision,
    meet,
    questions,
  }),
  signer: ({ reads: { meet } }) => `${meet.presider} / ${meet.secretary}`,
})
