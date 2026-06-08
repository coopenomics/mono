import { DraftContract } from 'cooptypes'
import { MarketplaceTransportNote } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { ExternalOrganizationData } from '../Models'

export { MarketplaceTransportNote as Template } from '../Templates'

export class Factory extends DocFactory<MarketplaceTransportNote.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceTransportNote.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceTransportNote.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceTransportNote.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceTransportNote.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    // Поставщик — резолвим по supplier_account в орг-или-ФИО
    // (full_name_or_short_name): физлицо/ИП → ФИО, организация → краткое имя.
    const supplierUser = await this.getUser(data.supplier_account, data.block_num)
    const supplier = this.getCommonUser(supplierUser)

    // Карточка КУ-приёмника по braname (если кооператив бранчевый).
    let branch: ExternalOrganizationData | undefined
    if (data.accept_braname)
      branch = await this.getOrganization(data.accept_braname, data.block_num)

    // Приватные данные экспедитора и параметры перевозки — из коллекции
    // `doc_private_data` по `doc_data_hash`. См. раздел «Document
    // Generation Pattern: doc_data» в архитектуре.
    const doc_data = await this.loadDocData<MarketplaceTransportNote.PrivateData>(data)
    if (!doc_data)
      throw new Error(`Приватный payload ТТН не найден по doc_data_hash=${data.doc_data_hash}`)

    const combinedData: MarketplaceTransportNote.Model = {
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
      supplier,
      doc_data,
      branch,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(supplier.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
