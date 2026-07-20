import { DraftContract } from 'cooptypes'
import { AssetContributionStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { AssetContributionStatement as Template } from '../Templates'

export class Factory extends DocFactory<AssetContributionStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: AssetContributionStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, user } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(AssetContributionStatement.Template as ITemplate<AssetContributionStatement.Model>)
        : this.getTemplate<AssetContributionStatement.Model>(DraftContract.contractName.production, AssetContributionStatement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      user: () => super.getUser(data.username, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data }) // зависит от template.title

    const request = data.request

    const commonUser = this.getCommonUser(user)

    const combinedData: AssetContributionStatement.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      request,
    }

    await super.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await super.generatePDF(commonUser.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
