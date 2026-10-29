import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationRidStatement } from '../Templates'
import { getEducationContractRef } from '../Utils/educationContractRef'

export { EducationRidStatement as Template } from '../Templates'

/** Заявление преподавателя о взносе результата: пайщик, реквизиты договора УХД из udata, результат. */
export const Factory = defineBuilder<EducationRidStatement.Action, EducationRidStatement.Model>()({
  registry_id: EducationRidStatement.registry_id,
  version: '1.0',
  reads: ({ data, f, s }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
    contract: () => getEducationContractRef(s, data),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData, contract } }) => ({
    meta,
    coop,
    vars,
    user: Format.commonUser(userData),
    program: { name: 'Образование' },
    ...contract,
    rid_short_hash: Format.shortHash(data.rid_hash),
    rid_type_human: Cooperative.Registry.educationRidTypeLabel(data.rid_type),
    rid_hash: data.rid_hash,
    assignment_id: data.assignment_id,
    amount: Format.formatAsset(data.amount),
    rid_type: data.rid_type,
    links: data.links,
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
