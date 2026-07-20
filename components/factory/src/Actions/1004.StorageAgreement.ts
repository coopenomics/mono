import { Cooperative, DraftContract } from 'cooptypes'
import { StorageAgreement } from '../Templates'
import { DocFactory } from '../Factory'
import { Udata } from '../Models/Udata'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { StorageAgreement as Template } from '../Templates'

export class Factory extends DocFactory<StorageAgreement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: StorageAgreement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Извлечение данных из Udata репозитория
    const udataService = new Udata(this.storage)

    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, userData, storageAgreementUdata, storageAgreementCreatedAtUdata, contributorContractUdata, generatorAgreementUdata, generatorAgreementCreatedAtUdata } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(StorageAgreement.Template as ITemplate<StorageAgreement.Model>)
        : this.getTemplate<StorageAgreement.Model>(DraftContract.contractName.production, StorageAgreement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
      storageAgreementUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_NUMBER,
        block_num: data.block_num,
      }),
      storageAgreementCreatedAtUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_STORAGE_AGREEMENT_CREATED_AT,
        block_num: data.block_num,
      }),
      contributorContractUdata: () => udataService.getOne({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER,
        block_num: data.block_num,
      }),
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
    })

    // meta зависит от template.title — считаем после батча
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const common_user = super.getCommonUser(userData)

    // Проверка наличия всех необходимых параметров
    const missingParams: string[] = []
    if (!storageAgreementUdata?.value)
      missingParams.push('BLAGOROST_STORAGE_AGREEMENT_NUMBER')
    if (!storageAgreementCreatedAtUdata?.value)
      missingParams.push('BLAGOROST_STORAGE_AGREEMENT_CREATED_AT')
    if (!contributorContractUdata?.value)
      missingParams.push('BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER')
    if (!generatorAgreementUdata?.value)
      missingParams.push('GENERATOR_AGREEMENT_NUMBER')
    if (!generatorAgreementCreatedAtUdata?.value)
      missingParams.push('GENERATOR_AGREEMENT_CREATED_AT')

    if (missingParams.length > 0) {
      throw new Error(
        `Отсутствуют необходимые параметры в Udata для пользователя ${data.username}: ${missingParams.join(', ')}. `
        + `Необходимо сначала сгенерировать параметры документов через UdataDocumentParametersService.`,
      )
    }

    const combinedData: StorageAgreement.Model = {
      meta,
      coop,
      vars,
      common_user,
      blagorost_storage_agreement_number: String(storageAgreementUdata?.value || ''),
      blagorost_storage_agreement_created_at: String(storageAgreementCreatedAtUdata?.value || ''),
      contributor_contract_number: String(contributorContractUdata?.value || ''),
      generator_agreement_number: String(generatorAgreementUdata?.value || ''),
      generator_agreement_created_at: String(generatorAgreementCreatedAtUdata?.value || ''),
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
