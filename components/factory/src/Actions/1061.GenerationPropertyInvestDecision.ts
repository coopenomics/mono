import { DraftContract } from 'cooptypes'
import { GenerationPropertyInvestDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { GenerationPropertyInvestDecision as Template } from '../Templates'

export class Factory extends DocFactory<GenerationPropertyInvestDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GenerationPropertyInvestDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const template: ITemplate<GenerationPropertyInvestDecision.Model> = await this.getTemplate(DraftContract.contractName.production, GenerationPropertyInvestDecision.registry_id, data.block_num)

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const combinedData: GenerationPropertyInvestDecision.Model = {meta}

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
