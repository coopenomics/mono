import { Cooperative, DraftContract } from 'cooptypes'
import { BranchFinancialAidProtocol } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchFinancialAidProtocol as Template } from '../Templates'

/**
 * Factory для Протокола совета о выплате материальной помощи доверенному
 * лицу кооперативного участка (requirement b6, процесс p.brn.aid).
 * Генерируется на этапе авторизации Решения совета — председатель подписывает
 * этот документ через стандартный sov.decision flow (`soviet::authorize`),
 * `soviet::exec` зовёт callback `branch::onaidauth(coopname, hash,
 * authorization)` с этим Протоколом в качестве `authorization`.
 */
export class Factory extends DocFactory<BranchFinancialAidProtocol.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: BranchFinancialAidProtocol.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    const { template, coop, vars, receiverData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchFinancialAidProtocol.Template as ITemplate<BranchFinancialAidProtocol.Model>)
        : this.getTemplate<BranchFinancialAidProtocol.Model>(
            DraftContract.contractName.production,
            BranchFinancialAidProtocol.registry_id,
            data.block_num,
          ),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      receiverData: () => super.getUser(data.receiver, data.block_num),
    })

    const receiver = this.getCommonUser(receiverData)

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const decision: Cooperative.Document.IDecisionData = await this.getDecision(
      coop,
      data.coopname,
      data.decision_id,
      meta.created_at,
    )

    const combinedData: BranchFinancialAidProtocol.Model = {
      meta,
      coop,
      vars,
      decision,
      aid_hash: data.aid_hash,
      receiver,
      braname: data.braname,
      // Сумма в документ идёт человеческим форматом (2 знака), а не сырым
      // ассетом цепи с четырьмя знаками.
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
