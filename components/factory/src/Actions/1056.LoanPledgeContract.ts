import { DraftContract } from 'cooptypes'
import { LoanPledgeContract } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { amountFields, formatDateRu, loanContractNumber, partyIdentity, pledgerRequisites, resolveLoanBasis } from './loan/shared'

export { LoanPledgeContract as Template } from '../Templates'

export class Factory extends DocFactory<LoanPledgeContract.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: LoanPledgeContract.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData, basis } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(LoanPledgeContract.Template as ITemplate<LoanPledgeContract.Model>)
        : this.getTemplate<LoanPledgeContract.Model>(DraftContract.contractName.production, LoanPledgeContract.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      userData: () => this.getUser(data.username, data.block_num),
      basis: () => resolveLoanBasis(this.storage, data),
    })
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const user = this.getCommonUser(userData)
    const combinedData: LoanPledgeContract.Model = {
      meta,
      coop,
      vars,
      user,
      short_hash: loanContractNumber(this, data.debt_hash),
      ...basis,
      ...amountFields(data.amount),
      due_at: formatDateRu(data.due_at),
      contract_date: formatDateRu(data.contract_date),
      party_identity: partyIdentity(userData),
      pledger_requisites: pledgerRequisites(userData),
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)
    return document
  }
}
