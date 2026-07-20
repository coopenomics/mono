import { type Cooperative, DraftContract } from 'cooptypes'
import { DocFactory } from '../Factory'
import type {
  IGeneratedDocument,
  IGenerationOptions,
  IMetaDocument,
  ITemplate,
} from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

import { FreeDecision } from '../Templates'

export { FreeDecision as Template } from '../Templates'

export class Factory extends DocFactory<FreeDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: FreeDecision.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    if (!data.project_id)
      throw new Error('Идентификатор проекта не установлен')

    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, user, coop, project, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(FreeDecision.Template as ITemplate<FreeDecision.Model>)
        : this.getTemplate<FreeDecision.Model>(DraftContract.contractName.production, FreeDecision.registry_id, data.block_num),
      user: () => this.getUser(data.username, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      project: () => this.getProject(data.project_id, data.block_num) as Promise<Cooperative.Document.IProjectData>,
      vars: () => super.getVars(data.coopname, data.block_num),
    })

    const userData = {
      [user.type]: user.data,
    }

    // meta зависит от template.title — считаем после батча
    // TODO необходимо строго типизировать мета-данные документов друг под друга!
    const meta: IMetaDocument = await this.getMeta({
      title: template.title,
      ...data,
    }) // Генерируем мета-данные

    // decision зависит от coop и meta.created_at — после батча
    const decision: Cooperative.Document.IDecisionData = await this.getDecision(
      coop,
      data.coopname,
      data.decision_id,
      meta.created_at,
    )

    const combinedData: FreeDecision.Model = {
      ...userData,
      meta,
      coop,
      decision,
      project,
      vars,
    }

    // валидируем скомбинированные данные
    await this.validate(combinedData, template.model)

    // получаем комплекс перевода
    const translation = template.translations[meta.lang]

    // генерируем документ
    const document: IGeneratedDocument = await this.generatePDF(
      '',
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
