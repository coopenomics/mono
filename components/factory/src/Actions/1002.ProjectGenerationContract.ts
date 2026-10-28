import { Cooperative, DraftContract } from 'cooptypes'
import { ProjectGenerationContract } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { ProjectGenerationContract as Template } from '../Templates'

export class Factory extends DocFactory<ProjectGenerationContract.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: ProjectGenerationContract.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, userData, generatorAgreementUdata, generatorAgreementCreatedAtUdata, contributorContractUdata, contributorContractCreatedAtUdata } = await this.resolveParallel({
      template: () => this.getTemplate<ProjectGenerationContract.Model>(DraftContract.contractName.production, ProjectGenerationContract.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
      generatorAgreementUdata: () => this.getUdata({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_NUMBER,
        block_num: data.block_num,
      }),
      generatorAgreementCreatedAtUdata: () => this.getUdata({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.GENERATOR_AGREEMENT_CREATED_AT,
        block_num: data.block_num,
      }),
      contributorContractUdata: () => this.getUdata({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_NUMBER,
        block_num: data.block_num,
      }),
      contributorContractCreatedAtUdata: () => this.getUdata({
        coopname: data.coopname,
        username: data.username,
        key: Cooperative.Model.UdataKey.BLAGOROST_CONTRIBUTOR_CONTRACT_CREATED_AT,
        block_num: data.block_num,
      }),
    })

    // meta зависит от template.title — считаем после батча
    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })

    const user = super.getCommonUser(userData)

    if (!generatorAgreementUdata?.value) {
      throw new Error('Данные генерационного соглашения не найдены в Udata')
    }

    if (!generatorAgreementCreatedAtUdata?.value) {
      throw new Error('Дата создания генерационного соглашения не найдена в Udata')
    }

    if (!contributorContractUdata?.value) {
      throw new Error('Данные договора УХД участника не найдены в Udata')
    }

    if (!contributorContractCreatedAtUdata?.value) {
      throw new Error('Дата создания договора УХД участника не найдена в Udata')
    }

    const combinedData: ProjectGenerationContract.Model = {
      meta,
      coop,
      vars,
      user,
      appendix_hash: data.appendix_hash,
      short_appendix_hash: this.getShortHash(data.appendix_hash),
      contributor_contract_number: String(contributorContractUdata.value),
      contributor_contract_created_at: String(contributorContractCreatedAtUdata.value),
      project_name: data.project_name,
      project_hash: data.project_hash,
      generator_agreement_number: String(generatorAgreementUdata.value),
      generator_agreement_created_at: String(generatorAgreementCreatedAtUdata.value),
    }

    await this.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
