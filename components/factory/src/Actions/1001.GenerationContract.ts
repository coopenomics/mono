import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { GenerationContract } from '../Templates'

export { GenerationContract as Template } from '../Templates'

/** Генерационное соглашение: пайщик и номер договора УХД из udata. */
export const Factory = defineBuilder<GenerationContract.Action, GenerationContract.Model>()({
  registry_id: GenerationContract.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
    contributorContractUdata: () => f.getUdata({ coopname: data.coopname, username: data.username, key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER, block_num: data.block_num }),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData, contributorContractUdata } }) => {
    if (!vars.generation_contract_template?.protocol_number || !vars.generation_contract_template?.protocol_day_month_year)
      throw new Error('Данные протокола об утверждении генерационного соглашения не найдены. Сначала утвердите генерационное соглашение и сохраните данные протокола.')
    if (!contributorContractUdata?.value) {
      throw new Error(
        `Данные договора УХД не найдены в Udata для пользователя ${data.username}. `
        + `Необходимо сначала сгенерировать параметры документа через UdataDocumentParametersService.`,
      )
    }
    return {
      meta,
      coop,
      vars,
      user: Format.commonUser(userData),
      contributor_contract_number: String(contributorContractUdata.value),
    }
  },
})
