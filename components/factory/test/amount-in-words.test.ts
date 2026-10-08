import { describe, expect, it } from 'vitest'
import { amountDigitsRu, amountInWordsRu, integerToWordsRu } from '../src/Utils/amountInWords'

describe('сумма прописью', () => {
  it('целые рубли: род, падеж и разряды', () => {
    expect(amountInWordsRu('10000.0000 RUB')).toBe('десять тысяч рублей 00 копеек')
    expect(amountInWordsRu('1.0000 RUB')).toBe('один рубль 00 копеек')
    expect(amountInWordsRu('2.0000 RUB')).toBe('два рубля 00 копеек')
    expect(amountInWordsRu('21.0000 RUB')).toBe('двадцать один рубль 00 копеек')
    expect(amountInWordsRu('111.0000 RUB')).toBe('сто одиннадцать рублей 00 копеек')
    expect(amountInWordsRu('1000.0000 RUB')).toBe('одна тысяча рублей 00 копеек')
    expect(amountInWordsRu('2000.0000 RUB')).toBe('две тысячи рублей 00 копеек')
    expect(amountInWordsRu('1001000.0000 RUB')).toBe('один миллион одна тысяча рублей 00 копеек')
    expect(amountInWordsRu('0.0000 RUB')).toBe('ноль рублей 00 копеек')
  })

  it('копейки цифрами, слово по числу', () => {
    expect(amountInWordsRu('30000.5000 RUB')).toBe('тридцать тысяч рублей 50 копеек')
    expect(amountInWordsRu('5.0100 RUB')).toBe('пять рублей 01 копейка')
    expect(amountInWordsRu('5.0200 RUB')).toBe('пять рублей 02 копейки')
    expect(amountInWordsRu('5.1100 RUB')).toBe('пять рублей 11 копеек')
  })

  it('доли копейки округляются вместе с рублями, ста копеек не бывает', () => {
    expect(amountInWordsRu('1.9990 RUB')).toBe('два рубля 00 копеек')
    expect(amountInWordsRu('0.2900 RUB')).toBe('ноль рублей 29 копеек')
    expect(amountDigitsRu('1.9990 RUB')).toBe('2,00')
  })

  it('сумма цифрами с разделителями разрядов', () => {
    expect(amountDigitsRu('10000.0000 RUB')).toBe('10 000,00')
    expect(amountDigitsRu('1234567.5000 RUB')).toBe('1 234 567,50')
  })

  it('целое число прописью', () => {
    expect(integerToWordsRu(1203)).toBe('одна тысяча двести три')
    expect(integerToWordsRu(19)).toBe('девятнадцать')
  })
})
