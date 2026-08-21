import { DraftContract } from 'cooptypes'
import { EducationTeacherOffer } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationTeacherOffer as Template } from '../Templates'

/**
 * Factory для экземпляра оферты преподавателя ЦПП «Образование».
 * Подписывает пайщик-преподаватель (`data.username`); номер и дату
 * соглашения передаёт бэкенд edubridge явно.
 */
export class Factory extends DocFactory<EducationTeacherOffer.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: EducationTeacherOffer.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationTeacherOffer.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationTeacherOffer.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, EducationTeacherOffer.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)
    const userData = await this.getUser(data.username, data.block_num)
    const common_user = this.getCommonUser(userData)

    const combinedData: EducationTeacherOffer.Model = {
      meta,
      coop,
      vars,
      common_user,
      agreement_number: data.agreement_number,
      agreement_created_at: data.agreement_created_at,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(common_user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
