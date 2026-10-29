import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { AnnualGeneralMeetingAgenda } from '../Templates'

export { AnnualGeneralMeetingAgenda as Template } from '../Templates'

/** Предложение повестки общего собрания: автор, кооператив, собрание и вопросы из данных. */
export const Factory = defineBuilder<AnnualGeneralMeetingAgenda.Action, AnnualGeneralMeetingAgenda.Model>()({
  registry_id: AnnualGeneralMeetingAgenda.registry_id,
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
    meet: { ...data.meet },
    questions: [...data.questions],
    user: Format.commonUser(userData),
    is_repeated: data.is_repeated,
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
