import { DraftContract } from 'cooptypes'
import { ExpenseProposalStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { ExpenseProposalStatement as Template } from '../Templates'

export class Factory extends DocFactory<ExpenseProposalStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: ExpenseProposalStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory).
    // Приватная часть позиций (реквизиты/имя/назначение) — из `doc_private_data`
    // по `doc_data_hash`; в meta документа эти данные НЕ попадают. См. раздел
    // «Document Generation Pattern: doc_data» в архитектуре.
    const { template, coop, vars, userData, priv } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(ExpenseProposalStatement.Template as ITemplate<ExpenseProposalStatement.Model>)
        : this.getTemplate<ExpenseProposalStatement.Model>(DraftContract.contractName.production, ExpenseProposalStatement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
      priv: () => this.loadDocData<ExpenseProposalStatement.PrivateData>(data),
    })

    // meta зависит от template.title — считаем после батча. meta строится из
    // публичной `data` (без приватных позиций) → реквизиты не уходят on-chain.
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    // Подмешиваем приватную часть в позиции по `number` — только для рендера.
    const privByNumber = new Map(
      (priv?.items ?? []).map((p): [string, ExpenseProposalStatement.PrivateData['items'][number]] => [p.number, p]),
    )

    const combinedData: ExpenseProposalStatement.Model = {
      meta,
      coop,
      user: super.getCommonUser(userData),
      vars,
      proposal_hash: data.proposal_hash,
      proposal_short_hash: this.getShortHash(data.proposal_hash),
      proposal: { ...data.proposal, total_amount: this.formatAsset(data.proposal.total_amount) },
      items: data.items.map((item) => {
        const p = privByNumber.get(item.number)
        return {
          ...item,
          amount: this.formatAsset(item.amount),
          recipient_name: p?.recipient_name,
          requisites: p?.requisites,
          payment_purpose: p?.payment_purpose,
        }
      }),
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
