import { type Cooperative, DraftContract } from 'cooptypes'
import { DocFactory } from '../Factory'
import type {
  IGeneratedDocument,
  IGenerationOptions,
  IMetaDocument,
  ITemplate,
} from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

import { DecisionOfParticipantExit } from '../Templates'

export { DecisionOfParticipantExit as Template } from '../Templates'

export class Factory extends DocFactory<DecisionOfParticipantExit.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: DecisionOfParticipantExit.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, user, coop, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(DecisionOfParticipantExit.Template as ITemplate<DecisionOfParticipantExit.Model>)
        : this.getTemplate<DecisionOfParticipantExit.Model>(DraftContract.contractName.production, DecisionOfParticipantExit.registry_id, data.block_num),
      user: () => super.getUser(data.username, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
    })

    const userData = {
      [user.type]: user.data,
    }

    // meta зависит от template.title — считаем после батча
    const meta: IMetaDocument = await super.getMeta({
      title: template.title,
      ...data,
    }) // Генерируем мета-данные

    // decision зависит от coop и meta.created_at — после батча
    const decision: Cooperative.Document.IDecisionData = await super.getDecision(
      coop,
      data.coopname,
      data.decision_id,
      meta.created_at,
    )

    const combinedData: DecisionOfParticipantExit.Model = {
      ...userData,
      vars,
      meta,
      coop,
      type: user.type,
      decision,
    }

    // валидируем скомбинированные данные
    await super.validate(combinedData, template.model)

    // получаем комплекс перевода
    const translation = template.translations[meta.lang]

    // генерируем документ
    const document: IGeneratedDocument = await super.generatePDF(
      user.data,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )

    // возвращаем
    return document
  }
}
