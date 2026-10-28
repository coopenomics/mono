import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationGuaranteeStatement } from '../Templates'
import { DocumentNotApprovedError } from '../errors'

export { EducationGuaranteeStatement as Template } from '../Templates'

/** Заявление об аннулировании Подписки по Гарантийным условиям: пайщик, Подписка и причина. */
export const Factory = defineBuilder<EducationGuaranteeStatement.Action, EducationGuaranteeStatement.Model>()({
  registry_id: EducationGuaranteeStatement.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData } }) => {
    if (!vars.education_provision?.protocol_number || !vars.education_provision?.protocol_day_month_year)
      throw new DocumentNotApprovedError('Реквизиты протокола об утверждении Положения о ЦПП «Образование» не заполнены (vars.education_provision)')
    return {
      meta,
      coop,
      vars,
      user: Format.commonUser(userData),
      claim_hash: data.claim_hash,
      claim_short_hash: Format.shortHash(data.claim_hash, 8),
      course_title: data.course_title,
      subscribed_at: data.subscribed_at,
      amount: Format.formatAsset(data.amount),
      guarantee_until: data.guarantee_until,
      reason: data.reason,
      links: data.links ?? [],
    }
  },
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
