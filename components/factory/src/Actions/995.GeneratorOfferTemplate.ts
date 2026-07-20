import { Cooperative, DraftContract } from 'cooptypes'
import { GeneratorOfferTemplate } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { GeneratorOfferTemplate as Template } from '../Templates'

export class Factory extends DocFactory<GeneratorOfferTemplate.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GeneratorOfferTemplate.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, vars, coop, user, docData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(GeneratorOfferTemplate.Template as ITemplate<GeneratorOfferTemplate.Model>)
        : this.getTemplate<GeneratorOfferTemplate.Model>(DraftContract.contractName.production, GeneratorOfferTemplate.registry_id, data.block_num),
      vars: () => this.getVars(data.coopname),
      coop: () => this.getCooperative(data.coopname),
      user: () => this.getUser(data.username, data.block_num),
      docData: () => this.loadDocData<GeneratorOfferTemplate.Model['doc_data']>(data),
    })

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const common_user = this.getCommonUser(user)
    const doc_data = Cooperative.Registry.requireCapitalProgramPrivateData(docData, GeneratorOfferTemplate.registry_id)

    // Проверяем наличие данных протокола, утвердившего генерационную программу
    if (!vars.generator_program?.protocol_number || !vars.generator_program?.protocol_day_month_year) {
      throw new Error('Данные протокола об утверждении генерационной программы не найдены. Сначала утвердите генерационную программу и сохраните данные протокола.')
    }

    const combinedData: GeneratorOfferTemplate.Model = {
      meta,
      coop,
      vars,
      common_user,
      doc_data,
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
