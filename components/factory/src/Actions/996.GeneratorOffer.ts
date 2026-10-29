import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { GeneratorOffer } from '../Templates'

export { GeneratorOffer as Template } from '../Templates'

/**
 * Оферта ЦПП «Генератор»: пайщик, параметры программы из приватных данных,
 * номер и дата генерационного соглашения из udata.
 */
export const Factory = defineBuilder<GeneratorOffer.Action, GeneratorOffer.Model>()({
  registry_id: GeneratorOffer.registry_id,
  version: '1.0',
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => () => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      vars: () => f.getVars(data.coopname, data.block_num),
      coop: () => f.getCooperative(data.coopname, data.block_num),
      user: () => f.getUser(data.username, data.block_num),
      generatorAgreementUdata: udata(Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER),
      generatorAgreementCreatedAtUdata: udata(Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_CREATED_AT),
      docData: () => f.loadDocData<GeneratorOffer.Model['doc_data']>(data),
    }
  },
  assemble: ({ meta, reads: { vars, coop, user, generatorAgreementUdata, generatorAgreementCreatedAtUdata, docData } }) => {
    const doc_data = Cooperative.Registry.requireCapitalProgramPrivateData(docData, GeneratorOffer.registry_id)
    if (!vars.generator_program?.protocol_number || !vars.generator_program?.protocol_day_month_year)
      throw new Error('Данные протокола об утверждении генерационной программы не найдены. Сначала утвердите генерационную программу и сохраните данные протокола.')
    if (!vars.generator_offer_template?.protocol_number || !vars.generator_offer_template?.protocol_day_month_year)
      throw new Error('Данные протокола об утверждении шаблона оферты генератора не найдены. Сначала утвердите шаблон оферты генератора и сохраните данные протокола.')
    if (!generatorAgreementUdata?.value)
      throw new Error('Данные генерационного соглашения не найдены в Udata')
    if (!generatorAgreementCreatedAtUdata?.value)
      throw new Error('Дата создания генерационного соглашения не найдена в Udata')
    return {
      meta,
      coop,
      vars,
      common_user: Format.commonUser(user),
      generator_agreement_number: String(generatorAgreementUdata.value),
      generator_agreement_created_at: String(generatorAgreementCreatedAtUdata.value),
      doc_data,
    }
  },
})
