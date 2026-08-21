import { DraftContract } from 'cooptypes'
import { EducationParentOffer } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationParentOffer as Template } from '../Templates'

/**
 * Factory для экземпляра оферты родителя-слушателя ЦПП «Образование».
 * Подписывает пайщик (`data.username`); номер и дату соглашения передаёт
 * бэкенд edubridge явно (как L3-путь 1102.MarketplaceOffer).
 */
export class Factory extends DocFactory<EducationParentOffer.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: EducationParentOffer.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationParentOffer.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationParentOffer.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, EducationParentOffer.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)
    const userData = await this.getUser(data.username, data.block_num)
    const common_user = this.getCommonUser(userData)

    const combinedData: EducationParentOffer.Model = {
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
