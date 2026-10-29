import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { StorageAgreement } from '../Templates'

export { StorageAgreement as Template } from '../Templates'

/** Договор хранения Благороста: пайщик и реквизиты договоров из udata. */
export const Factory = defineBuilder<StorageAgreement.Action, StorageAgreement.Model>()({
  registry_id: StorageAgreement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => () => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      storageAgreementUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_NUMBER),
      storageAgreementCreatedAtUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_CREATED_AT),
      contributorContractUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER),
      generatorAgreementUdata: udata(Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER),
      generatorAgreementCreatedAtUdata: udata(Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_CREATED_AT),
    }
  },
  assemble: ({ data, meta, reads: { coop, vars, userData, storageAgreementUdata, storageAgreementCreatedAtUdata, contributorContractUdata, generatorAgreementUdata, generatorAgreementCreatedAtUdata } }) => {
    const missingParams: string[] = []
    if (!storageAgreementUdata?.value)
      missingParams.push('BLAGOROST_STORAGE_AGREEMENT_NUMBER')
    if (!storageAgreementCreatedAtUdata?.value)
      missingParams.push('BLAGOROST_STORAGE_AGREEMENT_CREATED_AT')
    if (!contributorContractUdata?.value)
      missingParams.push('BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER')
    if (!generatorAgreementUdata?.value)
      missingParams.push('GENERATOR_AGREEMENT_NUMBER')
    if (!generatorAgreementCreatedAtUdata?.value)
      missingParams.push('GENERATOR_AGREEMENT_CREATED_AT')
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
      blagorost_storage_agreement_number: String(storageAgreementUdata?.value || ''),
      blagorost_storage_agreement_created_at: String(storageAgreementCreatedAtUdata?.value || ''),
      contributor_contract_number: String(contributorContractUdata?.value || ''),
      generator_agreement_number: String(generatorAgreementUdata?.value || ''),
      generator_agreement_created_at: String(generatorAgreementCreatedAtUdata?.value || ''),
    }
  },
})
