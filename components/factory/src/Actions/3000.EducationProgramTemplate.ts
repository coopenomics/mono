import { DraftContract } from 'cooptypes'
import { EducationProgramTemplate } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationProgramTemplate as Template } from '../Templates'

/**
 * Factory для шаблона-документа совета ЦПП «Образование» (EducationProgramTemplate).
 * Утверждается Советом; персональных данных не содержит.
 */
export class Factory extends DocFactory<EducationProgramTemplate.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: EducationProgramTemplate.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationProgramTemplate.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationProgramTemplate.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, EducationProgramTemplate.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const combinedData: EducationProgramTemplate.Model = {
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
