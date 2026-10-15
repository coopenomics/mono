import { DraftContract } from 'cooptypes'
import { EducationGuaranteeStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationGuaranteeStatement as Template } from '../Templates'

/**
 * Factory для Заявления пайщика-ученика об аннулировании Подписки по
 * Гарантийным условиям (ЦПП «Образование», пункт 4.4.2 Положения).
 * Подписывает ученик (`data.username`). Реквизиты Положения шаблон берёт из
 * `vars.education_provision`.
 */
export class Factory extends DocFactory<EducationGuaranteeStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: EducationGuaranteeStatement.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationGuaranteeStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationGuaranteeStatement.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        EducationGuaranteeStatement.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    // Заявление ссылается на протокол утверждения Положения — без него текст неполон.
    if (!vars.education_provision?.protocol_number || !vars.education_provision?.protocol_day_month_year)
      throw new Error('Реквизиты протокола об утверждении Положения о ЦПП «Образование» не заполнены (vars.education_provision)')

    const userData = await this.getUser(data.username, data.block_num)
    const user = this.getCommonUser(userData)

    const combinedData: EducationGuaranteeStatement.Model = {
      meta,
      coop,
      vars,
      user,
      claim_hash: data.claim_hash,
      // В документ идёт короткий номер заявления — первые 8 символов идентификатора.
      claim_short_hash: this.getShortHash(data.claim_hash, 8),
      course_title: data.course_title,
      subscribed_at: data.subscribed_at,
      // Сумма в документ идёт человеческим форматом (2 знака), не сырым ассетом.
      amount: this.formatAsset(data.amount),
      guarantee_until: data.guarantee_until,
      reason: data.reason,
      links: data.links ?? [],
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
