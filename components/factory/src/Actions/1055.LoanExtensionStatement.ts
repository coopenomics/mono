import { DraftContract } from 'cooptypes'
import { LoanExtensionStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { amountDigitsRu, amountInWordsRu } from '../Utils/amountInWords'
import { formatDateRu, loanContractNumber } from './loan/shared'

export { LoanExtensionStatement as Template } from '../Templates'

export class Factory extends DocFactory<LoanExtensionStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: LoanExtensionStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(LoanExtensionStatement.Template as ITemplate<LoanExtensionStatement.Model>)
        : this.getTemplate<LoanExtensionStatement.Model>(DraftContract.contractName.production, LoanExtensionStatement.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      userData: () => this.getUser(data.username, data.block_num),
    })
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const user = this.getCommonUser(userData)
    const combinedData: LoanExtensionStatement.Model = {
      meta,
      coop,
      vars,
      user,
      short_hash: loanContractNumber(this, data.debt_hash),
      contract_date: formatDateRu(data.contract_date),
      new_due_at: formatDateRu(data.new_due_at),
      remaining_digits: amountDigitsRu(data.remaining),
      remaining_words: amountInWordsRu(data.remaining),
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)
    return document
  }
}
