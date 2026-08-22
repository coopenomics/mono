import { DraftContract } from 'cooptypes'
import { MarketplaceOfferTemplate } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { MarketplaceOfferTemplate as Template } from '../Templates'

export class Factory extends DocFactory<MarketplaceOfferTemplate.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceOfferTemplate.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceOfferTemplate.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceOfferTemplate.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceOfferTemplate.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const combinedData: MarketplaceOfferTemplate.Model = {
      meta,
      coop,
      vars,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
