import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationParentOffer } from '../Templates'

export { EducationParentOffer as Template } from '../Templates'

/**
 * Оферта ученика ЦПП «Образование»: пайщик, номер и дата оферты. Номер и дата приходят в данных, иначе читаются из udata,
 * куда бэкенд пишет их до первой сборки.
 */
export const Factory = defineBuilder<EducationParentOffer.Action, EducationParentOffer.Model>()({
  registry_id: EducationParentOffer.registry_id,
  version: 1,
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      numberRow: () => (data.agreement_number ? Promise.resolve(null) : udata(Cooperative.Model.UdataKey.EDUCATION_PARENT_AGREEMENT_NUMBER)),
      createdAtRow: () => (data.agreement_created_at ? Promise.resolve(null) : udata(Cooperative.Model.UdataKey.EDUCATION_PARENT_AGREEMENT_CREATED_AT)),
    }
  },
  assemble: ({ data, meta, reads: { coop, vars, userData, numberRow, createdAtRow } }) => {
    const agreement_number = data.agreement_number || (numberRow?.value ? String(numberRow.value) : '')
    const agreement_created_at = data.agreement_created_at || (createdAtRow?.value ? String(createdAtRow.value) : '')
    if (!agreement_number || !agreement_created_at)
      throw new Error('Номер и дата оферты ученика ЦПП «Образование» обязательны (не переданы и не найдены в Udata)')
    return {
      meta,
      coop,
      vars,
      common_user: Format.commonUser(userData),
      agreement_number,
      agreement_created_at,
    }
  },
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
