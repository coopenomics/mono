import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BlagorostOffer } from '../Templates'
import { DocumentNotApprovedError } from '../errors'

export { BlagorostOffer as Template } from '../Templates'

/**
 * Оферта ЦПП «Благорост»: пайщик, параметры программы из приватных данных,
 * номер и дата соглашения из udata.
 */
export const Factory = defineBuilder<BlagorostOffer.Action, BlagorostOffer.Model>()({
  registry_id: BlagorostOffer.registry_id,
  version: '1.0',
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => () => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      vars: () => f.getVars(data.coopname, data.block_num),
      coop: () => f.getCooperative(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      blagorostAgreementUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER),
      blagorostAgreementCreatedAtUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_CREATED_AT),
      docData: () => f.loadDocData<BlagorostOffer.Model['doc_data']>(data),
    }
  },
  assemble: ({ meta, reads: { vars, coop, userData, blagorostAgreementUdata, blagorostAgreementCreatedAtUdata, docData } }) => {
    const doc_data = Cooperative.Registry.requireCapitalProgramPrivateData(docData, BlagorostOffer.registry_id)
    if (!vars.blagorost_program?.protocol_number || !vars.blagorost_program?.protocol_day_month_year)
      throw new DocumentNotApprovedError('Данные протокола об утверждении Положения о ЦПП «БЛАГОРОСТ» не найдены. Сначала утвердите Положение и сохраните данные протокола.')
    if (!vars.blagorost_offer_template?.protocol_number || !vars.blagorost_offer_template?.protocol_day_month_year)
      throw new DocumentNotApprovedError('Данные протокола об утверждении шаблона публичной оферты ЦПП «БЛАГОРОСТ» не найдены. Сначала утвердите шаблон оферты и сохраните данные протокола.')
    if (!blagorostAgreementUdata?.value)
      throw new Error('Данные соглашения благороста не найдены в Udata')
    if (!blagorostAgreementCreatedAtUdata?.value)
      throw new Error('Дата создания соглашения благороста не найдена в Udata')
    return {
      meta,
      coop,
      vars,
      common_user: Format.commonUser(userData),
      blagorost_agreement_number: String(blagorostAgreementUdata.value),
      blagorost_agreement_created_at: String(blagorostAgreementCreatedAtUdata.value),
      doc_data,
    }
  },
})
