import { DraftContract } from 'cooptypes'
import { UserAgreement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import { isEmpty } from '../Utils'

export { UserAgreement as Template } from '../Templates'

export class Factory extends DocFactory<UserAgreement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: UserAgreement.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // Независимые источники тянем параллельно (см. resolveParallel в DocFactory)
    const { template, coop, vars, user } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(UserAgreement.Template as ITemplate<UserAgreement.Model>)
        : this.getTemplate<UserAgreement.Model>(DraftContract.contractName.production, UserAgreement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      user: () => super.getUser(data.username, data.block_num),
    })

    // meta зависит от template.title, full_name зависит от user — резолвим после батча
    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })
    const full_name = super.getFullName(user.data)

    if (!vars?.user_agreement || isEmpty(vars.user_agreement.protocol_number) || isEmpty(vars.user_agreement.protocol_day_month_year))
      throw new Error('Реквизиты протокола по пользовательскому соглашению не заполнены. Укажите номер и дату протокола в настройках кооператива.')

    const combinedData: UserAgreement.Model = {
      meta,
      coop,
      vars,
      user: {
        full_name,
      },
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    const document: IGeneratedDocument = await super.generatePDF('', template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
