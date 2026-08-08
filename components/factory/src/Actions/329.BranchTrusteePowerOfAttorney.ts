import { DraftContract } from 'cooptypes'
import { BranchTrusteePowerOfAttorney } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchTrusteePowerOfAttorney as Template } from '../Templates'

export class Factory extends DocFactory<BranchTrusteePowerOfAttorney.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BranchTrusteePowerOfAttorney.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchTrusteePowerOfAttorney.Template as ITemplate<BranchTrusteePowerOfAttorney.Model>)
        : this.getTemplate<BranchTrusteePowerOfAttorney.Model>(DraftContract.contractName.production, BranchTrusteePowerOfAttorney.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    if (userData.type !== 'individual')
      throw new Error('Председателем кооперативного участка может быть только физическое лицо')

    const individual = userData.data as BranchTrusteePowerOfAttorney.Model['individual']

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    const combinedData: BranchTrusteePowerOfAttorney.Model = {
      meta,
      coop,
      vars,
      individual,
      branch_name: data.branch_name,
      branch_address: data.branch_address,
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
