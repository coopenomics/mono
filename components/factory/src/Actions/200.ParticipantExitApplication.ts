import { defineBuilder } from '../Builder'
import { ParticipantExitApplication } from '../Templates'

export { ParticipantExitApplication as Template } from '../Templates'

/** Заявление о выходе из кооператива: пайщик любого вида, кооператив, переменные. */
export const Factory = defineBuilder<ParticipantExitApplication.Action, ParticipantExitApplication.Model>()({
  registry_id: ParticipantExitApplication.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    user: () => f.getUser(data.username, data.block_num),
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  assemble: ({ meta, reads: { user, coop, vars } }) => ({
    [user.type]: user.data,
    meta,
    coop,
    type: user.type,
    vars,
  }),
})
