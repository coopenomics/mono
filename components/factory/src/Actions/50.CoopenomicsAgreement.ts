import { defineBuilder } from '../Builder'
import { CoopenomicsAgreement } from '../Templates'
import { isEmpty } from '../Utils'
import { DocumentNotApprovedError } from '../errors'

export { CoopenomicsAgreement as Template } from '../Templates'

/** Соглашение о подключении к кооперативной экономике: кооператив и организация-партнёр. */
export const Factory = defineBuilder<CoopenomicsAgreement.Action, CoopenomicsAgreement.Model>()({
  registry_id: CoopenomicsAgreement.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    partner: () => f.getOrganization(data.username, data.block_num),
  }),
  assemble: ({ meta, reads: { coop, vars, partner } }) => {
    if (!vars?.coopenomics_agreement || isEmpty(vars.coopenomics_agreement.protocol_number) || isEmpty(vars.coopenomics_agreement.protocol_day_month_year))
      throw new DocumentNotApprovedError('Соглашение о подключении не утверждено советом: в настройках кооператива нет номера и даты протокола. Вынесите соглашение на совет в реестре шаблонов документов и повторите генерацию.')
    return { meta, coop, vars, partner }
  },
})
