import { DraftContract } from 'cooptypes'
import { LoanRepaymentStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { amountFields, formatDateRu, loanContractNumber } from './loan/shared'

export { LoanRepaymentStatement as Template } from '../Templates'

export class Factory extends DocFactory<LoanRepaymentStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: LoanRepaymentStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(LoanRepaymentStatement.Template as ITemplate<LoanRepaymentStatement.Model>)
        : this.getTemplate<LoanRepaymentStatement.Model>(DraftContract.contractName.production, LoanRepaymentStatement.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      userData: () => this.getUser(data.username, data.block_num),
    })
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const user = this.getCommonUser(userData)
    const combinedData: LoanRepaymentStatement.Model = {
      meta,
      coop,
      vars,
      user,
      short_hash: loanContractNumber(this, data.debt_hash),
      contract_date: formatDateRu(data.contract_date),
      ...amountFields(data.amount),
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)
    return document
  }
}
