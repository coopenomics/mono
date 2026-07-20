import { type Cooperative, DraftContract } from 'cooptypes'
import { DocFactory } from '../Factory'
import type {
  IGeneratedDocument,
  IGenerationOptions,
  IMetaDocument,
  ITemplate,
} from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

import { InitProjectDecision } from '../Templates'

export { InitProjectDecision as Template } from '../Templates'

export class Factory extends DocFactory<InitProjectDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: InitProjectDecision.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, user, coop, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(InitProjectDecision.Template as ITemplate<InitProjectDecision.Model>)
        : this.getTemplate<InitProjectDecision.Model>(DraftContract.contractName.production, InitProjectDecision.registry_id, data.block_num),
      user: () => this.getUser(data.username, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
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

    const combinedData: InitProjectDecision.Model = {
      ...userData,
      meta,
      coop,
      decision,
      project_name: data.project_name,
      project_hash: data.project_hash,
      component_name: data.component_name,
      component_hash: data.component_hash,
      is_component: data.is_component,
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
