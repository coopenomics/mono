import { DraftContract } from 'cooptypes'
import { ReturnByAssetStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { ReturnByAssetStatement as Template } from '../Templates'

export class Factory extends DocFactory<ReturnByAssetStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: ReturnByAssetStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, user } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(ReturnByAssetStatement.Template as ITemplate<ReturnByAssetStatement.Model>)
        : this.getTemplate<ReturnByAssetStatement.Model>(DraftContract.contractName.production, ReturnByAssetStatement.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      user: () => this.getUser(data.username, data.block_num),
    })

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data }) // зависит от template.title

    const request = data.request

    const commonUser = this.getCommonUser(user)

    const combinedData: ReturnByAssetStatement.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      request,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await super.generatePDF(commonUser.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
