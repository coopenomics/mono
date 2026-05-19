import { Cooperative, DraftContract } from 'cooptypes'
import { GenerationConvertStatement } from '../Templates'
import { DocFactory } from '../Factory'
import { Udata } from '../Models/Udata'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { GenerationConvertStatement as Template } from '../Templates'

export class Factory extends DocFactory<GenerationConvertStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: GenerationConvertStatement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<GenerationConvertStatement.Model>

    if (process.env.SOURCE === 'local') {
      template = GenerationConvertStatement.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, GenerationConvertStatement.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await super.getCooperative(data.coopname, data.block_num)
    const vars = await super.getVars(data.coopname, data.block_num)
    const userData = await super.getUser(data.username, data.block_num)
    const common_user = super.getCommonUser(userData)

    // Извлечение данных из Udata репозитория
    const udataService = new Udata(this.storage)

    const contributorContractUdata = await udataService.getOne({
      coopname: data.coopname,
      username: data.username,
      key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER,
      block_num: data.block_num,
    })

    if (!contributorContractUdata?.value) {
      throw new Error('Данные договора УХД участника не найдены в Udata')
    }

    const contributorContractCreatedAtUdata = await udataService.getOne({
      coopname: data.coopname,
      username: data.username,
      key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT,
      block_num: data.block_num,
    })

    if (!contributorContractCreatedAtUdata?.value) {
      throw new Error('Дата создания договора УХД участника не найдена в Udata')
    }

    const combinedData: GenerationConvertStatement.Model = {
      meta,
      coop,
      vars,
      common_user,
      contributor_contract_number: String(contributorContractUdata.value),
      contributor_contract_created_at: String(contributorContractCreatedAtUdata.value),
      appendix_hash: data.appendix_hash,
      appendix_short_hash: this.getShortHash(data.appendix_hash),
      project_hash: data.project_hash,
      project_short_hash: this.getShortHash(data.project_hash),
      main_wallet_amount: super.formatAsset(data.main_wallet_amount),
      blagorost_wallet_amount: super.formatAsset(data.blagorost_wallet_amount),
      to_wallet: data.to_wallet,
      to_blagorost: data.to_blagorost,
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
