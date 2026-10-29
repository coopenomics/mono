import { defineBuilder } from '../Builder'
import { SelectBranchStatement } from '../Templates'
import { isEmpty } from '../Utils'

export { SelectBranchStatement as Template } from '../Templates'

/** Заявление о выборе кооперативного участка: пайщик, кооператив, участок. */
export const Factory = defineBuilder<SelectBranchStatement.Action, SelectBranchStatement.Model>()({
  registry_id: SelectBranchStatement.registry_id,
  version: '1.0',
  reads: ({ data, f }) => ({
    user: () => f.getUser(data.username, data.block_num),
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
  }),
  derive: ({ data, f, reads: { coop } }) => ({
    branch: async () => {
      if (coop.is_branched && !data.braname)
        throw new Error('Кооперативный участок должен быть указан')
      return f.getOrganization(data.braname, data.block_num)
    },
  }),
  assemble: ({ meta, reads: { user, coop, vars }, derived: { branch } }) => {
    if (!vars?.participant_application || isEmpty(vars.participant_application.protocol_number) || isEmpty(vars.participant_application.protocol_day_month_year))
      throw new Error('Реквизиты протокола для заявления на вступление не заполнены. Заполните номер и дату протокола в настройках кооператива.')
    return { [user.type]: { ...user.data }, meta, branch, type: user.type, vars, coop }
  },
})
