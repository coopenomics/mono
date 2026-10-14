import { DraftContract } from 'cooptypes'
import { GenerationLoanStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { PaymentMethod } from '../Models/PaymentMethod'
import { amountFields, emphasizePaymentDetails, formatDateRu, loanContractNumber, resolveLoanBasis, statementCollateralText } from './loan/shared'

export { GenerationLoanStatement as Template } from '../Templates'

export class Factory extends DocFactory<GenerationLoanStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GenerationLoanStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const paymentMethodService = new PaymentMethod(this.storage)
    const { template, coop, vars, userData, paymentMethod, basis } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(GenerationLoanStatement.Template as ITemplate<GenerationLoanStatement.Model>)
        : this.getTemplate<GenerationLoanStatement.Model>(DraftContract.contractName.production, GenerationLoanStatement.registry_id, data.block_num),
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
    const combinedData: GenerationLoanStatement.Model = {
      meta,
      coop,
      vars,
      user,
      short_hash: loanContractNumber(this, data.debt_hash),
      ...basis,
      ...amountFields(data.amount),
      due_at: formatDateRu(data.due_at),
      payment_details: emphasizePaymentDetails(this.formatPaymentDetails(paymentMethod, user.full_name_or_short_name)),
      collateral_text: statementCollateralText(data, basis),
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)
    return document
  }
}
