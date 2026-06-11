import { DraftContract } from 'cooptypes'
import { BranchMeetingProposal } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchMeetingProposal as Template } from '../Templates'

export class Factory extends DocFactory<BranchMeetingProposal.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BranchMeetingProposal.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchMeetingProposal.Template as ITemplate<BranchMeetingProposal.Model>)
        : this.getTemplate<BranchMeetingProposal.Model>(DraftContract.contractName.production, BranchMeetingProposal.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })
    const user = super.getCommonUser(userData)

    const combinedData: BranchMeetingProposal.Model = {
      meta,
      coop,
      vars,
      user,
      type: data.type,
      questions: data.questions,
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
