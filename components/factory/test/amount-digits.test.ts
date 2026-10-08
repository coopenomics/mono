import { describe, expect, it } from 'vitest'
import { amountDigitsRu, amountWithSymbolRu, assetSymbol } from '../src/Utils/amountDigits'

describe('сумма документа цифрами', () => {
  it('разряды и копейки', () => {
    expect(amountDigitsRu('10000.0000 RUB')).toBe('10 000,00')
    expect(amountDigitsRu('1234567.5000 RUB')).toBe('1 234 567,50')
    expect(amountDigitsRu('1.9990 RUB')).toBe('2,00')
  })

  it('валюту называет символ актива, в текст она не вписана', () => {
    expect(assetSymbol('10000.0000 RUB')).toBe('RUB')
    expect(amountWithSymbolRu('10000.0000 RUB')).toBe('10 000,00 RUB')
    expect(amountWithSymbolRu('10000.0000 AXON')).toBe('10 000,00 AXON')
    expect(amountWithSymbolRu(10000)).toBe('10 000,00')
  })
})
