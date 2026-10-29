import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { MarketplaceTransportNote } from '../Templates'

export { MarketplaceTransportNote as Template } from '../Templates'

/**
 * Товарно-транспортная накладная: поставщик по счёту, участок-приёмник,
 * экспедитор и перевозка из приватных данных по хэшу.
 */
export const Factory = defineBuilder<MarketplaceTransportNote.Action, MarketplaceTransportNote.Model>()({
  registry_id: MarketplaceTransportNote.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    supplierUser: () => f.getUser(data.supplier_account, data.block_num),
    branch: () => (data.accept_braname ? f.getOrganization(data.accept_braname, data.block_num) : Promise.resolve(undefined)),
    doc_data: () => f.loadDocData<MarketplaceTransportNote.PrivateData>(data),
  }),
  assemble: ({ data, meta, reads: { coop, vars, supplierUser, branch, doc_data } }) => {
    if (!doc_data)
      throw new Error(`Приватный payload ТТН не найден по doc_data_hash=${data.doc_data_hash}`)
    return {
      meta,
      coop,
      vars,
      ttn_number: data.ttn_number,
      cycle_id: data.cycle_id,
      shipment_id: data.shipment_id,
      accept_braname: data.accept_braname,
      total_amount: data.total_amount,
      currency: data.currency,
      supplier_account: data.supplier_account,
      supplier: Format.commonUser(supplierUser),
      doc_data,
      branch,
    }
  },
  signer: ({ reads: { supplierUser } }) => Format.commonUser(supplierUser).full_name_or_short_name,
})
