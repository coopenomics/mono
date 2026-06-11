import { BranchContract, type Cooperative, DraftContract } from 'cooptypes'
import { BranchEstablishmentSovietDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { getFetch } from '../Utils/getFetch'
import { getEnvVar } from '../config'

export { BranchEstablishmentSovietDecision as Template } from '../Templates'

export class Factory extends DocFactory<BranchEstablishmentSovietDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  /**
   * Получение решения собрания пайщиков участка по хэшу из таблицы decisions контракта branch
   */
  private async getBranchDecision(coopname: string, hash: string, block_num?: number): Promise<BranchContract.Tables.Decisions.IDecision> {
    const block_filter = block_num ? { block_num: { $lte: block_num } } : {}

    const response = await getFetch(`${getEnvVar('SIMPLE_EXPLORER_API')}/get-tables`, new URLSearchParams({
      filter: JSON.stringify({
        'code': BranchContract.contractName.production,
        'scope': coopname,
        'table': BranchContract.Tables.Decisions.tableName,
        'value.hash': hash.toUpperCase(),
        ...block_filter,
      }),
      limit: String(1),
    }))

    const decision = response.results[0]?.value as BranchContract.Tables.Decisions.IDecision

    if (!decision)
      throw new Error('Решение собрания пайщиков участка не найдено')

    return decision
  }

  async generateDocument(data: BranchEstablishmentSovietDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, branchDecision } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchEstablishmentSovietDecision.Template as ITemplate<BranchEstablishmentSovietDecision.Model>)
        : this.getTemplate<BranchEstablishmentSovietDecision.Model>(DraftContract.contractName.production, BranchEstablishmentSovietDecision.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      branchDecision: () => this.getBranchDecision(data.coopname, data.hash, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    // Реквизиты участка — из решения собрания пайщиков
    const chairmanData = await super.getUser(branchDecision.chairman, data.block_num)
    const chairmanFullName = super.getFullParticipantName(chairmanData.data)

    // Данные решения совета
    const decision: Cooperative.Document.IDecisionData = await super.getDecision(
      coop,
      data.coopname,
      data.decision_id,
      meta.created_at,
    )

    const combinedData: BranchEstablishmentSovietDecision.Model = {
      meta,
      coop,
      vars,
      decision,
      braname: branchDecision.braname,
      address: branchDecision.address,
      chairman_full_name: chairmanFullName,
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF(
      chairmanFullName,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )

    return document
  }
}
