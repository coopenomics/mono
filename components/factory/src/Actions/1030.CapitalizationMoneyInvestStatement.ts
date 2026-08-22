import { DraftContract } from 'cooptypes'
import { CapitalizationMoneyInvestStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { CapitalizationMoneyInvestStatement as Template } from '../Templates'

export class Factory extends DocFactory<CapitalizationMoneyInvestStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: CapitalizationMoneyInvestStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(CapitalizationMoneyInvestStatement.Template as ITemplate<CapitalizationMoneyInvestStatement.Model>)
        : this.getTemplate<CapitalizationMoneyInvestStatement.Model>(DraftContract.contractName.production, CapitalizationMoneyInvestStatement.registry_id, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data }) // зависит от template.title
    const common_user = super.getCommonUser(userData)

    const combinedData: CapitalizationMoneyInvestStatement.Model = {
      meta,
      vars,
      common_user,
      amount: super.formatAsset(data.amount),
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
