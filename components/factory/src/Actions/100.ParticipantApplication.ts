import { DraftContract } from 'cooptypes'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import DataService from '../Services/Databazor/DataService'
import { ParticipantApplication } from '../Templates'
import { isEmpty } from '../Utils'

export { ParticipantApplication as Template } from '../Templates'

export class Factory extends DocFactory<ParticipantApplication.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: ParticipantApplication.Action, _options?: IGenerationOptions): Promise<IGeneratedDocument> {
    // TODO надо использовать skip_save из options вместо skip_save из data, для этого на фронте внести соответствующие правки
    const { template, user, coop, coop_bank_account, vars } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(ParticipantApplication.Template as ITemplate<ParticipantApplication.Model>)
        : this.getTemplate<ParticipantApplication.Model>(DraftContract.contractName.production, ParticipantApplication.registry_id, data.block_num),
      user: () => super.getUser(data.username, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      coop_bank_account: () => super.getBankAccount(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
    })

    let bank_account = {} as any

    if (user.type === 'organization' || user.type === 'entrepreneur')
      bank_account = await super.getBankAccount(data.username, data.block_num)

    const userData = {
      [user.type]: {
        ...user.data,
        bank_account,
      },
    }

    // добавлено для обратной совместимости с осенними версия 2024
    const extended_coop = { ...coop, bank_account: coop_bank_account }

    if (coop.is_branched && !data.braname)
      throw new Error('Кооперативный участок должен быть указан')

    let branch

    if (data.braname)
      branch = await super.getOrganization(data.braname, data.block_num)

    let { signature, ...modifieddata } = data
    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...modifieddata }) // Генерируем мета-данные

    interface SignatureData {
      username: string
      block_num: number
      signature: string
    }

    const data_service = new DataService<SignatureData>(this.storage, 'signatures')

    // пропуск сохранения необходим при вступлении для того, чтобы подготовить документ только для отображения без сохранения
    if (!data.skip_save) {
      // если подпись не указана, то проверяем на наличие в базе данных
      if (!signature) {
        if (data.block_num) {
          const block_filter = data.block_num ? { block_num: { $lte: data.block_num } } : {}
          const db_signature = await data_service.getOne({ username: data.username, ...block_filter }) as SignatureData

          if (db_signature)
            signature = db_signature.signature
          else throw new Error('Не указана подпись пользователя')
        }
        else { throw new Error('Не указана подпись пользователя') }
      }
      else {
        // если подпись указана - сохраняем в хранилище
        const data_service = new DataService<SignatureData>(this.storage, 'signatures')
        await data_service.save({ username: data.username, block_num: meta.block_num, signature })
      }
    }

    if (!vars?.participant_application || isEmpty(vars.participant_application.protocol_number) || isEmpty(vars.participant_application.protocol_day_month_year))
      throw new Error('Реквизиты протокола для заявления на вступление не заполнены. Заполните номер и дату протокола в настройках кооператива.')

    const combinedData: ParticipantApplication.Model = {
      ...userData,
      meta,
      coop: extended_coop,
      branch,
      type: user.type,
      vars,
      signature,
      initial: super.formatAsset(coop.initial),
      minimum: super.formatAsset(coop.minimum),
      org_initial: super.formatAsset(coop.org_initial),
      org_minimum: super.formatAsset(coop.org_minimum),
    }

    // валидируем скомбинированные данные
    await super.validate(combinedData, template.model)

    // получаем комплекс перевода
    const translation = template.translations[meta.lang]

    // генерируем документ
    const document: IGeneratedDocument = await super.generatePDF('', template.context, combinedData, translation, meta, data.skip_save)

    return document
  }
}
