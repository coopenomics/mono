import { DraftContract } from 'cooptypes'
import { AnnualGeneralMeetingVotingBallot } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { AnnualGeneralMeetingVotingBallot as Template } from '../Templates'

export class Factory extends DocFactory<AnnualGeneralMeetingVotingBallot.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: AnnualGeneralMeetingVotingBallot.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData, meet } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(AnnualGeneralMeetingVotingBallot.Template as ITemplate<AnnualGeneralMeetingVotingBallot.Model>)
        : this.getTemplate<AnnualGeneralMeetingVotingBallot.Model>(DraftContract.contractName.production, AnnualGeneralMeetingVotingBallot.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
      // Собрание по хэшу — аргументы из data, не зависит от прочих
      meet: () => super.getMeet(data.coopname, data.meet_hash, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })
    const user = super.getCommonUser(userData)

    // Данные уже приходят отформатированными из метода getMeet,
    // дополнительная обработка времени не требуется

    // Получаем вопросы из блокчейна
    const meetQuestions = await super.getMeetQuestions(data.coopname, Number(meet.id), data.block_num)

    // Преобразуем вопросы из блокчейна в формат, нужный для модели
    const questions = meetQuestions.map(question => ({
      id: question.id.toString(),
      number: question.number.toString(),
      title: question.title,
      context: question.context || '',
      decision: question.decision,
    }))

    // Получаем ответы из входных данных
    const { answers } = data

    // Создаем модель для генерации документа
    const combinedData: AnnualGeneralMeetingVotingBallot.Model = {
      meta,
      coop,
      vars,
      user,
      meet,
      answers,
      questions,
    } as AnnualGeneralMeetingVotingBallot.Model // Используем приведение типов для решения проблемы совместимости

    console.dir(combinedData, { depth: null })

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
