import { DraftContract } from 'cooptypes'
import { InitProjectStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { InitProjectStatement as Template } from '../Templates'

export class Factory extends DocFactory<InitProjectStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: InitProjectStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(InitProjectStatement.Template as ITemplate<InitProjectStatement.Model>)
        : this.getTemplate<InitProjectStatement.Model>(DraftContract.contractName.production, InitProjectStatement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data }) // зависит от template.title
    const user = super.getCommonUser(userData)

    const combinedData: InitProjectStatement.Model = {
      meta,
      coop,
      vars,
      user,
      project_name: data.project_name,
      project_hash: data.project_hash,
      component_name: data.component_name,
      component_hash: data.component_hash,
      is_component: data.is_component,
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
