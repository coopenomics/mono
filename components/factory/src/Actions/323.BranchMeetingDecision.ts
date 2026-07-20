import { DraftContract } from 'cooptypes'
import { BranchMeetingDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchMeetingDecision as Template } from '../Templates'

export class Factory extends DocFactory<BranchMeetingDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BranchMeetingDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, chairmanUser } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchMeetingDecision.Template as ITemplate<BranchMeetingDecision.Model>)
        : this.getTemplate<BranchMeetingDecision.Model>(DraftContract.contractName.production, BranchMeetingDecision.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      chairmanUser: () => super.getUser(data.chairman, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    // ФИО председателя собрания резолвим из приватных данных аккаунта на момент генерации
    // (в meta уходит только username председателя)
    const chairman_full_name = super.getCommonUser(chairmanUser).full_name_or_short_name

    const combinedData: BranchMeetingDecision.Model = {
      meta,
      coop,
      vars,
      protocol_number: data.protocol_number,
      chairman_full_name,
      open_at_datetime: data.open_at_datetime,
      close_at_datetime: data.close_at_datetime,
      current_quorum_percent: data.current_quorum_percent,
      questions: data.questions,
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF(
      chairman_full_name,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )

    return document
  }
}
