import { DraftContract } from 'cooptypes'
import { EducationCourseAnnex } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationCourseAnnex as Template } from '../Templates'

/**
 * Factory для приложения к договору УХД по курсу (ЦПП «Образование»).
 * Подписывает преподаватель (`data.username`).
 */
export class Factory extends DocFactory<EducationCourseAnnex.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: EducationCourseAnnex.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationCourseAnnex.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationCourseAnnex.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, EducationCourseAnnex.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)
    const userData = await this.getUser(data.username, data.block_num)
    const common_user = this.getCommonUser(userData)

    const combinedData: EducationCourseAnnex.Model = {
      meta,
      coop,
      vars,
      common_user,
      contract_number: data.contract_number,
      course_title: data.course_title,
      schedule: data.schedule,
      expected_result: data.expected_result,
      period_from: data.period_from,
      period_to: data.period_to,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(common_user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
