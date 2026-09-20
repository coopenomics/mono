import { DraftContract } from 'cooptypes'
import { EducationRidStorageAct } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationRidStorageAct as Template } from '../Templates'

/**
 * Factory для Акта передачи материалов занятия на ответственное хранение
 * (ЦПП «Образование»). Подписывает преподаватель (`data.username`) вместе с
 * отчётом по занятию; уходит параметром `act` действия `edubridge::holdrid`.
 */
export class Factory extends DocFactory<EducationRidStorageAct.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: EducationRidStorageAct.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationRidStorageAct.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationRidStorageAct.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        EducationRidStorageAct.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const userData = await this.getUser(data.username, data.block_num)
    const user = this.getCommonUser(userData)

    // Имя ЦПП фиксировано (как в 3010).
    const program: EducationRidStorageAct.Model['program'] = { name: 'Образование' }

    const combinedData: EducationRidStorageAct.Model = {
      meta,
      coop,
      vars,
      user,
      program,
      rid_hash: data.rid_hash,
      rid_short_hash: this.getShortHash(data.rid_hash),
      amount: this.formatAsset(data.amount),
      rid_type: data.rid_type,
      course_title: data.course_title,
      lesson_number: data.lesson_number,
      lesson_topic: data.lesson_topic,
      held_at: data.held_at,
      duration_minutes: data.duration_minutes,
      materials: data.materials,
      hold_until: data.hold_until,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(
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
