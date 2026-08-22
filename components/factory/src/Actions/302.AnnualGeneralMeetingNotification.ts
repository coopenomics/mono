import { DraftContract } from 'cooptypes'
import { AnnualGeneralMeetingNotification } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { AnnualGeneralMeetingNotification as Template } from '../Templates'

export class Factory extends DocFactory<AnnualGeneralMeetingNotification.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: AnnualGeneralMeetingNotification.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, meet } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(AnnualGeneralMeetingNotification.Template as ITemplate<AnnualGeneralMeetingNotification.Model>)
        : this.getTemplate<AnnualGeneralMeetingNotification.Model>(DraftContract.contractName.production, AnnualGeneralMeetingNotification.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      // Собрание по хэшу — аргументы из data, не зависит от coop/vars
      meet: () => super.getMeet(data.coopname, data.meet_hash, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })
    const questions = await super.getMeetQuestions(data.coopname, Number(meet.id), data.block_num)

    // Данные уже приходят отформатированными из метода getMeet,
    // дополнительная обработка времени не требуется

    // Извлекаем данные пользователя (председателя) и преобразуем в общий формат
    const userData = await super.getUser(meet.presider, data.block_num)
    const user = super.getCommonUser(userData)

    const combinedData: AnnualGeneralMeetingNotification.Model = {
      meta,
      coop,
      vars,
      meet,
      questions,
      user,
    }
    console.log(combinedData)
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
