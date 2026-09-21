import { DraftContract } from 'cooptypes'
import { EducationReturnStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationReturnStatement as Template } from '../Templates'

/**
 * Factory для Заявления о возврате членского взноса по ЦПП «Образование» в
 * паевой взнос (процесс p.edu.access). Подписывается пайщиком
 * (`data.username`) и после согласования кооперативом уходит в
 * `edubridge::retshare`. Зеркало 3011 в обратную сторону.
 */
export class Factory extends DocFactory<EducationReturnStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: EducationReturnStatement.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationReturnStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationReturnStatement.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        EducationReturnStatement.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const userData = await this.getUser(data.username, data.block_num)
    const user = this.getCommonUser(userData)

    // Имя ЦПП фиксировано (как в 3011).
    const program: EducationReturnStatement.Model['program'] = { name: 'Образование' }

    const combinedData: EducationReturnStatement.Model = {
      meta,
      coop,
      vars,
      user,
      program,
      // В документ сумма идёт человеку, а не цепи: «1000.0000 RUB» → «1000.00 RUB».
      amount: this.formatAsset(data.amount),
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
