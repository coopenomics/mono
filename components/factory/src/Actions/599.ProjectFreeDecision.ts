import { type Cooperative, DraftContract } from 'cooptypes'
import { DocFactory } from '../Factory'
import type {
  IGeneratedDocument,
  IGenerationOptions,
  IMetaDocument,
  ITemplate,
} from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

import { ProjectFreeDecision } from '../Templates'

export { ProjectFreeDecision as Template } from '../Templates'

export class Factory extends DocFactory<ProjectFreeDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: ProjectFreeDecision.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, user, coop, project, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(ProjectFreeDecision.Template as ITemplate<ProjectFreeDecision.Model>)
        : this.getTemplate<ProjectFreeDecision.Model>(DraftContract.contractName.production, ProjectFreeDecision.registry_id, data.block_num),
      user: () => this.getUser(data.username, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      project: () => this.getProject(data.project_id, data.block_num) as Promise<Cooperative.Document.IProjectData>,
      vars: () => super.getVars(data.coopname, data.block_num),
    })

    const suggester_name = await this.getFullName(user.data) // зависит от user
    const userData = {
      [user.type]: user.data,
    }

    const metaTitle
      = data.title?.trim()?.substring(0, 200)
        || project.title?.trim()?.substring(0, 200)
        || template.title

    const meta: IMetaDocument = await this.getMeta({
      ...data,
      title: metaTitle,
    }) // Генерируем мета-данные

    const combinedData: ProjectFreeDecision.Model = {
      ...userData,
      vars,
      meta,
      coop,
      project,
      suggester_name,
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
