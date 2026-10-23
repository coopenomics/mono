import { DraftContract } from 'cooptypes'
import { MarketplaceReturnCancelStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { ExternalOrganizationData } from '../Models'

export { MarketplaceReturnCancelStatement as Template } from '../Templates'

/**
 * Заявление оператора кооперативного участка в совет об отмене сделки по
 * гарантийному возврату (1116). Подписант — оператор (`data.username`),
 * пайщик — `data.orderer`; оба читаются из цепи по имени аккаунта.
 */
export class Factory extends DocFactory<MarketplaceReturnCancelStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceReturnCancelStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceReturnCancelStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceReturnCancelStatement.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceReturnCancelStatement.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const operatorUser = this.getCommonUser(await this.getUser(data.username, data.block_num))
    const ordererUser = this.getCommonUser(await this.getUser(data.orderer, data.block_num))

    // Артикул/наименование/единица/цена — из Action (заказ и оферта на стороне
    // controller'а), а не из заглушки getRequest().
    const request: MarketplaceReturnCancelStatement.Model['request'] = {
      hash: data.sku,
      title: data.product_title,
      unit_of_measurement: data.unit_of_measurement,
      units: data.actual_quantity,
      unit_cost: data.unit_cost,
      total_cost: data.fact_cost,
      currency: data.currency,
      type: 'receive',
      program_id: 0,
    }

    if (coop.is_branched && !data.braname)
      throw new Error('Branch name is required')

    let branch: ExternalOrganizationData | undefined
    if (data.braname)
      branch = await this.getOrganization(data.braname, data.block_num)

    const program: MarketplaceReturnCancelStatement.Model['program'] = { name: 'Стол заказов' }

    const combinedData: MarketplaceReturnCancelStatement.Model = {
      meta,
      coop,
      vars,
      user: operatorUser,
      orderer: ordererUser,
      request,
      program,
      branch,
      fact_cost: data.fact_cost,
      fee_refund: data.fee_refund,
      total_refund: data.total_refund,
      actual_quantity: String(data.actual_quantity),
      reason_text: data.reason_text,
      inspection_result: data.inspection_result,
      order_hash: data.order_hash,
      request_hash: data.request_hash,
      issue_decision_id: data.issue_decision_id > 0 ? String(data.issue_decision_id) : '',
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(operatorUser.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
