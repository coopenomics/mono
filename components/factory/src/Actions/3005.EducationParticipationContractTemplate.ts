import { DraftContract } from 'cooptypes'
import { EducationParticipationContractTemplate } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationParticipationContractTemplate as Template } from '../Templates'

/**
 * Factory для шаблона-документа совета ЦПП «Образование» (EducationParticipationContractTemplate).
 * Утверждается Советом; персональных данных не содержит.
 */
export class Factory extends DocFactory<EducationParticipationContractTemplate.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: EducationParticipationContractTemplate.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationParticipationContractTemplate.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationParticipationContractTemplate.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, EducationParticipationContractTemplate.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const combinedData: EducationParticipationContractTemplate.Model = {
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
