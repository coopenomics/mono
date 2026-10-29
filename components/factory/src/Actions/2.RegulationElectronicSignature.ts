import { defineBuilder } from '../Builder'
import { RegulationElectronicSignature } from '../Templates'
import { isEmpty } from '../Utils'

export { RegulationElectronicSignature as Template } from '../Templates'

/** Положение о простой электронной подписи: реквизиты кооператива и протокол утверждения. */
export const Factory = defineBuilder<RegulationElectronicSignature.Action, RegulationElectronicSignature.Model>()({
  registry_id: RegulationElectronicSignature.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  assemble: ({ meta, reads: { coop, vars } }) => {
    if (!vars?.signature_agreement || isEmpty(vars.signature_agreement.protocol_number) || isEmpty(vars.signature_agreement.protocol_day_month_year))
      throw new Error('Реквизиты протокола по простой электронной подписи не заполнены. Добавьте номер и дату протокола в настройках кооператива.')
    return { meta, coop, vars }
  },
})
