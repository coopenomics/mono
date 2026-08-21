import { DraftContract } from 'cooptypes'
import { EducationTeacherOfferTemplate } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationTeacherOfferTemplate as Template } from '../Templates'

/**
 * Factory для шаблона-документа совета ЦПП «Образование» (EducationTeacherOfferTemplate).
 * Утверждается Советом; персональных данных не содержит.
 */
export class Factory extends DocFactory<EducationTeacherOfferTemplate.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: EducationTeacherOfferTemplate.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationTeacherOfferTemplate.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationTeacherOfferTemplate.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, EducationTeacherOfferTemplate.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const combinedData: EducationTeacherOfferTemplate.Model = {
      meta,
      coop,
      vars,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
