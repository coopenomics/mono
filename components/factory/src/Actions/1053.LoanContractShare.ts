import { DraftContract } from 'cooptypes'
import { LoanContractShare } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { amountFields, collateralProgramDative, formatDateRu, loanContractNumber, resolveLoanBasis } from './loan/shared'

export { LoanContractShare as Template } from '../Templates'

export class Factory extends DocFactory<LoanContractShare.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: LoanContractShare.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData, basis } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(LoanContractShare.Template as ITemplate<LoanContractShare.Model>)
        : this.getTemplate<LoanContractShare.Model>(DraftContract.contractName.production, LoanContractShare.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      userData: () => this.getUser(data.username, data.block_num),
      basis: () => resolveLoanBasis(this.storage, data),
    })
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const user = this.getCommonUser(userData)
    const combinedData: LoanContractShare.Model = {
      meta,
      coop,
      vars,
      user,
      short_hash: loanContractNumber(this, data.debt_hash),
      ...basis,
      ...amountFields(data.amount),
      due_at: formatDateRu(data.due_at),
      collateral_program_dative: collateralProgramDative(data.collateral),
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)
    return document
  }
}
