import { DraftContract } from 'cooptypes'
import type { Cooperative } from 'cooptypes'
import { MarketplaceReturnCancelDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { ExternalOrganizationData } from '../Models'

export { MarketplaceReturnCancelDecision as Template } from '../Templates'

/**
 * Протокол решения совета об отмене сделки по гарантийному возврату (1117).
 * Генерируется при утверждении решения (`soviet::authorize`), обычно роботом
 * решений совета; данные решения (номер, дата, голоса) берутся из цепи через
 * `getDecision`. `data.username` — пайщик (автор повестки), `data.operator` —
 * оператор участка, подавший заявление 1116; деловые поля переносятся из
 * метаданных заявления повестки.
 */
export class Factory extends DocFactory<MarketplaceReturnCancelDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceReturnCancelDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceReturnCancelDecision.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceReturnCancelDecision.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceReturnCancelDecision.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await super.getCooperative(data.coopname, data.block_num)
    const vars = await super.getVars(data.coopname, data.block_num)
    const commonUser = this.getCommonUser(await this.getUser(data.username, data.block_num))
    const operatorUser = this.getCommonUser(await this.getUser(data.operator, data.block_num))

    const decision: Cooperative.Document.IDecisionData = await this.getDecision(coop, data.coopname, data.decision_id, meta.created_at)

    const cleanNum = (s: string): string => {
      const n = Number.parseFloat(s)
      return Number.isFinite(n) ? String(n) : s
    }
    const request: MarketplaceReturnCancelDecision.Model['request'] = {
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
    const program: MarketplaceReturnCancelDecision.Model['program'] = { name: 'Стол заказов' }

    let branch: ExternalOrganizationData | undefined
    if (data.braname)
      branch = await this.getOrganization(data.braname, data.block_num)

    const combinedData: MarketplaceReturnCancelDecision.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      operator: operatorUser,
      request,
      decision,
      program,
      branch,
      fact_cost: cleanNum(data.fact_cost),
      fee_refund: cleanNum(data.fee_refund),
      total_refund: cleanNum(data.total_refund),
      reason_text: data.reason_text,
      inspection_result: data.inspection_result,
      order_hash: data.order_hash,
      request_hash: data.request_hash,
      issue_decision_id: Number(data.issue_decision_id) > 0 ? String(data.issue_decision_id) : '',
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    return this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)
  }
}
