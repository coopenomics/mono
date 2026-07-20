import { DraftContract } from 'cooptypes'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { ParticipantExitApplication } from '../Templates'

export { ParticipantExitApplication as Template } from '../Templates'

export class Factory extends DocFactory<ParticipantExitApplication.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: ParticipantExitApplication.Action, _options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, user, coop, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(ParticipantExitApplication.Template as ITemplate<ParticipantExitApplication.Model>)
        : this.getTemplate<ParticipantExitApplication.Model>(DraftContract.contractName.production, ParticipantExitApplication.registry_id, data.block_num),
      user: () => super.getUser(data.username, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
    })

    const userData = {
      [user.type]: user.data,
    }

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data }) // Генерируем мета-данные

    const combinedData: ParticipantExitApplication.Model = {
      ...userData,
      meta,
      coop,
      type: user.type,
      vars,
    }

    // валидируем скомбинированные данные
    await super.validate(combinedData, template.model)

    // получаем комплекс перевода
    const translation = template.translations[meta.lang]

    // генерируем документ
    const document: IGeneratedDocument = await super.generatePDF('', template.context, combinedData, translation, meta, data.skip_save)

    return document
  }
}
