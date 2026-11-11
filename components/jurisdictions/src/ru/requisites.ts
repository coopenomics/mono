import type { CounterpartyRequisitesProfile } from '../types';

/**
 * Реквизиты контрагента в России — в порядке платёжного поручения.
 *
 * Длины и контрольные суммы — по правилам Банка России и ФНС: ИНН
 * организации 10 цифр, ИП — 12; ОГРН 13, ОГРНИП 15; КПП 9 знаков, в пятом и
 * шестом допустимы латинские буквы; БИК 9 цифр; расчётный и корреспондентский
 * счета по 20 цифр, ключ счёта сверяется с БИК. Корреспондентского счёта нет у
 * счетов в подразделениях Банка России и казначействе, поэтому он не
 * обязателен; если он указан — сверяется.
 */
export const RU_COUNTERPARTY_REQUISITES: CounterpartyRequisitesProfile = {
  fields: [
    {
      key: 'inn',
      label: 'ИНН',
      kinds: ['LEGAL', 'ENTREPRENEUR'],
      required: ['LEGAL', 'ENTREPRENEUR'],
      digits: { LEGAL: 10, ENTREPRENEUR: 12 },
      checksum: 'ru-inn',
      group: 'organization',
      taxId: true,
    },
    {
      key: 'kpp',
      label: 'КПП',
      kinds: ['LEGAL'],
      required: ['LEGAL'],
      pattern: '^\\d{4}[\\dA-Z]{2}\\d{3}$',
      mask: '####XX###',
      group: 'organization',
    },
    {
      key: 'ogrn',
      label: 'ОГРН',
      labelByKind: { ENTREPRENEUR: 'ОГРНИП' },
      kinds: ['LEGAL', 'ENTREPRENEUR'],
      required: [],
      digits: { LEGAL: 13, ENTREPRENEUR: 15 },
      checksum: 'ru-ogrn',
      group: 'organization',
    },
    {
      key: 'account',
      label: 'Расчётный счёт',
      kinds: ['LEGAL', 'ENTREPRENEUR'],
      required: ['LEGAL', 'ENTREPRENEUR'],
      digits: 20,
      checksum: 'ru-account',
      group: 'bank',
      accountId: true,
    },
    {
      key: 'bank_name',
      label: 'Банк',
      kinds: ['LEGAL', 'ENTREPRENEUR'],
      required: ['LEGAL', 'ENTREPRENEUR'],
      group: 'bank',
    },
    {
      key: 'bik',
      label: 'БИК',
      kinds: ['LEGAL', 'ENTREPRENEUR'],
      required: ['LEGAL', 'ENTREPRENEUR'],
      digits: 9,
      group: 'bank',
    },
    {
      key: 'corr_account',
      label: 'Корр. счёт',
      kinds: ['LEGAL', 'ENTREPRENEUR'],
      required: [],
      digits: 20,
      checksum: 'ru-corr-account',
      group: 'bank',
    },
  ],
};

const digitsOf = (value: string): number[] => [...value].map(Number);

/** Контрольная сумма ИНН: 10 цифр — одна контрольная, 12 — две. */
export function ruInnValid(inn: string): boolean {
  const d = digitsOf(inn);
  const check = (weights: number[]) => (weights.reduce((sum, w, i) => sum + w * d[i], 0) % 11) % 10;
  if (d.length === 10) return check([2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[9];
  if (d.length === 12) {
    return check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[10] && check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[11];
  }
  return false;
}

/** Контрольная сумма ОГРН (13 цифр, модуль 11) и ОГРНИП (15 цифр, модуль 13). */
export function ruOgrnValid(ogrn: string): boolean {
  if (!/^\d+$/.test(ogrn)) return false;
  if (ogrn.length === 13) return Number((BigInt(ogrn.slice(0, 12)) % 11n) % 10n) === Number(ogrn[12]);
  if (ogrn.length === 15) return Number((BigInt(ogrn.slice(0, 14)) % 13n) % 10n) === Number(ogrn[14]);
  return false;
}

/** Ключ счёта по 23 цифрам (служебная часть БИК + счёт): веса 7-1-3, сумма кратна 10. */
function accountKeyValid(digits23: string): boolean {
  if (!/^\d{23}$/.test(digits23)) return false;
  const weights = [7, 1, 3];
  return digitsOf(digits23).reduce((sum, d, i) => sum + d * weights[i % 3], 0) % 10 === 0;
}

/** Расчётный счёт сверяется с тремя последними цифрами БИК. */
export function ruAccountValid(account: string, bik: string): boolean {
  if (!/^\d{9}$/.test(bik)) return false;
  return accountKeyValid(bik.slice(-3) + account);
}

/** Корреспондентский счёт сверяется с «0» и пятой-шестой цифрами БИК. */
export function ruCorrAccountValid(corrAccount: string, bik: string): boolean {
  if (!/^\d{9}$/.test(bik)) return false;
  return accountKeyValid('0' + bik.slice(4, 6) + corrAccount);
}
