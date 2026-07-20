import { DraftContract } from 'cooptypes'
import { GenerationContractTemplate } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { GenerationContractTemplate as Template } from '../Templates'

export class Factory extends DocFactory<GenerationContractTemplate.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GenerationContractTemplate.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, vars, coop } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(GenerationContractTemplate.Template as ITemplate<GenerationContractTemplate.Model>)
        : this.getTemplate<GenerationContractTemplate.Model>(DraftContract.contractName.production, GenerationContractTemplate.registry_id, data.block_num),
      vars: () => this.getVars(data.coopname),
      coop: () => this.getCooperative(data.coopname),
    })

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const combinedData: GenerationContractTemplate.Model = {
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
