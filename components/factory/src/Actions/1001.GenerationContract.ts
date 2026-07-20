import { Cooperative, DraftContract } from 'cooptypes'
import { GenerationContract } from '../Templates'
import { DocFactory } from '../Factory'
import { Udata } from '../Models/Udata'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { GenerationContract as Template } from '../Templates'

export class Factory extends DocFactory<GenerationContract.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GenerationContract.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Извлечение данных из Udata репозитория
    const udataService = new Udata(this.storage)

    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, userData, contributorContractUdata } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(GenerationContract.Template as ITemplate<GenerationContract.Model>)
        : this.getTemplate<GenerationContract.Model>(DraftContract.contractName.production, GenerationContract.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
      contributorContractUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER,
        block_num: data.block_num,
      }),
    })

    // meta зависит от template.title — считаем после батча
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    // Проверяем наличие данных протокола, утвердившего генерационное соглашение
    if (!vars.generation_contract_template?.protocol_number || !vars.generation_contract_template?.protocol_day_month_year) {
      throw new Error('Данные протокола об утверждении генерационного соглашения не найдены. Сначала утвердите генерационное соглашение и сохраните данные протокола.')
    }

    const user = super.getCommonUser(userData)

    // Если параметры отсутствуют, возвращаем ошибку с четким описанием
    if (!contributorContractUdata?.value) {
      throw new Error(
        `Данные договора УХД не найдены в Udata для пользователя ${data.username}. `
        + `Необходимо сначала сгенерировать параметры документа через UdataDocumentParametersService.`,
      )
    }

    const combinedData: GenerationContract.Model = {
      meta,
      coop,
      vars,
      user,
      contributor_contract_number: String(contributorContractUdata.value),
    }
    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
