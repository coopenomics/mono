import { Cooperative, DraftContract } from 'cooptypes'
import { GeneratorProgramTemplate } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { GeneratorProgramTemplate as Template } from '../Templates'

export class Factory extends DocFactory<GeneratorProgramTemplate.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GeneratorProgramTemplate.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, vars, coop, docData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(GeneratorProgramTemplate.Template as ITemplate<GeneratorProgramTemplate.Model>)
        : this.getTemplate<GeneratorProgramTemplate.Model>(DraftContract.contractName.production, GeneratorProgramTemplate.registry_id, data.block_num),
      vars: () => this.getVars(data.coopname),
      coop: () => this.getCooperative(data.coopname),
      docData: () => this.loadDocData<GeneratorProgramTemplate.Model['doc_data']>(data),
    })

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const doc_data = Cooperative.Registry.requireCapitalProgramPrivateData(docData, GeneratorProgramTemplate.registry_id)

    const combinedData: GeneratorProgramTemplate.Model = {
      meta,
      coop,
      vars,
      doc_data,
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
