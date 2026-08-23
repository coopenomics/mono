import { DraftContract } from 'cooptypes'
import { BranchTrustedStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchTrustedStatement as Template } from '../Templates'

export class Factory extends DocFactory<BranchTrustedStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BranchTrustedStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchTrustedStatement.Template as ITemplate<BranchTrustedStatement.Model>)
        : this.getTemplate<BranchTrustedStatement.Model>(DraftContract.contractName.production, BranchTrustedStatement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })
    const user = super.getCommonUser(userData)

    const combinedData: BranchTrustedStatement.Model = {
      meta,
      coop,
      vars,
      user,
      braname: data.braname,
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF(
      user.full_name_or_short_name,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )

    return document
  }
}
