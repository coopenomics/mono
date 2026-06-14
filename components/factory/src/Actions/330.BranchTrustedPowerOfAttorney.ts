import { DraftContract } from 'cooptypes'
import { BranchTrustedPowerOfAttorney } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchTrustedPowerOfAttorney as Template } from '../Templates'

export class Factory extends DocFactory<BranchTrustedPowerOfAttorney.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BranchTrustedPowerOfAttorney.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData, trusteeUser } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchTrustedPowerOfAttorney.Template as ITemplate<BranchTrustedPowerOfAttorney.Model>)
        : this.getTemplate<BranchTrustedPowerOfAttorney.Model>(DraftContract.contractName.production, BranchTrustedPowerOfAttorney.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
      trusteeUser: () => super.getUser(data.trustee, data.block_num),
    })

    if (userData.type !== 'individual')
      throw new Error('Доверенным лицом кооперативного участка может быть только физическое лицо')

    const individual = userData.data as BranchTrustedPowerOfAttorney.Model['individual']

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    // ФИО председателя участка резолвим из приватных данных аккаунта;
    // в meta уходит только username председателя
    const trustee_full_name = super.getCommonUser(trusteeUser).full_name_or_short_name

    const combinedData: BranchTrustedPowerOfAttorney.Model = {
      meta,
      coop,
      vars,
      individual,
      branch_name: data.branch_name,
      trustee_full_name,
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
