import { defineBuilder } from '../Builder'
import { AnnualGeneralMeetingSovietDecision } from '../Templates'

export { AnnualGeneralMeetingSovietDecision as Template } from '../Templates'

/**
 * Решение совета о созыве общего собрания: голоса по решению (по действиям
 * голосования, иначе по утверждению), собрание и вопросы повестки.
 */
export const Factory = defineBuilder<AnnualGeneralMeetingSovietDecision.Action, AnnualGeneralMeetingSovietDecision.Model>()({
  registry_id: AnnualGeneralMeetingSovietDecision.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    meet: () => f.getMeet(data.coopname, data.meet_hash, data.block_num),
  }),
  derive: ({ data, f, meta, reads: { coop, meet } }) => ({
    decision: async () => {
      try {
        return await f.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone)
      }
      catch {
        return f.getApprovedDecision(coop, data.coopname, data.decision_id)
      }
    },
    questions: () => f.getMeetQuestions(data.coopname, Number(meet.id), data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, meet }, derived: { decision, questions } }) => ({
    meta,
    coop,
    vars,
    decision,
    meet,
    questions,
    is_repeated: data.is_repeated,
  }),
  signer: ({ reads: { coop } }) => `${coop.chairman.last_name} ${coop.chairman.first_name} ${coop.chairman.middle_name}`,
})
