import { describe, expect, it } from 'vitest'
import { DocFactory } from '../src/Factory'

/**
 * Сумма в тексте документа пишется только через `formatAsset`: два знака,
 * лишнее отсекается. Сырой актив цепи («300.0000 RUB») и число с хвостом
 * («300.0000») в документе запрещены — пайщик читает рубли и копейки.
 */
const factory = Object.create(DocFactory.prototype) as { formatAsset: (asset: string | number, precision?: number) => string }

describe('formatAsset — сумма в тексте документа', () => {
  it('сумма с символом валюты — два знака, символ на месте', () => {
    expect(factory.formatAsset('300.0000 RUB')).toBe('300.00 RUB')
    expect(factory.formatAsset('1505.5000 AXON')).toBe('1505.50 AXON')
    expect(factory.formatAsset('100 RUB')).toBe('100.00 RUB')
  })

  it('голое число — те же два знака: валюта стоит в подписи колонки шаблона', () => {
    expect(factory.formatAsset('300.0000')).toBe('300.00')
    expect(factory.formatAsset('300')).toBe('300.00')
    expect(factory.formatAsset('0.0000')).toBe('0.00')
    expect(factory.formatAsset(85)).toBe('85.00')
  })

  it('лишние знаки отсекаются, а не округляются — в документе не больше, чем в цепи', () => {
    expect(factory.formatAsset('1.9990 RUB')).toBe('1.99 RUB')
    expect(factory.formatAsset('0.2999')).toBe('0.29')
  })

  it('пустое значение — пустая строка; строка, оформленная человеком, остаётся как есть', () => {
    expect(factory.formatAsset('')).toBe('')
    expect(factory.formatAsset('1 020,00 RUB')).toBe('1 020,00 RUB')
  })
})
