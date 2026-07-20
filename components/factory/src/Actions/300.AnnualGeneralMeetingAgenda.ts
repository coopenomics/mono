import { DraftContract } from 'cooptypes'
import { AnnualGeneralMeetingAgenda } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { AnnualGeneralMeetingAgenda as Template } from '../Templates'

export class Factory extends DocFactory<AnnualGeneralMeetingAgenda.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: AnnualGeneralMeetingAgenda.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(AnnualGeneralMeetingAgenda.Template as ITemplate<AnnualGeneralMeetingAgenda.Model>)
        : this.getTemplate<AnnualGeneralMeetingAgenda.Model>(DraftContract.contractName.production, AnnualGeneralMeetingAgenda.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })
    const user = super.getCommonUser(userData)

    // Используем данные напрямую из Action, так как собрание еще не создано в блокчейне
    // Создаем копию данных, чтобы не изменять исходные
    const meet = { ...data.meet }
    const questions = [...data.questions]

    // Предполагается, что даты уже приходят в московском формате с фронтенда
    // Сохраняем их как есть, без дополнительного преобразования или добавления суффикса
    const combinedData: AnnualGeneralMeetingAgenda.Model = {
      meta,
      coop,
      vars,
      meet,
      questions,
      user,
      is_repeated: data.is_repeated,
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
