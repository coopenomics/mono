import { describe, expect, it } from 'vitest'
import { MarketContract } from '../src'

/**
 * Режим работы пункта выдачи: подряд идущие дни с одинаковым режимом
 * объединяются; ту же группировку показывают стол и уведомления узла.
 */
const { formatWorkingHours, groupWorkingHours } = MarketContract.WorkingHours

const labels = {
  day: (d: string) => ({ mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' } as Record<string, string>)[d],
  breakWord: 'перерыв',
  dayOff: 'выходной',
}
const day = (open: string, close: string, breaks: Array<{ start: string, end: string }> = []) => ({ open, close, breaks })

describe('режим работы пункта выдачи', () => {
  it('будни с одним временем — одна строка, выходные — одна строка', () => {
    const work = day('09:00', '18:00')
    expect(formatWorkingHours({ mon: work, tue: work, wed: work, thu: work, fri: work }, labels))
      .toEqual(['Пн–Пт 09:00–18:00', 'Сб–Вс выходной'])
  })

  it('разрыв в середине недели делит группы; одиночный день — без тире', () => {
    const work = day('09:00', '18:00')
    expect(formatWorkingHours({ mon: work, tue: work, wed: work, fri: work, sat: work }, labels))
      .toEqual(['Пн–Ср 09:00–18:00', 'Чт выходной', 'Пт–Сб 09:00–18:00', 'Вс выходной'])
  })

  it('перерыв входит в режим: дни с разными перерывами не объединяются', () => {
    const a = day('09:00', '18:00', [{ start: '13:00', end: '14:00' }])
    const b = day('09:00', '18:00')
    expect(formatWorkingHours({ mon: a, tue: a, wed: b, thu: b, fri: b, sat: b, sun: b }, labels))
      .toEqual(['Пн–Вт 09:00–18:00, перерыв 13:00–14:00', 'Ср–Вс 09:00–18:00'])
  })

  it('режим не задан — пусто; день без времени закрытия — выходной', () => {
    expect(groupWorkingHours(null)).toEqual([])
    expect(groupWorkingHours({})).toEqual([])
    expect(formatWorkingHours({ mon: { open: '09:00' }, tue: day('10:00', '12:00') }, labels))
      .toEqual(['Пн выходной', 'Вт 10:00–12:00', 'Ср–Вс выходной'])
  })
})
