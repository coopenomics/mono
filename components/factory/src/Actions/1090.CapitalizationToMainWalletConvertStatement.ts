import { DraftContract } from 'cooptypes'
import { CapitalizationToMainWalletConvertStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { CapitalizationToMainWalletConvertStatement as Template } from '../Templates'

/**
 * Factory для Заявления о трансляции паевого взноса из ЦПП «Благорост» в
 * ЦПП «Цифровой Кошелёк» (процесс p.cap.wthcap). Генерируется по запросу
 * пайщика на сумму, которую он назвал, и подписывается им (`data.username`)
 * перед `capital::wthshare`.
 */
export class Factory extends DocFactory<CapitalizationToMainWalletConvertStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: CapitalizationToMainWalletConvertStatement.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    const template: ITemplate<CapitalizationToMainWalletConvertStatement.Model> = await this.getTemplate(
        DraftContract.contractName.production,
        CapitalizationToMainWalletConvertStatement.registry_id,
        data.block_num,
      )

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const userData = await this.getUser(data.username, data.block_num)
    const user = this.getCommonUser(userData)

    const combinedData: CapitalizationToMainWalletConvertStatement.Model = {
      meta,
      coop,
      vars,
      user,
      // В документ сумма идёт человеку, а не цепи: «1000.0000 RUB» → «1000.00 RUB».
      amount: this.formatAsset(data.amount),
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
