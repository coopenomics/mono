import { DraftContract } from 'cooptypes'
import { LoanContractProperty } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { amountFields, formatDateRu, loanContractNumber, resolveLoanBasis } from './loan/shared'

export { LoanContractProperty as Template } from '../Templates'

export class Factory extends DocFactory<LoanContractProperty.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: LoanContractProperty.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData, basis } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(LoanContractProperty.Template as ITemplate<LoanContractProperty.Model>)
        : this.getTemplate<LoanContractProperty.Model>(DraftContract.contractName.production, LoanContractProperty.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      userData: () => this.getUser(data.username, data.block_num),
      basis: () => resolveLoanBasis(this.storage, data),
    })
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const user = this.getCommonUser(userData)
    const combinedData: LoanContractProperty.Model = {
      meta,
      coop,
      vars,
      user,
      short_hash: loanContractNumber(this, data.debt_hash),
      ...basis,
      ...amountFields(data.amount),
      due_at: formatDateRu(data.due_at),
      storage_appendix_number: data.storage_appendix_number,
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)
    return document
  }
}
