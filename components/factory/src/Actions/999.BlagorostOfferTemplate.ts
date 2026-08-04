import { Cooperative, DraftContract } from 'cooptypes'
import { BlagorostOfferTemplate } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BlagorostOfferTemplate as Template } from '../Templates'

export class Factory extends DocFactory<BlagorostOfferTemplate.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BlagorostOfferTemplate.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, vars, coop, docData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BlagorostOfferTemplate.Template as ITemplate<BlagorostOfferTemplate.Model>)
        : this.getTemplate<BlagorostOfferTemplate.Model>(DraftContract.contractName.production, BlagorostOfferTemplate.registry_id, data.block_num),
      vars: () => this.getVars(data.coopname),
      coop: () => this.getCooperative(data.coopname),
      docData: () => this.loadDocData<BlagorostOfferTemplate.Model['doc_data']>(data),
    })

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const doc_data = Cooperative.Registry.requireCapitalProgramPrivateData(docData, BlagorostOfferTemplate.registry_id)

    // Проверяем наличие данных протокола, утвердившего Положение (документ 998)
    if (!vars.blagorost_program?.protocol_number || !vars.blagorost_program?.protocol_day_month_year) {
      throw new Error('Данные протокола об утверждении Положения о ЦПП «БЛАГОРОСТ» не найдены. Сначала утвердите Положение и сохраните данные протокола.')
    }

    const combinedData: BlagorostOfferTemplate.Model = {
      meta,
      coop,
      vars,
      doc_data,
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
