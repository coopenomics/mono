import { describe, expect, it } from 'vitest';
import {
  getJurisdiction,
  getPersonalIncomeTax,
  getTaxTransferRequisites,
  resolveEffective,
} from './index';

describe('Выбор действующей записи', () => {
  const records = [
    { effectiveFrom: '2025-12-05', value: 'старое' },
    { effectiveFrom: '2026-04-01', value: 'новое' },
  ];

  it('день вступления в силу — уже новое правило, а не последний день старого', () => {
    expect(resolveEffective(records, '2026-04-01')).toBe('новое');
    expect(resolveEffective(records, '2026-03-31')).toBe('старое');
  });

  it('до первой записи справочник молчит — выдавать сегодняшнее за прошлое нельзя', () => {
    expect(resolveEffective(records, '2025-01-01')).toBeNull();
  });

  it('порядок записей в таблице значения не имеет', () => {
    expect(resolveEffective([...records].reverse(), '2026-06-01')).toBe('новое');
  });

  it('дату можно передать объектом Date', () => {
    expect(resolveEffective(records, new Date('2026-06-01T10:00:00Z'))).toBe('новое');
  });
});

describe('Россия', () => {
  it('назначение платежа сменилось на «ЕНП» с 1 апреля 2026', () => {
    expect(getTaxTransferRequisites('Russia', '2026-03-31')?.memo).toBe('Единый налоговый платеж');
    expect(getTaxTransferRequisites('Russia', '2026-04-01')?.memo).toBe('ЕНП');
  });

  it('КПП получателя — тот, что действует с декабря 2025', () => {
    const rows = getTaxTransferRequisites('Russia', '2026-08-17')?.rows ?? [];
    expect(rows.find((r) => r.label === 'КПП получателя')?.value).toBe('770701001');
    expect(rows.find((r) => r.label === 'КБК')?.value).toBe('18201061201010000510');
  });

  it('НДФЛ: ставка, КБК налога и код материальной помощи не работнику', () => {
    const ndfl = getPersonalIncomeTax('Russia', '2026-08-17');
    expect(ndfl).toEqual({
      ratePercent: 13,
      kbk: '18210102010011000110',
      aidIncomeCode: '2710',
    });
  });

  it('сроки считаются по московскому времени, а не по UTC отметки блокчейна', () => {
    expect(getJurisdiction('Russia')?.taxTimezoneOffsetMinutes).toBe(180);
  });
});

describe('Неизвестная страна', () => {
  it.each([null, undefined, 'Georgia'])('%p — справочник пуст, а не падение', (code) => {
    expect(getJurisdiction(code)).toBeNull();
    expect(getTaxTransferRequisites(code, '2026-08-17')).toBeNull();
    expect(getPersonalIncomeTax(code, '2026-08-17')).toBeNull();
  });
});
