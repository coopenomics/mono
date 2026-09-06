import { DraftContract } from 'cooptypes'
import { MarketplaceShareReturnStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { ExternalOrganizationData } from '../Models'

export { MarketplaceShareReturnStatement as Template } from '../Templates'

/**
 * Заявление о возврате паевого взноса имуществом (1113) — паевая модель
 * выдачи Стола заказов. Генерируется на пункте выдачи после сверки состава,
 * подписывается заказчиком одним нажатием и уходит в повестку совета.
 */
export class Factory extends DocFactory<MarketplaceShareReturnStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceShareReturnStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceShareReturnStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceShareReturnStatement.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceShareReturnStatement.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)
    const user = await this.getUser(data.username, data.block_num)
    const commonUser = this.getCommonUser(user)

    const cleanNum = (s: string): string => {
      const n = Number.parseFloat(s)
      return Number.isFinite(n) ? String(n) : s
    }
    // Состав — напрямую из данных заказа (артикул, наименование, факт).
    const request: MarketplaceShareReturnStatement.Model['request'] = {
      hash: data.sku,
      title: data.product_title,
      unit_of_measurement: data.unit_of_measurement,
      units: data.fact_quantity,
      unit_cost: cleanNum(data.unit_cost),
      total_cost: cleanNum(data.total_amount),
      currency: data.currency,
      type: 'receive',
      program_id: 0,
    }

    if (coop.is_branched && !data.braname)
      throw new Error('Branch name is required')

    let branch: ExternalOrganizationData | undefined
    if (data.braname)
      branch = await this.getOrganization(data.braname, data.block_num)

    // Имя ЦПП фиксировано для Стола заказов.
    const program: MarketplaceShareReturnStatement.Model['program'] = { name: 'Стол заказов' }

    const combinedData: MarketplaceShareReturnStatement.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      request,
      program,
      branch,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    return this.generatePDF(commonUser.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)
  }
}
