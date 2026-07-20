import { DraftContract } from 'cooptypes'
import { BranchFinancialAidStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchFinancialAidStatement as Template } from '../Templates'

/**
 * Factory для Заявления на выплату материальной помощи (requirement b6
 * «Экономика КУ», процесс p.brn.aid). Подписывается самим получателем —
 * доверенным/председателем КУ — перед `branch::createaid`. Источник
 * пользователя — `data.username` (=получатель).
 */
export class Factory extends DocFactory<BranchFinancialAidStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: BranchFinancialAidStatement.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<BranchFinancialAidStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = BranchFinancialAidStatement.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        BranchFinancialAidStatement.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const userData = await this.getUser(data.username, data.block_num)
    const user = this.getCommonUser(userData)

    const combinedData: BranchFinancialAidStatement.Model = {
      meta,
      coop,
      vars,
      user,
      aid_hash: data.aid_hash,
      braname: data.braname,
      amount: data.amount,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(
      user.full_name_or_short_name,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )
    return document
  }
}
