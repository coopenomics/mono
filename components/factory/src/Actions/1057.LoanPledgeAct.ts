import { DraftContract } from 'cooptypes'
import { LoanPledgeAct } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { amountFields, loanContractNumber, resolveLoanBasis } from './loan/shared'

export { LoanPledgeAct as Template } from '../Templates'

export class Factory extends DocFactory<LoanPledgeAct.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: LoanPledgeAct.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData, basis } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(LoanPledgeAct.Template as ITemplate<LoanPledgeAct.Model>)
        : this.getTemplate<LoanPledgeAct.Model>(DraftContract.contractName.production, LoanPledgeAct.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      userData: () => this.getUser(data.username, data.block_num),
      basis: () => resolveLoanBasis(this.storage, data),
    })
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const user = this.getCommonUser(userData)
    // Протокол совета: номер и дата решения, по которому выдан заём.
    const decision = await this.getDecision(coop, data.coopname, data.decision_id, meta.created_at, meta.timezone)
    const combinedData: LoanPledgeAct.Model = {
      meta,
      coop,
      vars,
      user,
      short_hash: loanContractNumber(this, data.debt_hash),
      ...basis,
      ...amountFields(data.amount),
      decision_number: String(decision.id),
      decision_date: decision.date,
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)
    return document
  }
}
