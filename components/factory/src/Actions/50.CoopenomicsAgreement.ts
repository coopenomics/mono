import { DraftContract } from 'cooptypes'
import { CoopenomicsAgreement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { CoopenomicsAgreement as Template } from '../Templates'

export class Factory extends DocFactory<CoopenomicsAgreement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: CoopenomicsAgreement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, partner } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(CoopenomicsAgreement.Template as ITemplate<CoopenomicsAgreement.Model>)
        : this.getTemplate<CoopenomicsAgreement.Model>(DraftContract.contractName.production, CoopenomicsAgreement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      partner: () => super.getOrganization(data.username, data.block_num),
    })

    // meta зависит от template.title — резолвим после батча
    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    const combinedData: CoopenomicsAgreement.Model = {
      meta,
      coop,
      vars,
      partner,
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
