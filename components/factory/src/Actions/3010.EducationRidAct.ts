import { DraftContract } from 'cooptypes'
import { EducationRidAct } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { EducationRidAct as Template } from '../Templates'

/**
 * Factory для Акта приёма-передачи паевого взноса РИД (ЦПП «Образование»).
 * Двухподписный: первым подписывает преподаватель (`data.username`), вторым
 * председатель Совета по хэшу того же документа; уходит параметром `act`
 * действия `edubridge::acceptrid`.
 */
export class Factory extends DocFactory<EducationRidAct.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(
    data: EducationRidAct.Action,
    options?: IGenerationOptions,
  ): Promise<IGeneratedDocument> {
    let template: ITemplate<EducationRidAct.Model>

    if (process.env.SOURCE === 'local') {
      template = EducationRidAct.Template
    }
    else {
      template = await this.getTemplate(
        DraftContract.contractName.production,
        EducationRidAct.registry_id,
        data.block_num,
      )
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    const userData = await this.getUser(data.username, data.block_num)
    const user = this.getCommonUser(userData)

    // Имя ЦПП фиксировано (как в 1110).
    const program: EducationRidAct.Model['program'] = { name: 'Образование' }

    const combinedData: EducationRidAct.Model = {
      meta,
      coop,
      vars,
      user,
      program,
      rid_hash: data.rid_hash,
      rid_short_hash: this.getShortHash(data.rid_hash),
      amount: this.formatAsset(data.amount),
      rid_type: data.rid_type,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(
      user.full_name_or_short_name,
      template.context,
      combinedData,
      translation,
      meta,
      options?.skip_save,
    )
    return document
  }
}
