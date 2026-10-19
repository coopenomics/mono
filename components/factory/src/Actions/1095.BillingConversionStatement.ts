import { DraftContract } from 'cooptypes'
import { BillingConversionStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BillingConversionStatement as Template } from '../Templates'

export class Factory extends DocFactory<BillingConversionStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BillingConversionStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<BillingConversionStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = BillingConversionStatement.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, BillingConversionStatement.registry_id, data.block_num)
    }
    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    const coop = await super.getCooperative(data.coopname, data.block_num)
    const vars = await super.getVars(data.coopname, data.block_num)
    const user = await super.getUser(data.username, data.block_num)
    const commonUser = super.getCommonUser(user)

    const combinedData: BillingConversionStatement.Model = {
      meta,
      coop,
      vars,
      commonUser,
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
