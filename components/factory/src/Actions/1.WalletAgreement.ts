import { DraftContract } from 'cooptypes'
import { WalletAgreement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { isEmpty } from '../Utils'

export { WalletAgreement as Template } from '../Templates'

export class Factory extends DocFactory<WalletAgreement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: WalletAgreement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(WalletAgreement.Template as ITemplate<WalletAgreement.Model>)
        : this.getTemplate<WalletAgreement.Model>(DraftContract.contractName.production, WalletAgreement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
    })

    // meta зависит от template.title — резолвим после батча
    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    if (!vars?.wallet_agreement || isEmpty(vars.wallet_agreement.protocol_number) || isEmpty(vars.wallet_agreement.protocol_day_month_year))
      throw new Error('Реквизиты протокола для соглашения о ЦПП не заполнены. Укажите их в настройках кооператива и повторите генерацию.')

    const combinedData: WalletAgreement.Model = {
      meta,
      coop,
      vars,
    }

    await super.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await super.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
