import { Cooperative, DraftContract } from 'cooptypes'
import { MarketplaceWriteoffProtocol } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { MarketplaceWriteoffProtocol as Template } from '../Templates'

/**
 * Factory для Протокола совета о списании скоропорта (Эпик 8 / Story 8.4).
 * Генерируется на этапе авторизации Решения совета — chairman подписывает
 * этот документ через стандартный sov.decision flow (`soviet::authorize`),
 * `soviet::exec` зовёт callback `marketplace::onmktwoauth(coopname, hash,
 * authorization)` с этим Протоколом в качестве `authorization`.
 */
export class Factory extends DocFactory<MarketplaceWriteoffProtocol.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: MarketplaceWriteoffProtocol.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceWriteoffProtocol.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceWriteoffProtocol.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        MarketplaceWriteoffProtocol.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await super.getCooperative(data.coopname, data.block_num)
    const vars = await super.getVars(data.coopname, data.block_num)

    const decision: Cooperative.Document.IDecisionData = await this.getDecision(
      coop,
      data.coopname,
      data.decision_id,
      meta.created_at,
    )

    const combinedData: MarketplaceWriteoffProtocol.Model = {
      meta,
      coop,
      vars,
      decision,
      proposal_hash: data.proposal_hash,
      cycle_started_at: data.cycle_started_at,
      total_amount: data.total_amount,
      items_count: data.items_count,
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
