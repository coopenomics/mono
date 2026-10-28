import { Cooperative } from 'cooptypes'
import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { MarketplaceOffer } from '../Templates'

export { MarketplaceOffer as Template } from '../Templates'

/**
 * Оферта ЦПП «Стол заказов»: пайщик, номер и дата соглашения. Номер и дата
 * приходят в данных (подпись со стола), иначе читаются из udata, куда бэкенд
 * пишет их до первой сборки — так пересборка даёт тот же хэш.
 */
export const Factory = defineBuilder<MarketplaceOffer.Action, MarketplaceOffer.Model>()({
  registry_id: MarketplaceOffer.registry_id,
  version: 1,
  reads: ({ data, f }) => {
    const udata = (key: Cooperative.Model.UdataKey) => f.getUdata({ coopname: data.coopname, username: data.username, key, block_num: data.block_num })
    return {
      coop: () => f.getCooperative(data.coopname, data.block_num),
      vars: () => f.getVars(data.coopname, data.block_num),
      userData: () => f.getUser(data.username, data.block_num),
      numberUdata: () => (data.marketplace_agreement_number ? Promise.resolve(null) : udata(Cooperative.Model.UdataKey.MARKETPLACE_AGREEMENT_NUMBER)),
      createdAtUdata: () => (data.marketplace_agreement_created_at ? Promise.resolve(null) : udata(Cooperative.Model.UdataKey.MARKETPLACE_AGREEMENT_CREATED_AT)),
    }
  },
  assemble: ({ data, meta, reads: { coop, vars, userData, numberUdata, createdAtUdata } }) => {
    const marketplace_agreement_number = data.marketplace_agreement_number || (numberUdata?.value ? String(numberUdata.value) : '')
    const marketplace_agreement_created_at = data.marketplace_agreement_created_at || (createdAtUdata?.value ? String(createdAtUdata.value) : '')
    if (!marketplace_agreement_number)
      throw new Error('marketplace_agreement_number обязателен для генерации оферты ЦПП «Стол заказов» (не передан и не найден в Udata)')
    if (!marketplace_agreement_created_at)
      throw new Error('marketplace_agreement_created_at обязателен для генерации оферты ЦПП «Стол заказов» (не передан и не найден в Udata)')
    return {
      meta,
      coop,
      vars,
      common_user: Format.commonUser(userData),
      marketplace_agreement_number,
      marketplace_agreement_created_at,
    }
  },
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
