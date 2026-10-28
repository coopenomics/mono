import { DraftContract } from 'cooptypes'
import { GetLoanStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { GetLoanStatement as Template } from '../Templates'

export class Factory extends DocFactory<GetLoanStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GetLoanStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const template: ITemplate<GetLoanStatement.Model> = await this.getTemplate(DraftContract.contractName.production, GetLoanStatement.registry_id, data.block_num)

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const combinedData: GetLoanStatement.Model = {meta}

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
