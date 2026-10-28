import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { GenerationMoneyInvestStatement } from '../Templates'
import { formatCreatedAt } from '../Utils/documentCreatedAt'

export { GenerationMoneyInvestStatement as Template } from '../Templates'

/** Заявление о денежном взносе в генерацию: пайщик, реквизиты договора УХД и соглашения из udata. */
export const Factory = defineBuilder<GenerationMoneyInvestStatement.Action, GenerationMoneyInvestStatement.Model>()({
  registry_id: GenerationMoneyInvestStatement.registry_id,
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
      appendix_hash: data.appendix_hash,
      short_appendix_hash: Format.shortHash(data.appendix_hash),
      contributor_contract_number: String(contributorContractUdata.value),
      contributor_contract_created_at: String(contributorContractCreatedAtUdata.value),
      appendix_created_at: formatCreatedAt(data.appendix_created_at, meta.timezone),
      project_hash: data.project_hash,
      amount: Format.formatAsset(data.amount),
      blagorost_agreement_number: String(blagorostAgreementUdata.value),
      blagorost_agreement_created_at: String(blagorostAgreementCreatedAtUdata.value),
    }
  },
})
