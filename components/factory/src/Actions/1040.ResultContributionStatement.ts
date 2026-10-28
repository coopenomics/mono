import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ResultContributionStatement } from '../Templates'

export { ResultContributionStatement as Template } from '../Templates'

/** Заявление о взносе результата: пайщик, реквизиты договоров из udata, результат и доля. */
export const Factory = defineBuilder<ResultContributionStatement.Action, ResultContributionStatement.Model>()({
  registry_id: ResultContributionStatement.registry_id,
  version: 1,
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => () => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      contributorContractUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER),
      contributorContractCreatedAtUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT),
      blagorostAgreementUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER),
      blagorostAgreementCreatedAtUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_CREATED_AT),
    }
  },
  assemble: ({ data, meta, reads: { coop, vars, userData, contributorContractUdata, contributorContractCreatedAtUdata, blagorostAgreementUdata, blagorostAgreementCreatedAtUdata } }) => {
    if (!contributorContractUdata?.value)
      throw new Error('Данные договора УХД участника не найдены в Udata')
    if (!contributorContractCreatedAtUdata?.value)
      throw new Error('Дата создания договора УХД участника не найдена в Udata')
    if (!blagorostAgreementUdata?.value)
      throw new Error('Данные соглашения благороста не найдены в Udata')
    if (!blagorostAgreementCreatedAtUdata?.value)
      throw new Error('Дата создания соглашения благороста не найдена в Udata')
    return {
      meta,
      coop,
      vars,
      common_user: Format.commonUser(userData),
      contributor_contract_number: String(contributorContractUdata.value),
      contributor_contract_created_at: String(contributorContractCreatedAtUdata.value),
      blagorost_agreement_number: String(blagorostAgreementUdata.value),
      blagorost_agreement_created_at: String(blagorostAgreementCreatedAtUdata.value),
      project_name: data.project_name,
      component_name: data.component_name,
      result_hash: data.result_hash,
      result_short_hash: Format.shortHash(data.result_hash),
      percent_of_result: data.percent_of_result,
      total_amount: Format.formatAsset(data.total_amount),
    }
  },
})
