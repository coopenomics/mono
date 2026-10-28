import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { GenerationMoneyReturnUnusedStatement } from '../Templates'

export { GenerationMoneyReturnUnusedStatement as Template } from '../Templates'

/** Заявление о возврате неиспользованных денег генерации: пайщик и реквизиты договоров из udata. */
export const Factory = defineBuilder<GenerationMoneyReturnUnusedStatement.Action, GenerationMoneyReturnUnusedStatement.Model>()({
  registry_id: GenerationMoneyReturnUnusedStatement.registry_id,
  version: 1,
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => () => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      vars: () => f.getVars(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      contributorContractUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER),
      contributorContractCreatedAtUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT),
      generatorAgreementUdata: udata(Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER),
      generatorAgreementCreatedAtUdata: udata(Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_CREATED_AT),
    }
  },
  assemble: ({ data, meta, reads: { vars, userData, contributorContractUdata, contributorContractCreatedAtUdata, generatorAgreementUdata, generatorAgreementCreatedAtUdata } }) => {
    if (!contributorContractUdata?.value)
      throw new Error('Данные договора УХД участника не найдены в Udata')
    if (!contributorContractCreatedAtUdata?.value)
      throw new Error('Дата создания договора УХД участника не найдена в Udata')
    if (!generatorAgreementUdata?.value)
      throw new Error('Данные генерационного соглашения не найдены в Udata')
    if (!generatorAgreementCreatedAtUdata?.value)
      throw new Error('Дата создания генерационного соглашения не найдена в Udata')
    return {
      meta,
      vars,
      common_user: Format.commonUser(userData),
      contributor_contract_number: String(contributorContractUdata.value),
      contributor_contract_created_at: String(contributorContractCreatedAtUdata.value),
      generator_agreement_number: String(generatorAgreementUdata.value),
      generator_agreement_created_at: String(generatorAgreementCreatedAtUdata.value),
      project_hash: data.project_hash,
      amount: data.amount,
    }
  },
})
