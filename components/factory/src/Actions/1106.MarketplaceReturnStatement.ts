import { DraftContract } from 'cooptypes'
import { MarketplaceReturnStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { ExternalOrganizationData } from '../Models'

export { MarketplaceReturnStatement as Template } from '../Templates'

export class Factory extends DocFactory<MarketplaceReturnStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceReturnStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceReturnStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceReturnStatement.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceReturnStatement.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const user = await this.getUser(data.username, data.block_num)
    const commonUser = this.getCommonUser(user)

    // Артикул/наименование/единица/цена — напрямую из Action (заказ+оферта на
    // стороне controller'а), а не из getRequest(): та заглушка возвращает
    // фиксированные тестовые данные независимо от order_id (см. review
    // 2026-07-27 — во всех заявлениях показывало «Молоко Бурёнка» и цену 1000).
    const request: MarketplaceReturnStatement.Model['request'] = {
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

    // Имя ЦПП фиксировано для стола заказов (не из заглушки реестра).
    const program: MarketplaceReturnStatement.Model['program'] = { name: 'Стол заказов' }

    const combinedData: MarketplaceReturnStatement.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      request,
      program,
      fact_cost: data.fact_cost,
      actual_quantity: String(data.actual_quantity),
      reason_text: data.reason_text,
      defect_category: data.defect_category,
      branch,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(commonUser.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
