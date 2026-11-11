import { describe, expect, it } from 'vitest';
import {
  counterpartyAccountId,
  counterpartyFieldsFor,
  counterpartyTaxId,
  formatCounterpartyRequisites,
  getCounterpartyRequisites,
  pickCounterpartyRequisites,
  validateCounterpartyRequisites,
} from './index';

/**
 * Реквизиты контрагента — получателя оплаты по счёту (задача 99D-35, решение
 * владельца 11.11.2026: длины и проверки реквизитов — страновые, через пакет
 * юрисдикций). Значения — настоящие реквизиты ПАО Сбербанк и проверенные по
 * контрольным суммам номера ИП.
 */

const RU = getCounterpartyRequisites('Russia')!;

const LEGAL = {
  inn: '7707083893',
  kpp: '773601001',
  ogrn: '1027700132195',
  account: '40702810938000000001',
  bank_name: 'ПАО Сбербанк',
  bik: '044525225',
  corr_account: '30101810400000000225',
};

const ENTREPRENEUR = {
  inn: '500100732259',
  ogrn: '304500116000157',
  account: '40702810938000000001',
  bank_name: 'ПАО Сбербанк',
  bik: '044525225',
};

describe('Реквизиты контрагента — состав по стране и виду', () => {
  it('неизвестная страна реквизитов не даёт', () => {
    expect(getCounterpartyRequisites('Atlantis')).toBeNull();
    expect(getCounterpartyRequisites(null)).toBeNull();
  });

  it('у юрлица есть КПП, у ИП — нет; ОГРН у ИП называется ОГРНИП', () => {
    const legal = counterpartyFieldsFor(RU, 'LEGAL').map((f) => f.key);
    const ip = counterpartyFieldsFor(RU, 'ENTREPRENEUR');
    expect(legal).toEqual(['inn', 'kpp', 'ogrn', 'account', 'bank_name', 'bik', 'corr_account']);
    expect(ip.map((f) => f.key)).not.toContain('kpp');
    expect(ip.find((f) => f.key === 'ogrn')?.label).toBe('ОГРНИП');
  });

  it('у КПП маска ввода из 9 знаков с буквами в пятом и шестом', () => {
    expect(counterpartyFieldsFor(RU, 'LEGAL').find((f) => f.key === 'kpp')?.mask).toBe('####XX###');
  });

  it('длина ИНН зависит от вида: юрлицо 10, ИП 12', () => {
    expect(counterpartyFieldsFor(RU, 'LEGAL').find((f) => f.key === 'inn')?.length).toBe(10);
    expect(counterpartyFieldsFor(RU, 'ENTREPRENEUR').find((f) => f.key === 'inn')?.length).toBe(12);
  });
});

