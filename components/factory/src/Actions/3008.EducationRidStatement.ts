import { DraftContract } from 'cooptypes'
import { EducationRidStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationRidStatement as Template } from '../Templates'

/**
 * Factory для Заявления преподавателя о паевом взносе результатом
 * интеллектуальной деятельности (ЦПП «Образование», процесс p.edu.rid).
 * Подписывает преподаватель (`data.username`) перед `edubridge::submitrid`.
 */
export class Factory extends DocFactory<EducationRidStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: EducationRidStatement.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationRidStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationRidStatement.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        EducationRidStatement.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const userData = await this.getUser(data.username, data.block_num)
    const user = this.getCommonUser(userData)

    // Имя ЦПП фиксировано (как в 1110).
    const program: EducationRidStatement.Model['program'] = { name: 'Образование' }

    const combinedData: EducationRidStatement.Model = {
      meta,
      coop,
      vars,
      user,
      program,
      rid_hash: data.rid_hash,
      assignment_id: data.assignment_id,
      // Сумма в документ идёт человеческим форматом (2 знака), не сырым ассетом.
      amount: this.formatAsset(data.amount),
      rid_type: data.rid_type,
      links: data.links,
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
