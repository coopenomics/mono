import { DraftContract } from 'cooptypes'
import { EducationConvertStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationConvertStatement as Template } from '../Templates'

/**
 * Factory для Заявления о конвертации паевого взноса в членский взнос по
 * ЦПП «Образование» (процесс p.edu.access). Генерируется при открытии или
 * продлении подписки и подписывается пайщиком (`data.username`) перед
 * `edubridge::convert`. Зеркало 1110.MarketplaceConvertStatement.
 */
export class Factory extends DocFactory<EducationConvertStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: EducationConvertStatement.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationConvertStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationConvertStatement.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        EducationConvertStatement.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const userData = await this.getUser(data.username, data.block_num)
    const user = this.getCommonUser(userData)

    // Имя ЦПП фиксировано (как в 1110).
    const program: EducationConvertStatement.Model['program'] = { name: 'Образование' }

    // Период подписки on-chain хранится как eosio::name (month|year);
    // в документ идёт человекочитаемая форма.
    const periodHuman: Record<string, string> = { month: 'один месяц', year: 'один год' }
    const period_human = periodHuman[data.period] ?? data.period

    const combinedData: EducationConvertStatement.Model = {
      meta,
      coop,
      vars,
      user,
      program,
      sub_hash: data.sub_hash,
      // В документ сумма идёт человеку, а не цепи: «1000.0000 RUB» → «1000.00 RUB».
      amount: this.formatAsset(data.amount),
      course_title: data.course_title,
      period: data.period,
      period_human,
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
