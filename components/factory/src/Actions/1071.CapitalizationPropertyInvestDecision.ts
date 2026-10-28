import { DraftContract } from 'cooptypes'
import { CapitalizationPropertyInvestDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { CapitalizationPropertyInvestDecision as Template } from '../Templates'

export class Factory extends DocFactory<CapitalizationPropertyInvestDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: CapitalizationPropertyInvestDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const template: ITemplate<CapitalizationPropertyInvestDecision.Model> = await this.getTemplate(DraftContract.contractName.production, CapitalizationPropertyInvestDecision.registry_id, data.block_num)

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const combinedData: CapitalizationPropertyInvestDecision.Model = {meta}

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
