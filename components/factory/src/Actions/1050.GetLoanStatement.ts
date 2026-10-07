import { DraftContract } from 'cooptypes'
import { GetLoanStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { PaymentMethod } from '../Models/PaymentMethod'
import { amountFields, collateralText, formatDateRu, loanContractNumber, resolveLoanBasis } from './loan/shared'

export { GetLoanStatement as Template } from '../Templates'

export class Factory extends DocFactory<GetLoanStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GetLoanStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const paymentMethodService = new PaymentMethod(this.storage)
    const { template, coop, vars, userData, paymentMethod, basis } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(GetLoanStatement.Template as ITemplate<GetLoanStatement.Model>)
        : this.getTemplate<GetLoanStatement.Model>(DraftContract.contractName.production, GetLoanStatement.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      userData: () => this.getUser(data.username, data.block_num),
      paymentMethod: () => paymentMethodService.getOne({ method_id: data.method_id, username: data.username, deleted: false }),
      basis: () => resolveLoanBasis(this.storage, data),
    })
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const user = this.getCommonUser(userData)
    if (!paymentMethod) {
      throw new Error(`Платёжный метод с ID ${data.method_id} не найден для пользователя ${data.username}`)
    }
    const combinedData: GetLoanStatement.Model = {
      meta,
      coop,
      vars,
      user,
      short_hash: loanContractNumber(this, data.debt_hash),
      ...basis,
      ...amountFields(data.amount),
      due_at: formatDateRu(data.due_at),
      payment_details: this.formatPaymentDetails(paymentMethod, user.full_name_or_short_name),
      collateral_text: collateralText(data, basis),
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)
    return document
  }
}
