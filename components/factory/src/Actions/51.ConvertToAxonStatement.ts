import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ConvertToAxonStatement } from '../Templates'

export { ConvertToAxonStatement as Template } from '../Templates'

/** Заявление о конвертации в AXON: пайщик, кооператив, переменные. */
export const Factory = defineBuilder<ConvertToAxonStatement.Action, ConvertToAxonStatement.Model>()({
  registry_id: ConvertToAxonStatement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    user: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ meta, reads: { coop, vars, user } }) => ({
    meta,
    coop,
    vars,
    commonUser: Format.commonUser(user),
  }),
})
