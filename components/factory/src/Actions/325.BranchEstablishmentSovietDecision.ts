import { DraftContract } from 'cooptypes'
import { BranchEstablishmentSovietDecision } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BranchEstablishmentSovietDecision as Template } from '../Templates'

export class Factory extends DocFactory<BranchEstablishmentSovietDecision.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BranchEstablishmentSovietDecision.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, chairmanUser } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BranchEstablishmentSovietDecision.Template as ITemplate<BranchEstablishmentSovietDecision.Model>)
        : this.getTemplate<BranchEstablishmentSovietDecision.Model>(DraftContract.contractName.production, BranchEstablishmentSovietDecision.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      chairmanUser: () => super.getUser(data.chairman, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    // ФИО избранного председателя участка резолвим из приватных данных аккаунта;
    // в meta уходит только username председателя
    const chairman_full_name = super.getCommonUser(chairmanUser).full_name_or_short_name

    // До авторизации решения — голоса в цепочке; после — запись решения удаляется, нужен authorize
    let decision: BranchEstablishmentSovietDecision.Model['decision']
    try {
      decision = await super.getDecision(coop, data.coopname, data.decision_id, meta.created_at)
    }
    catch {
      decision = await super.getApprovedDecision(coop, data.coopname, data.decision_id)
    }

    const combinedData: BranchEstablishmentSovietDecision.Model = {
      meta,
      coop,
      vars,
      decision,
      branch_name: data.branch_name,
      address: data.address,
      chairman_full_name,
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF(
      coop.chairman.last_name + ' ' + coop.chairman.first_name + ' ' + coop.chairman.middle_name,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )

    return document
  }
}