describe('Реквизиты контрагента — проверка', () => {
  it('верные реквизиты юрлица и ИП проходят без замечаний', () => {
    expect(validateCounterpartyRequisites(RU, 'LEGAL', LEGAL)).toEqual([]);
    expect(validateCounterpartyRequisites(RU, 'ENTREPRENEUR', ENTREPRENEUR)).toEqual([]);
  });

  it('пустые обязательные поля называются по ключу', () => {
    const issues = validateCounterpartyRequisites(RU, 'LEGAL', { inn: '7707083893' });
    expect(issues.filter((i) => i.code === 'REQUIRED').map((i) => i.field).sort()).toEqual(['account', 'bank_name', 'bik', 'kpp']);
  });

  it('необязательные ОГРН и корр. счёт можно не заполнять', () => {
    const { ogrn: _o, corr_account: _c, ...rest } = LEGAL;
    expect(validateCounterpartyRequisites(RU, 'LEGAL', rest)).toEqual([]);
  });

  it('пробелы по краям не мешают, пустая строка — как отсутствие значения', () => {
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, inn: ' 7707083893 ', ogrn: '  ' })).toEqual([]);
  });

  it('не та длина или буквы — FORMAT', () => {
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, inn: '770708389' })).toEqual([{ field: 'inn', code: 'FORMAT' }]);
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, bik: '04452522X' })).toContainEqual({ field: 'bik', code: 'FORMAT' });
    expect(validateCounterpartyRequisites(RU, 'ENTREPRENEUR', { ...ENTREPRENEUR, inn: LEGAL.inn })).toEqual([{ field: 'inn', code: 'FORMAT' }]);
  });

  it('КПП допускает латинские буквы в пятом и шестом знаке, иначе FORMAT', () => {
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, kpp: '7736AB001' })).toEqual([]);
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, kpp: '77360100' })).toEqual([{ field: 'kpp', code: 'FORMAT' }]);
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, kpp: 'A73601001' })).toEqual([{ field: 'kpp', code: 'FORMAT' }]);
  });

  it('опечатка в одной цифре ИНН, ОГРН, ОГРНИП — CHECKSUM', () => {
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, inn: '7707083894' })).toEqual([{ field: 'inn', code: 'CHECKSUM' }]);
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, ogrn: '1027700132196' })).toEqual([{ field: 'ogrn', code: 'CHECKSUM' }]);
    expect(validateCounterpartyRequisites(RU, 'ENTREPRENEUR', { ...ENTREPRENEUR, inn: '500100732258' })).toEqual([{ field: 'inn', code: 'CHECKSUM' }]);
    expect(validateCounterpartyRequisites(RU, 'ENTREPRENEUR', { ...ENTREPRENEUR, ogrn: '304500116000158' })).toEqual([{ field: 'ogrn', code: 'CHECKSUM' }]);
  });

  it('счёт и корр. счёт сверяются с БИК: опечатка в счёте или чужой БИК — CHECKSUM', () => {
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, account: '40702810938000000002' })).toEqual([{ field: 'account', code: 'CHECKSUM' }]);
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, corr_account: '30101810400000000226' })).toEqual([{ field: 'corr_account', code: 'CHECKSUM' }]);
    const otherBik = validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, bik: '044030653' });
    expect(otherBik).toContainEqual({ field: 'account', code: 'CHECKSUM' });
    expect(otherBik).toContainEqual({ field: 'corr_account', code: 'CHECKSUM' });
  });

  it('пустой или недописанный БИК — замечание только у БИК, счета по нему не проверяются', () => {
    // Настоящий счёт в Сбербанке: верен с БИК 044525225 (случай владельца 11.11.2026).
    const account = '40703810038000110117';
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, account, bik: '' })).toEqual([{ field: 'bik', code: 'REQUIRED' }]);
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, account, bik: '04452' })).toEqual([{ field: 'bik', code: 'FORMAT' }]);
    expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, account, bik: '044525225' })).toEqual([]);
  });

  it('любая замена одной цифры ИНН юрлица ловится контрольной суммой', () => {
    for (let pos = 0; pos < 10; pos++) {
      for (let digit = 0; digit <= 9; digit++) {
        if (String(digit) === LEGAL.inn[pos]) continue;
        const inn = LEGAL.inn.slice(0, pos) + digit + LEGAL.inn.slice(pos + 1);
        expect(validateCounterpartyRequisites(RU, 'LEGAL', { ...LEGAL, inn })).toEqual([{ field: 'inn', code: 'CHECKSUM' }]);
      }
    }
  });
});

describe('Реквизиты контрагента — строка для записки и поручения', () => {
  it('юрлицо: строка сведений и строка банка в порядке поручения', () => {
    expect(formatCounterpartyRequisites(RU, 'LEGAL', LEGAL)).toBe(
      'ИНН 7707083893, КПП 773601001, ОГРН 1027700132195\n' +
        'Расчётный счёт 40702810938000000001, Банк ПАО Сбербанк, БИК 044525225, Корр. счёт 30101810400000000225'
    );
  });

  it('ИП: ОГРНИП, без КПП; пустые поля в строку не попадают', () => {
    expect(formatCounterpartyRequisites(RU, 'ENTREPRENEUR', { ...ENTREPRENEUR, kpp: '773601001' })).toBe(
      'ИНН 500100732259, ОГРНИП 304500116000157\nРасчётный счёт 40702810938000000001, Банк ПАО Сбербанк, БИК 044525225'
    );
  });

  it('в реквизиты попадают только поля вида контрагента', () => {
    expect(pickCounterpartyRequisites(RU, 'ENTREPRENEUR', { ...ENTREPRENEUR, kpp: '773601001', extra: 'x' })).toEqual(ENTREPRENEUR);
  });

  it('налоговый номер и счёт — по признакам полей', () => {
    expect(counterpartyTaxId(RU, LEGAL)).toBe('7707083893');
    expect(counterpartyAccountId(RU, LEGAL)).toBe('40702810938000000001');
  });
});
