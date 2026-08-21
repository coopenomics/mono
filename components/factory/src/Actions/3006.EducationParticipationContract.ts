import { DraftContract } from 'cooptypes'
import { EducationParticipationContract } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationParticipationContract as Template } from '../Templates'

/**
 * Factory для договора УХД преподавателя по ЦПП «Образование».
 * Подписывает преподаватель (`data.username`); номер и дату договора
 * передаёт бэкенд edubridge явно.
 */
export class Factory extends DocFactory<EducationParticipationContract.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: EducationParticipationContract.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationParticipationContract.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationParticipationContract.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, EducationParticipationContract.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)
    const userData = await this.getUser(data.username, data.block_num)
    const common_user = this.getCommonUser(userData)

    const combinedData: EducationParticipationContract.Model = {
      meta,
      coop,
      vars,
      common_user,
      contract_number: data.contract_number,
      contract_created_at: data.contract_created_at,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(common_user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
