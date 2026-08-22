import { DraftContract } from 'cooptypes'
import { ConvertToAxonStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { ConvertToAxonStatement as Template } from '../Templates'

export class Factory extends DocFactory<ConvertToAxonStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: ConvertToAxonStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, user } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(ConvertToAxonStatement.Template as ITemplate<ConvertToAxonStatement.Model>)
        : this.getTemplate<ConvertToAxonStatement.Model>(DraftContract.contractName.production, ConvertToAxonStatement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      user: () => super.getUser(data.username, data.block_num),
    })

    // meta зависит от template.title, commonUser зависит от user — резолвим после батча
    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })
    const commonUser = super.getCommonUser(user)

    const combinedData: ConvertToAxonStatement.Model = {
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
