import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { EducationConvertStatement } from '../Templates'

export { EducationConvertStatement as Template } from '../Templates'

/** Период подписки словами для текста заявления. */
const PERIOD_HUMAN: Record<string, string> = { month: 'один месяц', course: 'весь курс', year: 'один год' }

/** Заявление о конвертации паевого взноса (Образование): пайщик, подписка, суммы и период. */
export const Factory = defineBuilder<EducationConvertStatement.Action, EducationConvertStatement.Model>()({
  registry_id: EducationConvertStatement.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData } }) => ({
    meta,
    coop,
    vars,
    user: Format.commonUser(userData),
    program: { name: 'Образование' },
    sub_hash: data.sub_hash,
    amount: Format.formatAsset(data.amount),
    from_program: Format.formatAsset(data.from_program ?? '0.0000 RUB'),
    total: Format.formatAsset(data.total ?? data.amount),
    from_program_used: Number.parseFloat(String(data.from_program ?? '0')) > 0,
    convert_used: Number.parseFloat(String(data.amount ?? '0')) > 0,
    course_title: data.course_title,
    period: data.period,
    period_human: PERIOD_HUMAN[data.period] ?? data.period,
  }),
  signer: ({ reads: { userData } }) => Format.commonUser(userData).full_name_or_short_name,
})
