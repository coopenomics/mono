import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UnknownBuilderVersionError } from '../src'
import { FIRST_BUILDER_VERSION, latestMinorOf, parseBuilderVersion, templateBuilderMajor } from '../src/Builder/version'
import { Validator } from '../src/Services/Validator'
import { WalletAgreement } from '../src/Templates'
import { generator, testStorage } from './utils'

/**
 * Ось версий сборщика (фабрика v2, шаг 7; решение 6 PRD).
 *
 * Инварианты:
 *   - версия — `major.minor`, major от 1;
 *   - редакция без `x-builder` — major 1, иначе объявленное целое от 1;
 *   - новая сборка пишет `meta.builder` — версию выбранного сборщика;
 *   - пересборка по мете с версией берёт ровно её и мету не меняет;
 *   - пересборка документа до оси версий (без `meta.builder`) идёт версией
 *     1.0 и поле в мету не добавляет — иначе хэш меты разошёлся бы с подписью;
 *   - неизвестная версия — ошибка, не тихая подмена другой версией;
 *   - схема шаблона с `x-builder` проходит строгий режим Ajv.
 */
describe('версия сборщика: разбор и выбор', () => {
  it('разбирает major.minor и отвергает прочее', () => {
    expect(parseBuilderVersion('1.0')).toEqual({ major: 1, minor: 0 })
    expect(parseBuilderVersion('2.13')).toEqual({ major: 2, minor: 13 })
    expect(() => parseBuilderVersion('1')).toThrow()
    expect(() => parseBuilderVersion('0.1')).toThrow()
    expect(() => parseBuilderVersion('1.0.0')).toThrow()
  })

  it('major редакции: нет ключа — 1, объявленный — он, неверный — ошибка', () => {
    expect(templateBuilderMajor({ type: 'object' })).toBe(1)
    expect(templateBuilderMajor(undefined)).toBe(1)
    expect(templateBuilderMajor({ 'x-builder': 2 })).toBe(2)
    expect(() => templateBuilderMajor({ 'x-builder': 0 })).toThrow()
    expect(() => templateBuilderMajor({ 'x-builder': '2' })).toThrow()
    expect(() => templateBuilderMajor({ 'x-builder': 1.5 })).toThrow()
  })

  it('последний minor объявленного major; чужие major не берутся', () => {
    expect(latestMinorOf(['1.0', '1.2', '1.10', '2.0'], 1)).toBe('1.10')
    expect(latestMinorOf(['1.0', '2.0', '2.3'], 2)).toBe('2.3')
    expect(latestMinorOf(['1.0'], 2)).toBeUndefined()
  })

  it('схема с x-builder проходит строгий режим Ajv', () => {
    const schema = { 'type': 'object', 'x-builder': 2, 'properties': { a: { type: 'string' } }, 'required': ['a'] }
    expect(new Validator(schema, { a: 'x' }).validate().valid).toBe(true)
  })
})

describe('версия сборщика в мете документа', () => {
  beforeAll(async () => {
    await generator.connect(testStorage())
  })

  afterAll(async () => {
    await generator.disconnect()
  })

  const params: WalletAgreement.Action = {
    coopname: 'voskhod',
    username: 'ant',
    lang: 'ru',
    registry_id: WalletAgreement.registry_id,
    protocol_number: '01-01-2024',
    protocol_day_month_year: '1 января 2024 г.',
  }

  it('у всех видов документов есть версия 1.0', () => {
    expect(generator.builderVersions(WalletAgreement.registry_id)).toContain(FIRST_BUILDER_VERSION)
  })

  it('новая сборка пишет meta.builder, пересборка по мете даёт тот же документ', async () => {
    const first = await generator.generate(params, { skip_save: true })
    expect(first.meta.builder).toBe(FIRST_BUILDER_VERSION)

    const again = await generator.generate({ ...first.meta }, { skip_save: true })
    expect(again.meta).toEqual(first.meta)
    expect(again.hash).toBe(first.hash)
  })

  it('документ до оси версий пересобирается версией 1.0 без поля в мете', async () => {
    const first = await generator.generate(params, { skip_save: true })
    const { builder: _drop, ...legacyMeta } = first.meta

    const rebuilt = await generator.generate({ ...legacyMeta }, { skip_save: true })
    expect(rebuilt.meta.builder).toBeUndefined()
    expect(rebuilt.meta).toEqual(legacyMeta)
    expect(rebuilt.html).toBe(first.html)
  })

  it('неизвестная версия — ошибка, а не другая версия', async () => {
    await expect(generator.generate({ ...params, builder: '9.9' } as never, { skip_save: true }))
      .rejects
      .toBeInstanceOf(UnknownBuilderVersionError)
  })
})
