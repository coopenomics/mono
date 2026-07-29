import { Cooperative, DraftContract } from 'cooptypes'
import { MarketplaceWriteoffServiceMemo } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { MarketplaceWriteoffServiceMemo as Template } from '../Templates'

/**
 * Factory для Служебной записки о списании (Эпик 8, registry 1111).
 * Подписывается председателем кооперативного участка (`data.username`)
 * на столе ПВЗ и инициирует `marketplace::confirmwroff` — фактическое
 * списание со склада позиций данного КУ по решению совета.
 */
export class Factory extends DocFactory<MarketplaceWriteoffServiceMemo.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: MarketplaceWriteoffServiceMemo.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceWriteoffServiceMemo.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceWriteoffServiceMemo.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        MarketplaceWriteoffServiceMemo.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const user = await this.getUser(data.username, data.block_num)
    const chairman = this.getCommonUser(user)

    // Имя ЦПП фиксировано для стола заказов (не из заглушки реестра).
    const program: Cooperative.Registry.MarketplaceWriteoffServiceMemo.Model['program'] = {
      name: 'Стол заказов',
    }

    const items: Cooperative.Registry.MarketplaceWriteoffServiceMemo.WriteoffMemoItem[] =
      data.items.map(it => ({
        asset_title: it.asset_title,
        quantity: it.quantity,
        unit: it.unit,
        amount: it.amount,
        reason: it.reason,
      }))

    const combinedData: MarketplaceWriteoffServiceMemo.Model = {
      meta,
      coop,
      vars,
      chairman,
      program,
      proposal_hash: data.proposal_hash,
      branch_name: data.branch_name,
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
