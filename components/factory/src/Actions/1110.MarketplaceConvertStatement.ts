import { DraftContract } from 'cooptypes'
import { MarketplaceConvertStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { MarketplaceConvertStatement as Template } from '../Templates'

/**
 * Factory для Заявления о конвертации паевого взноса в членский взнос по
 * ЦПП «Стол заказов» (процесс p.mkt.supply). Генерируется на оформлении
 * заказа по одному на каждый Order и подписывается заказчиком
 * (`data.username` = заказчик) перед `marketplace::createorder` /
 * `marketplace::stockorder`.
 */
export class Factory extends DocFactory<MarketplaceConvertStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: MarketplaceConvertStatement.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceConvertStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceConvertStatement.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        MarketplaceConvertStatement.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const userData = await this.getUser(data.username, data.block_num)
    const user = this.getCommonUser(userData)

    // Имя ЦПП фиксировано для стола заказов (как в 1106).
    const program: MarketplaceConvertStatement.Model['program'] = { name: 'Стол заказов' }

    const combinedData: MarketplaceConvertStatement.Model = {
      meta,
      coop,
      vars,
      user,
      program,
      order_hash: data.order_hash,
      amount: data.amount,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(
      user.full_name_or_short_name,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )
    return document
  }
}
