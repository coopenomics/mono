import { DraftContract } from 'cooptypes'
import { RegulationElectronicSignature } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { isEmpty } from '../Utils'

export { RegulationElectronicSignature as Template } from '../Templates'

export class Factory extends DocFactory<RegulationElectronicSignature.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: RegulationElectronicSignature.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(RegulationElectronicSignature.Template as ITemplate<RegulationElectronicSignature.Model>)
        : this.getTemplate<RegulationElectronicSignature.Model>(DraftContract.contractName.production, RegulationElectronicSignature.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
    })

    // meta зависит от template.title — резолвим после батча
    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    if (!vars?.signature_agreement || isEmpty(vars.signature_agreement.protocol_number) || isEmpty(vars.signature_agreement.protocol_day_month_year))
      throw new Error('Реквизиты протокола по простой электронной подписи не заполнены. Добавьте номер и дату протокола в настройках кооператива.')

    const combinedData: RegulationElectronicSignature.Model = {
      meta,
      coop,
      vars,
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
