import { type Cooperative, DraftContract } from 'cooptypes'
import { ExpenseProposalDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { ExpenseProposalDecision as Template } from '../Templates'

export class Factory extends DocFactory<ExpenseProposalDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: ExpenseProposalDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    if (!data.decision_id)
      throw new Error('Идентификатор решения совета не установлен')

    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(ExpenseProposalDecision.Template as ITemplate<ExpenseProposalDecision.Model>)
        : this.getTemplate<ExpenseProposalDecision.Model>(DraftContract.contractName.production, ExpenseProposalDecision.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
    })

    // meta зависит от template.title — считаем после батча
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    // данные собрания совета (кворум, голоса) — канон протоколов решений (600)
    const decision: Cooperative.Document.IDecisionData = await this.getDecision(
      coop,
      data.coopname,
      data.decision_id,
      meta.created_at,
    )

    const combinedData: ExpenseProposalDecision.Model = {
      meta,
      coop,
      vars,
      decision,
      proposal_hash: data.proposal_hash,
      proposal_short_hash: this.getShortHash(data.proposal_hash),
      proposal: { ...data.proposal, total_amount: this.formatAsset(data.proposal.total_amount) },
      items: data.items.map(item => ({ ...item, amount: this.formatAsset(item.amount) })),
      resolution: data.resolution,
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
