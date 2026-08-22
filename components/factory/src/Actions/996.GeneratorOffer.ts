import { Cooperative, DraftContract } from 'cooptypes'
import { GeneratorOffer } from '../Templates'
import { DocFactory } from '../Factory'
import { Udata } from '../Models/Udata'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { GeneratorOffer as Template } from '../Templates'

export class Factory extends DocFactory<GeneratorOffer.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GeneratorOffer.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Извлечение данных из Udata репозитория
    const udataService = new Udata(this.storage)

    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, vars, coop, user, generatorAgreementUdata, generatorAgreementCreatedAtUdata, docData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(GeneratorOffer.Template as ITemplate<GeneratorOffer.Model>)
        : this.getTemplate<GeneratorOffer.Model>(DraftContract.contractName.production, GeneratorOffer.registry_id, data.block_num),
      vars: () => this.getVars(data.coopname),
      coop: () => this.getCooperative(data.coopname),
      user: () => this.getUser(data.username, data.block_num),
      generatorAgreementUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
        block_num: data.block_num,
      }),
      generatorAgreementCreatedAtUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_CREATED_AT,
        block_num: data.block_num,
      }),
      docData: () => this.loadDocData<GeneratorOffer.Model['doc_data']>(data),
    })

    // meta зависит от template.title — считаем после батча
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const common_user = this.getCommonUser(user)
    const doc_data = Cooperative.Registry.requireCapitalProgramPrivateData(docData, GeneratorOffer.registry_id)

    // Проверяем наличие данных протокола, утвердившего генерационную программу
    if (!vars.generator_program?.protocol_number || !vars.generator_program?.protocol_day_month_year) {
      throw new Error('Данные протокола об утверждении генерационной программы не найдены. Сначала утвердите генерационную программу и сохраните данные протокола.')
    }

    // Проверяем наличие данных протокола, утвердившего шаблон оферты генератора
    if (!vars.generator_offer_template?.protocol_number || !vars.generator_offer_template?.protocol_day_month_year) {
      throw new Error('Данные протокола об утверждении шаблона оферты генератора не найдены. Сначала утвердите шаблон оферты генератора и сохраните данные протокола.')
    }

    if (!generatorAgreementUdata?.value) {
      throw new Error('Данные генерационного соглашения не найдены в Udata')
    }

    if (!generatorAgreementCreatedAtUdata?.value) {
      throw new Error('Дата создания генерационного соглашения не найдена в Udata')
    }

    const combinedData: GeneratorOffer.Model = {
      meta,
      coop,
      vars,
      common_user,
      generator_agreement_number: String(generatorAgreementUdata.value),
      generator_agreement_created_at: String(generatorAgreementCreatedAtUdata.value),
      doc_data,
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
