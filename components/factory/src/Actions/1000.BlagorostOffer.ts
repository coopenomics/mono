import { Cooperative, DraftContract } from 'cooptypes'
import { BlagorostOffer } from '../Templates'
import { DocFactory } from '../Factory'
import { Udata } from '../Models/Udata'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BlagorostOffer as Template } from '../Templates'

export class Factory extends DocFactory<BlagorostOffer.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BlagorostOffer.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Извлечение данных из Udata репозитория
    const udataService = new Udata(this.storage)

    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, vars, coop, userData, blagorostAgreementUdata, blagorostAgreementCreatedAtUdata, docData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BlagorostOffer.Template as ITemplate<BlagorostOffer.Model>)
        : this.getTemplate<BlagorostOffer.Model>(DraftContract.contractName.production, 1000, data.block_num),
      vars: () => this.getVars(data.coopname),
      coop: () => this.getCooperative(data.coopname),
      userData: () => this.getUser(data.username, data.block_num),
      blagorostAgreementUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER,
        block_num: data.block_num,
      }),
      blagorostAgreementCreatedAtUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_CREATED_AT,
        block_num: data.block_num,
      }),
      docData: () => this.loadDocData<BlagorostOffer.Model['doc_data']>(data),
    })

    // meta зависит от template.title — считаем после батча
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const common_user = this.getCommonUser(userData)
    const doc_data = Cooperative.Registry.requireCapitalProgramPrivateData(docData, BlagorostOffer.registry_id)

    // Проверяем наличие данных протоколов, утвердивших предыдущие документы
    if (!vars.blagorost_program?.protocol_number || !vars.blagorost_program?.protocol_day_month_year) {
      throw new Error('Данные протокола об утверждении Положения о ЦПП «БЛАГОРОСТ» не найдены. Сначала утвердите Положение и сохраните данные протокола.')
    }

    if (!vars.blagorost_offer_template?.protocol_number || !vars.blagorost_offer_template?.protocol_day_month_year) {
      throw new Error('Данные протокола об утверждении шаблона публичной оферты ЦПП «БЛАГОРОСТ» не найдены. Сначала утвердите шаблон оферты и сохраните данные протокола.')
    }

    if (!blagorostAgreementUdata?.value) {
      throw new Error('Данные соглашения благороста не найдены в Udata')
    }

    if (!blagorostAgreementCreatedAtUdata?.value) {
      throw new Error('Дата создания соглашения благороста не найдена в Udata')
    }

    // Используем полную модель с дополнительными полями
    const combinedData: BlagorostOffer.Model = {
      meta,
      coop,
      vars,
      common_user,
      blagorost_agreement_number: String(blagorostAgreementUdata.value),
      blagorost_agreement_created_at: String(blagorostAgreementCreatedAtUdata.value),
      doc_data,
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
