import { Cooperative, DraftContract } from 'cooptypes'
import { MarketplaceWriteoffStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { MarketplaceWriteoffStatement as Template } from '../Templates'

/**
 * Factory для Заявления о списании скоропорта (Эпик 8 / Story 8.4).
 * Подписывается председателем перед `marketplace::propwroff` +
 * `soviet::createagenda(type=mktwroff)`. Источник пользователя —
 * `data.username` (=председатель).
 */
export class Factory extends DocFactory<MarketplaceWriteoffStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: MarketplaceWriteoffStatement.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceWriteoffStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceWriteoffStatement.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        MarketplaceWriteoffStatement.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const user = await this.getUser(data.username, data.block_num)
    const chairman = this.getCommonUser(user)

    // Имя ЦПП фиксировано для членского стола заказов (не из заглушки реестра).
    const program: Cooperative.Registry.MarketplaceWriteoffStatement.Model['program'] = {
      name: 'Членский стол заказов',
    }

    const items: Cooperative.Registry.MarketplaceWriteoffStatement.WriteoffItemModel[] =
      data.items.map(it => ({
        braname: it.braname,
        asset_title: it.asset_title,
        quantity: it.quantity,
        unit: it.unit,
        amount: it.amount,
        reason: it.reason,
      }))

    const combinedData: MarketplaceWriteoffStatement.Model = {
      meta,
      coop,
      vars,
      chairman,
      program,
      proposal_hash: data.proposal_hash,
      cycle_started_at: data.cycle_started_at,
      items,
      total_amount: data.total_amount,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(
      chairman.full_name_or_short_name,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )
    return document
  }
}
