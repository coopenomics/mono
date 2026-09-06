import { DraftContract } from 'cooptypes'
import type { Cooperative } from 'cooptypes'
import { MarketplaceShareReturnAct } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { ExternalOrganizationData } from '../Models'

export { MarketplaceShareReturnAct as Template } from '../Templates'

export class Factory extends DocFactory<MarketplaceShareReturnAct.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceShareReturnAct.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceShareReturnAct.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceShareReturnAct.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceShareReturnAct.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    // `user` = пайщик-получатель имущества (USERNAME = data.username).
    const user = await this.getUser(data.username, data.block_num)

    // `transmitter` = USERNAME председателя КУ, доверенного или оператора
    // (передающая сторона от кооператива, закрывающая подпись).
    const transmitter = await this.getUser(data.transmitter, data.block_num)

    // request строится напрямую из данных заказа в Action (а не из заглушки
    // getRequest): акт выдачи несёт ИМЕННО заказ заказчика — артикул (СКУ),
    // наименование, фактическое количество и его стоимость, а не агрегат партии.
    const cleanNum = (s: string): string => {
      const n = Number.parseFloat(s)
      return Number.isFinite(n) ? String(n) : s
    }
    const request: MarketplaceShareReturnAct.Model['request'] = {
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

    const commonUser = this.getCommonUser(user)

    if (coop.is_branched && !data.braname)
      throw new Error('Branch name is required')

    let branch: ExternalOrganizationData | undefined
    if (data.braname)
      branch = await this.getOrganization(data.braname, data.block_num)

    // Имя ЦПП фиксировано для стола заказов (не из реестра программ —
    // там может стоять пилотное имя кооператива). Согласовано с пользователем.
    const program: MarketplaceShareReturnAct.Model['program'] = { name: 'Стол заказов' }

    // Акт составляется во исполнение протокола совета о возврате паевого
    // взноса имуществом: номер, дата и голоса — из цепи по decision_id.
    const decision: Cooperative.Document.IDecisionData = await this.getDecision(
      coop,
      data.coopname,
      data.decision_id,
      meta.created_at,
    )

    const combinedData: MarketplaceShareReturnAct.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      request,
      decision,
      program,
      act_id: data.act_id,
      transmitter: this.getFirstLastMiddleName(transmitter.data),
      branch,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(commonUser.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
