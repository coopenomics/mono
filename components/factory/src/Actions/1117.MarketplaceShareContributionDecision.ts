import { DraftContract } from 'cooptypes'
import type { Cooperative } from 'cooptypes'
import { MarketplaceShareContributionDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { MarketplaceShareContributionDecision as Template } from '../Templates'

/**
 * Протокол решения совета о принятии имущества и восстановлении паевого взноса (1117) —
 * гарантийный возврат в паевой модели Стола заказов. Генерируется при утверждении решения
 * (`soviet::authorize`), обычно роботом решений совета; данные решения
 * (номер, дата, голоса) берутся из цепи через `getDecision`.
 */
export class Factory extends DocFactory<MarketplaceShareContributionDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceShareContributionDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceShareContributionDecision.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceShareContributionDecision.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceShareContributionDecision.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await super.getCooperative(data.coopname, data.block_num)
    const vars = await super.getVars(data.coopname, data.block_num)
    const user = await this.getUser(data.username, data.block_num)
    const commonUser = this.getCommonUser(user)

    const decision: Cooperative.Document.IDecisionData = await this.getDecision(coop, data.coopname, data.decision_id, meta.created_at)

    const cleanNum = (s: string): string => {
      const n = Number.parseFloat(s)
      return Number.isFinite(n) ? String(n) : s
    }
    const request: MarketplaceShareContributionDecision.Model['request'] = {
      hash: data.sku,
      title: data.product_title,
      unit_of_measurement: data.unit_of_measurement,
      units: data.actual_quantity,
      unit_cost: cleanNum(data.unit_cost),
      total_cost: cleanNum(data.fact_cost),
      currency: data.currency,
      type: 'receive',
      program_id: 0,
    }
    const program: MarketplaceShareContributionDecision.Model['program'] = { name: 'Стол заказов' }

    const combinedData: MarketplaceShareContributionDecision.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      request,
      decision,
      program,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    return this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)
  }
}
