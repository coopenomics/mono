import { DraftContract } from 'cooptypes'
import type { Cooperative } from 'cooptypes'
import { EducationGuaranteeDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationGuaranteeDecision as Template } from '../Templates'

/**
 * Factory для Протокола совета об аннулировании Подписки по Гарантийным
 * условиям (ЦПП «Образование», пункты 4.4.2 и 4.4.4 Положения). Генерируется
 * на этапе авторизации Решения совета по Заявлению 3013 (стандартный
 * sov.decision flow). `data.username` — пайщик-ученик, подавший заявление.
 */
export class Factory extends DocFactory<EducationGuaranteeDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: EducationGuaranteeDecision.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(EducationGuaranteeDecision.Template as ITemplate<EducationGuaranteeDecision.Model>)
        : this.getTemplate<EducationGuaranteeDecision.Model>(
            DraftContract.contractName.production,
            EducationGuaranteeDecision.registry_id,
            data.block_num,
          ),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    const user = this.getCommonUser(userData)

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const decision: Cooperative.Document.IDecisionData = await this.getDecision(
      coop,
      data.coopname,
      data.decision_id,
      meta.created_at,
      meta.timezone,
    )

    const combinedData: EducationGuaranteeDecision.Model = {
      meta,
      coop,
      vars,
      decision,
      user,
      claim_hash: data.claim_hash,
      // В документ идёт короткий номер заявления — первые 8 символов идентификатора.
      claim_short_hash: this.getShortHash(data.claim_hash, 8),
      course_title: data.course_title,
      // Сумма в документ идёт человеческим форматом (2 знака), не сырым ассетом.
      amount: this.formatAsset(data.amount),
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(
      '',
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )
    return document
  }
}
