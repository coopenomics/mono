import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ParticipantApplication } from '../Templates'
import { isEmpty } from '../Utils'
import { DocumentNotApprovedError } from '../errors'

export { ParticipantApplication as Template } from '../Templates'

/**
 * Заявление на вступление: пайщик любого вида с банковским счётом (организация
 * и ИП), кооператив со счётом, участок по выбору и картинка подписи.
 *
 * Подпись — единственное чтение с записью: при первой сборке она приходит в
 * данных и сохраняется на блок меты, при пересборке читается на блок. В мету
 * подпись не попадает.
 */
export const Factory = defineBuilder<ParticipantApplication.Action, ParticipantApplication.Model>()({
  registry_id: ParticipantApplication.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    user: () => f.getUser(data.username, data.block_num),
    coop: () => f.getCooperative(data.coopname, data.block_num),
    coop_bank_account: () => f.getBankAccount(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  meta: ({ data, template }) => {
    const { signature: _signature, ...withoutSignature } = data
    return { title: template.title, ...withoutSignature }
  },
  derive: ({ data, f, s, meta, reads: { user, coop } }) => ({
    bank_account: async () => (user.type === 'organization' || user.type === 'entrepreneur'
      ? f.getBankAccount(data.username, data.block_num)
      : ({} as never)),
    branch: async () => {
      if (coop.is_branched && !data.braname)
        throw new Error('Кооперативный участок должен быть указан')
      return data.braname ? f.getOrganization(data.braname, data.block_num) : undefined
    },
    signature: async () => {
      let signature = data.signature
      // пропуск сохранения нужен при вступлении: документ только для показа
      if (data.skip_save)
        return signature
      if (signature) {
        await s.saveSignature({ username: data.username, block_num: meta.block_num, signature })
        return signature
      }
      if (!data.block_num)
        throw new Error('Не указана подпись пользователя')
      const stored = await s.signature(data.username, data.block_num)
      if (!stored)
        throw new Error('Не указана подпись пользователя')
      signature = stored.signature
      return signature
    },
  }),
  assemble: ({ meta, reads: { user, coop, coop_bank_account, vars }, derived: { bank_account, branch, signature } }) => {
    if (!vars?.participant_application || isEmpty(vars.participant_application.protocol_number) || isEmpty(vars.participant_application.protocol_day_month_year))
      throw new DocumentNotApprovedError('Реквизиты протокола для заявления на вступление не заполнены. Заполните номер и дату протокола в настройках кооператива.')
    return {
      [user.type]: { ...user.data, bank_account },
      meta,
      coop: { ...coop, bank_account: coop_bank_account },
      branch,
      type: user.type,
      vars,
      signature,
      initial: Format.formatAsset(coop.initial),
      minimum: Format.formatAsset(coop.minimum),
      org_initial: Format.formatAsset(coop.org_initial),
      org_minimum: Format.formatAsset(coop.org_minimum),
    }
  },
})
