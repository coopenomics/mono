import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ComponentGenerationContract } from '../Templates'

export { ComponentGenerationContract as Template } from '../Templates'

/** Компонентное генерационное соглашение: пайщик, реквизиты соглашения и договора УХД из udata. */
export const Factory = defineBuilder<ComponentGenerationContract.Action, ComponentGenerationContract.Model>()({
  registry_id: ComponentGenerationContract.registry_id,
  version: '1.0',
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => () => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      generatorAgreementUdata: udata(Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER),
      generatorAgreementCreatedAtUdata: udata(Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_CREATED_AT),
      contributorContractUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER),
      contributorContractCreatedAtUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT),
    }
  },
  assemble: ({ data, meta, reads: { coop, vars, userData, generatorAgreementUdata, generatorAgreementCreatedAtUdata, contributorContractUdata, contributorContractCreatedAtUdata } }) => {
    if (!generatorAgreementUdata?.value)
      throw new Error('Данные генерационного соглашения не найдены в Udata')
    if (!generatorAgreementCreatedAtUdata?.value)
      throw new Error('Дата создания генерационного соглашения не найдена в Udata')
    if (!contributorContractUdata?.value)
      throw new Error('Данные договора УХД участника не найдены в Udata')
    if (!contributorContractCreatedAtUdata?.value)
      throw new Error('Дата создания договора УХД участника не найдена в Udata')
    return {
      meta,
      coop,
      vars,
      user: Format.commonUser(userData),
      appendix_hash: data.appendix_hash,
      short_appendix_hash: Format.shortHash(data.appendix_hash),
      parent_appendix_hash: data.parent_appendix_hash,
      short_parent_appendix_hash: Format.shortHash(data.parent_appendix_hash),
      contributor_contract_number: String(contributorContractUdata.value),
      contributor_contract_created_at: String(contributorContractCreatedAtUdata.value),
      component_name: data.component_name,
      component_hash: data.component_hash,
      project_name: data.project_name,
      project_hash: data.project_hash,
    }
  },
})
