import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationRidAct } from '../Templates'
import { getEducationContractRef } from '../Utils/educationContractRef'

export { EducationRidAct as Template } from '../Templates'

/** Акт приёма-передачи результата преподавателя: реквизиты договора УХД, результат, решение совета из данных. */
export const Factory = defineBuilder<EducationRidAct.Action, EducationRidAct.Model>()({
  registry_id: EducationRidAct.registry_id,
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
    rid_type_human: Cooperative.Registry.educationRidTypeLabel(data.rid_type),
    ...(data.decision_id ? { decision_id: data.decision_id, decision_date: data.decision_date ?? '' } : {}),
    rid_hash: data.rid_hash,
    rid_short_hash: Format.shortHash(data.rid_hash),
    amount: Format.formatAsset(data.amount),
    rid_type: data.rid_type,
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
