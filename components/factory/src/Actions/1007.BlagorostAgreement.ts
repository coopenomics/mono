import { Cooperative, DraftContract } from 'cooptypes'
import { BlagorostAgreement } from '../Templates'
import { DocFactory } from '../Factory'
import { Udata } from '../Models/Udata'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { BlagorostAgreement as Template } from '../Templates'

export class Factory extends DocFactory<BlagorostAgreement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: BlagorostAgreement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Извлечение данных из Udata репозитория
    const udataService = new Udata(this.storage)

    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, userData, blagorostAgreementUdata, contributorContractUdata, contributorContractCreatedAtUdata } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(BlagorostAgreement.Template as ITemplate<BlagorostAgreement.Model>)
        : this.getTemplate<BlagorostAgreement.Model>(DraftContract.contractName.production, BlagorostAgreement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
      blagorostAgreementUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_AGREEMENT_NUMBER,
        block_num: data.block_num,
      }),
      contributorContractUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER,
        block_num: data.block_num,
      }),
      contributorContractCreatedAtUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT,
        block_num: data.block_num,
      }),
    })

    // meta зависит от template.title — считаем после батча
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const common_user = super.getCommonUser(userData)

    // Проверка наличия необходимых параметров
    // blagorost_agreement_number может отсутствовать если это путь Генератора (параметры генерируются на бэкенде)
    // contributor_contract_number обязателен
    const missingParams: string[] = []
    if (!contributorContractUdata?.value)
      missingParams.push('BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER')
    if (!contributorContractCreatedAtUdata?.value)
      missingParams.push('BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT')

    if (missingParams.length > 0) {
      throw new Error(
        `Отсутствуют необходимые параметры в Udata для пользователя ${data.username}: ${missingParams.join(', ')}. `
        + `Необходимо сначала сгенерировать параметры документов через UdataDocumentParametersService.`,
      )
    }

    const combinedData: BlagorostAgreement.Model = {
      meta,
      coop,
      vars,
      common_user,
      blagorost_agreement_number: String(blagorostAgreementUdata?.value || ''),
      contributor_contract_number: String(contributorContractUdata?.value || ''),
      contributor_contract_created_at: String(contributorContractCreatedAtUdata?.value || ''),
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
