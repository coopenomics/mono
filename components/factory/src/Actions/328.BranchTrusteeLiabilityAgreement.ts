import { DraftContract } from 'cooptypes'
import { BranchTrusteeLiabilityAgreement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchTrusteeLiabilityAgreement as Template } from '../Templates'

export class Factory extends DocFactory<BranchTrusteeLiabilityAgreement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BranchTrusteeLiabilityAgreement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchTrusteeLiabilityAgreement.Template as ITemplate<BranchTrusteeLiabilityAgreement.Model>)
        : this.getTemplate<BranchTrusteeLiabilityAgreement.Model>(DraftContract.contractName.production, BranchTrusteeLiabilityAgreement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    if (userData.type !== 'individual')
      throw new Error('Председателем кооперативного участка может быть только физическое лицо')

    const individual = userData.data as BranchTrusteeLiabilityAgreement.Model['individual']

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    const combinedData: BranchTrusteeLiabilityAgreement.Model = {
      meta,
      coop,
      vars,
      individual,
      branch_name: data.branch_name,
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF(
      individual.last_name + ' ' + individual.first_name + ' ' + individual.middle_name,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )

    return document
  }
}
