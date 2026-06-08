import { DraftContract } from 'cooptypes'
import { MarketplaceOffer } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { MarketplaceOffer as Template } from '../Templates'

export class Factory extends DocFactory<MarketplaceOffer.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceOffer.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceOffer.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceOffer.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceOffer.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)
    const userData = await this.getUser(data.username, data.block_num)
    const common_user = this.getCommonUser(userData)

    if (!data.marketplace_agreement_number) {
      throw new Error('marketplace_agreement_number обязателен для генерации оферты ЦПП «Стол заказов»')
    }
    if (!data.marketplace_agreement_created_at) {
      throw new Error('marketplace_agreement_created_at обязателен для генерации оферты ЦПП «Стол заказов»')
    }

    const combinedData: MarketplaceOffer.Model = {
      meta,
      coop,
      vars,
      common_user,
      marketplace_agreement_number: data.marketplace_agreement_number,
      marketplace_agreement_created_at: data.marketplace_agreement_created_at,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(common_user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
