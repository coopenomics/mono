import { DraftContract } from 'cooptypes'
import { BranchEstablishmentPetition } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchEstablishmentPetition as Template } from '../Templates'

export class Factory extends DocFactory<BranchEstablishmentPetition.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BranchEstablishmentPetition.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData, chairmanUser } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchEstablishmentPetition.Template as ITemplate<BranchEstablishmentPetition.Model>)
        : this.getTemplate<BranchEstablishmentPetition.Model>(DraftContract.contractName.production, BranchEstablishmentPetition.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
      chairmanUser: () => super.getUser(data.chairman, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })
    const user = super.getCommonUser(userData)
    // ФИО избранного председателя участка резолвим из приватных данных аккаунта;
    // в meta уходит только username председателя
    const chairman_full_name = super.getCommonUser(chairmanUser).full_name_or_short_name

    const combinedData: BranchEstablishmentPetition.Model = {
      meta,
      coop,
      vars,
      user,
      branch_name: data.branch_name,
      address: data.address,
      chairman_full_name,
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
