import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { BlagorostAgreement } from '../Templates'

export { BlagorostAgreement as Template } from '../Templates'

/** Соглашение Благороста: пайщик и реквизиты соглашения и договора УХД из udata. */
export const Factory = defineBuilder<BlagorostAgreement.Action, BlagorostAgreement.Model>()({
  registry_id: BlagorostAgreement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => () => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      blagorostAgreementUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER),
      contributorContractUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER),
      contributorContractCreatedAtUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT),
    }
  },
  assemble: ({ data, meta, reads: { coop, vars, userData, blagorostAgreementUdata, contributorContractUdata, contributorContractCreatedAtUdata } }) => {
    const missingParams: string[] = []
    if (!contributorContractUdata?.value)
      missingParams.push('BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER')
    if (!contributorContractCreatedAtUdata?.value)
      missingParams.push('BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT')
    if (missingParams.length > 0) {
      throw new Error(
        `Отсутствуют необходимые параметры в Udata для пользователя ${data.username}: ${missingParams.join(', ')}. `
        + `Необходимо сначала сгенерировать параметры документов через UdataDocumentParametersService.`,
      )
    }
    return {
      meta,
      coop,
      vars,
      common_user: Format.commonUser(userData),
      blagorost_agreement_number: String(blagorostAgreementUdata?.value || ''),
      contributor_contract_number: String(contributorContractUdata?.value || ''),
      contributor_contract_created_at: String(contributorContractCreatedAtUdata?.value || ''),
    }
  },
})
