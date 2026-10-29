import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { GenerationConvertStatement } from '../Templates'

export { GenerationConvertStatement as Template } from '../Templates'

/** Заявление о конвертации в генерации: пайщик, реквизиты договора УХД из udata, суммы по кошелькам. */
export const Factory = defineBuilder<GenerationConvertStatement.Action, GenerationConvertStatement.Model>()({
  registry_id: GenerationConvertStatement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => () => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      contributorContractUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER),
      contributorContractCreatedAtUdata: udata(Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT),
    }
  },
  assemble: ({ data, meta, reads: { coop, vars, userData, contributorContractUdata, contributorContractCreatedAtUdata } }) => {
    if (!contributorContractUdata?.value)
      throw new Error('Данные договора УХД участника не найдены в Udata')
    if (!contributorContractCreatedAtUdata?.value)
      throw new Error('Дата создания договора УХД участника не найдена в Udata')
    return {
      meta,
      coop,
      vars,
      common_user: Format.commonUser(userData),
      contributor_contract_number: String(contributorContractUdata.value),
      contributor_contract_created_at: String(contributorContractCreatedAtUdata.value),
      appendix_hash: data.appendix_hash,
      appendix_short_hash: Format.shortHash(data.appendix_hash),
      project_hash: data.project_hash,
      project_short_hash: Format.shortHash(data.project_hash),
      main_wallet_amount: Format.formatAsset(data.main_wallet_amount),
      blagorost_wallet_amount: Format.formatAsset(data.blagorost_wallet_amount),
      to_wallet: data.to_wallet,
      to_blagorost: data.to_blagorost,
    }
  },
})
