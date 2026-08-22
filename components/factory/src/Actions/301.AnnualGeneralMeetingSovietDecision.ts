import { DraftContract } from 'cooptypes'
import { AnnualGeneralMeetingSovietDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { AnnualGeneralMeetingSovietDecision as Template } from '../Templates'

export class Factory extends DocFactory<AnnualGeneralMeetingSovietDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: AnnualGeneralMeetingSovietDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(AnnualGeneralMeetingSovietDecision.Template as ITemplate<AnnualGeneralMeetingSovietDecision.Model>)
        : this.getTemplate<AnnualGeneralMeetingSovietDecision.Model>(DraftContract.contractName.production, AnnualGeneralMeetingSovietDecision.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
    })

    // meta зависит от template.title — считаем после батча
    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    // До авторизации решения — голоса в цепочке; после — запись решения удаляется, нужен authorize
    let decision: AnnualGeneralMeetingSovietDecision.Model['decision']
    try {
      decision = await super.getDecision(coop, data.coopname, data.decision_id, meta.created_at)
    }
    catch {
      decision = await super.getApprovedDecision(coop, data.coopname, data.decision_id)
    }

    // Извлекаем данные собрания из блокчейна по хэшу
    const meet = await super.getMeet(data.coopname, data.meet_hash, data.block_num)
    const questions = await super.getMeetQuestions(data.coopname, Number(meet.id), data.block_num)

    // Данные уже приходят отформатированными из метода getMeet,
    // дополнительная обработка времени не требуется

    const combinedData: AnnualGeneralMeetingSovietDecision.Model = {
      meta,
      coop,
      vars,
      decision,
      meet,
      questions,
      is_repeated: data.is_repeated,
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF(
      `${coop.chairman.last_name} ${coop.chairman.first_name} ${coop.chairman.middle_name}`,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )

    return document
  }
}
