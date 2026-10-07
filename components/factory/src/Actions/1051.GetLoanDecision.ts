import { DraftContract } from 'cooptypes'
import { GetLoanDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { Cooperative } from 'cooptypes'
import { amountFields, collateralText, formatDateRu, loanContractNumber, resolveLoanBasis } from './loan/shared'

export { GetLoanDecision as Template } from '../Templates'

export class Factory extends DocFactory<GetLoanDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GetLoanDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData, basis } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(GetLoanDecision.Template as ITemplate<GetLoanDecision.Model>)
        : this.getTemplate<GetLoanDecision.Model>(DraftContract.contractName.production, GetLoanDecision.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      userData: () => this.getUser(data.username, data.block_num),
      basis: () => resolveLoanBasis(this.storage, data),
    })
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const common_user = this.getCommonUser(userData)
    // Решение зависит от coop и meta.created_at — после батча.
    const decision: Cooperative.Document.IDecisionData = await this.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone)
    const combinedData: GetLoanDecision.Model = {
      meta,
      coop,
      vars,
      decision,
      common_user,
      short_hash: loanContractNumber(this, data.debt_hash),
      basis_title_instrumental: basis.basis_title_instrumental,
      basis_number: basis.basis_number,
      basis_date: basis.basis_date,
      ...amountFields(data.amount),
      due_at: formatDateRu(data.due_at),
      collateral_text: collateralText(data, basis),
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)
    return document
  }
}
