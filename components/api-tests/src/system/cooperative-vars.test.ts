/**
 * Параметры кооператива со стола председателя (system.cooperative-vars).
 *
 * Председатель правит параметры, которые фабрика подставляет в документы.
 * Имя кооператива в них обязано быть именем узла: пустое или чужое сервер
 * отвергает с кодом, иначе все документы собирались бы по чужим параметрам.
 * Тест только отказы: успешное сохранение переписало бы параметры стенда.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, caseName, expectCode, gqlError, tokenOf } from '../core'

const UPDATE = `mutation($d:Update!){ updateSystem(data:$d){ coopname } }`

const agreement = { protocol_number: '1', protocol_day_month_year: '20.10.2026' }
const vars = (coopname: string) => ({
  coopname,
  name: 'ПРОВЕРКА',
  full_abbr: 'Потребительский Кооператив',
  full_abbr_genitive: 'Потребительского Кооператива',
  full_abbr_dative: 'Потребительскому Кооперативу',
  short_abbr: 'ПК',
  website: 'https://example.com',
  confidential_link: 'https://example.com/privacy',
  confidential_email: 'privacy@example.com',
  contact_email: 'contact@example.com',
  passport_request: 'no',
  statute_link: 'https://example.com/statute.pdf',
  wallet_agreement: agreement,
  signature_agreement: agreement,
  privacy_agreement: agreement,
  user_agreement: agreement,
  participant_application: agreement,
})

describe('параметры кооператива — имя кооператива обязательно и своё', () => {
  it(caseName('sys.vars.break.01', 'чужое или пустое имя кооператива — отказ с кодом, параметры не меняются'), async () => {
    const token = await tokenOf(CHAIRMAN)
    expectCode(await gqlError(token, UPDATE, { d: { vars: vars('notthiscoop1') } }), 'SYSTEM_VARS_COOPNAME_MISMATCH')
    expectCode(await gqlError(token, UPDATE, { d: { vars: vars('') } }), 'SYSTEM_VARS_COOPNAME_MISMATCH')
  })
})
