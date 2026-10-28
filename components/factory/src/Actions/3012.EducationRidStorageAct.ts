import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationRidStorageAct } from '../Templates'
import { getEducationContractRef } from '../Utils/educationContractRef'

export { EducationRidStorageAct as Template } from '../Templates'

/** Акт передачи результата на хранение: реквизиты договора УХД, результат и занятие. */
export const Factory = defineBuilder<EducationRidStorageAct.Action, EducationRidStorageAct.Model>()({
  registry_id: EducationRidStorageAct.registry_id,
  version: 1,
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
    rid_hash: data.rid_hash,
    rid_short_hash: Format.shortHash(data.rid_hash),
    amount: Format.formatAsset(data.amount),
    rid_type: data.rid_type,
    course_title: data.course_title,
    lesson_number: data.lesson_number,
    lesson_topic: data.lesson_topic,
    held_at: data.held_at,
    duration_minutes: data.duration_minutes,
    materials: data.materials,
    hold_until: data.hold_until,
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
