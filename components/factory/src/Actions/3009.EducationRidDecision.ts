import { Cooperative, DraftContract } from 'cooptypes'
import { EducationRidDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { getEducationContractRef } from '../Utils/educationContractRef'

export { EducationRidDecision as Template } from '../Templates'

/**
 * Factory для Протокола совета о приёме паевого взноса РИД преподавателя
 * (ЦПП «Образование», процесс p.edu.rid). Генерируется на этапе авторизации
 * Решения совета по Заявлению 3008 (стандартный sov.decision flow) и уходит
 * параметром `decision` действий `edubridge::acceptrid` / `declinerid`.
 * `data.username` — преподаватель, подавший заявление.
 */
export class Factory extends DocFactory<EducationRidDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: EducationRidDecision.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(EducationRidDecision.Template as ITemplate<EducationRidDecision.Model>)
        : this.getTemplate<EducationRidDecision.Model>(
            DraftContract.contractName.production,
            EducationRidDecision.registry_id,
            data.block_num,
          ),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    const user = this.getCommonUser(userData)
    const contract = await getEducationContractRef(this.storage, data)
    const program: EducationRidDecision.Model['program'] = { name: 'Образование' }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const decision: Cooperative.Document.IDecisionData = await this.getDecision(
      coop,
      data.coopname,
      data.decision_id,
      meta.created_at,
      meta.timezone,
    )

    const combinedData: EducationRidDecision.Model = {
      meta,
      coop,
      vars,
      decision,
      user,
      program,
      ...contract,
      rid_short_hash: this.getShortHash(data.rid_hash),
      rid_type_human: Cooperative.Registry.educationRidTypeLabel(data.rid_type ?? 'other'),
      rid_hash: data.rid_hash,
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
