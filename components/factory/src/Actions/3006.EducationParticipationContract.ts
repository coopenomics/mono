import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationParticipationContract } from '../Templates'

export { EducationParticipationContract as Template } from '../Templates'

/**
 * Договор участия в хозяйственной деятельности преподавателя: пайщик, номер и дата договора. Номер и дата приходят в данных, иначе читаются из udata,
 * куда бэкенд пишет их до первой сборки.
 */
export const Factory = defineBuilder<EducationParticipationContract.Action, EducationParticipationContract.Model>()({
  registry_id: EducationParticipationContract.registry_id,
  version: 1,
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      numberRow: () => (data.contract_number ? Promise.resolve(null) : udata(Cooperative.Model.UdataKey.EDUCATION_CONTRACT_NUMBER)),
      createdAtRow: () => (data.contract_created_at ? Promise.resolve(null) : udata(Cooperative.Model.UdataKey.EDUCATION_CONTRACT_CREATED_AT)),
    }
  },
  assemble: ({ data, meta, reads: { coop, vars, userData, numberRow, createdAtRow } }) => {
    const contract_number = data.contract_number || (numberRow?.value ? String(numberRow.value) : '')
    const contract_created_at = data.contract_created_at || (createdAtRow?.value ? String(createdAtRow.value) : '')
    if (!contract_number || !contract_created_at)
      throw new Error('Номер и дата договора участия в хозяйственной деятельности обязательны (не переданы и не найдены в Udata)')
    return {
      meta,
      coop,
      vars,
      common_user: Format.commonUser(userData),
      contract_number,
      contract_created_at,
    }
  },
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
