import { DraftContract } from 'cooptypes'
import { ReturnByMoney } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { PaymentMethod } from '../Models/PaymentMethod'

export { ReturnByMoney as Template } from '../Templates'

export class Factory extends DocFactory<ReturnByMoney.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: ReturnByMoney.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Сервис платёжных методов нужен в батче (создаём до параллельного резолва)
    const paymentMethodService = new PaymentMethod(this.storage)

    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    // paymentMethod независим: getOne читает только data.method_id/data.username
    const { template, coop, vars, user, paymentMethod } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(ReturnByMoney.Template as ITemplate<ReturnByMoney.Model>)
        : this.getTemplate<ReturnByMoney.Model>(DraftContract.contractName.production, ReturnByMoney.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      user: () => this.getUser(data.username, data.block_num),
      paymentMethod: () => paymentMethodService.getOne({
        method_id: data.method_id,
        username: data.username,
        deleted: false,
      }),
    })

    console.log(data)
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data }) // зависит от template.title

    const commonUser = this.getCommonUser(user)

    if (!paymentMethod) {
      throw new Error(`Платежный метод с ID ${data.method_id} не найден для пользователя ${data.username}`)
    }

    const combinedData: ReturnByMoney.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      payment_details: this.formatPaymentDetails(paymentMethod, commonUser.full_name_or_short_name),
      quantity: data.quantity,
      currency: data.currency,
      payment_hash: data.payment_hash,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(commonUser.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
