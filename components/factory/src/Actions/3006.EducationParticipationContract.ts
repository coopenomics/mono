import { Cooperative, DraftContract } from 'cooptypes'
import { EducationParticipationContract } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { Udata } from '../Models'

export { EducationParticipationContract as Template } from '../Templates'

/**
 * Factory для договора УХД преподавателя по ЦПП «Образование».
 * Подписывает преподаватель (`data.username`); номер и дату договора
 * передаёт бэкенд edubridge явно.
 */
export class Factory extends DocFactory<EducationParticipationContract.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: EducationParticipationContract.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationParticipationContract.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationParticipationContract.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, EducationParticipationContract.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)
    const userData = await this.getUser(data.username, data.block_num)
    const common_user = this.getCommonUser(userData)

    // Персональные номер и дата. Бэкенд edubridge пишет их в Udata ДО генерации,
    // фабрика читает оттуда — повторный рендер даёт тот же хэш, что подписал
    // пайщик. Явная передача в `data` имеет приоритет (подпись со стола).
    const udataService = new Udata(this.storage)
    let contract_number = data.contract_number
    if (!contract_number) {
      const row = await udataService.getOne({ coopname: data.coopname, username: data.username, key: Cooperative.Model.UdataKey.EDUCATION_CONTRACT_NUMBER, block_num: data.block_num })
      contract_number = row?.value ? String(row.value) : ''
    }
    let contract_created_at = data.contract_created_at
    if (!contract_created_at) {
      const row = await udataService.getOne({ coopname: data.coopname, username: data.username, key: Cooperative.Model.UdataKey.EDUCATION_CONTRACT_CREATED_AT, block_num: data.block_num })
      contract_created_at = row?.value ? String(row.value) : ''
    }
    if (!contract_number || !contract_created_at) {
      throw new Error('Номер и дата договора участия в хозяйственной деятельности обязательны (не переданы и не найдены в Udata)')
    }

    const combinedData: EducationParticipationContract.Model = {
      meta,
      coop,
      vars,
      common_user,
      contract_number,
      contract_created_at,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(common_user.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
