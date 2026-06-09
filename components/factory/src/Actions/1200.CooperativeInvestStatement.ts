import { DraftContract } from 'cooptypes'
import { CooperativeInvestStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { CooperativeInvestStatement as Template } from '../Templates'

export class Factory extends DocFactory<CooperativeInvestStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: CooperativeInvestStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory).
    // Реквизиты оператора (target_coop_fullname/payment_details) приходят готовыми
    // строками из контроллера — он извлекает их из бэкенда кооператива-оператора.
    const { template, coop, vars, user } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(CooperativeInvestStatement.Template as ITemplate<CooperativeInvestStatement.Model>)
        : this.getTemplate<CooperativeInvestStatement.Model>(DraftContract.contractName.production, CooperativeInvestStatement.registry_id, data.block_num),
      coop: () => this.getCooperative(data.coopname, data.block_num),
      vars: () => this.getVars(data.coopname, data.block_num),
      user: () => this.getUser(data.username, data.block_num),
    })

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data }) // зависит от template.title

    const commonUser = this.getCommonUser(user)

    const combinedData: CooperativeInvestStatement.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      quantity: data.quantity,
      currency: data.currency,
      payment_hash: data.payment_hash,
      target_coop_fullname: data.target_coop_fullname,
      program_name: data.program_name,
      payment_details: data.payment_details,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(commonUser.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
