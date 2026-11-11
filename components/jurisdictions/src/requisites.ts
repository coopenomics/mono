import { ruAccountValid, ruCorrAccountValid, ruInnValid, ruOgrnValid } from './ru/requisites';
import type {
  CounterpartyKind,
  CounterpartyRequisiteField,
  CounterpartyRequisiteIssue,
  CounterpartyRequisitesProfile,
  RequisiteChecksum,
} from './types';

/**
 * Реквизиты контрагента: какие поля есть у вида контрагента в стране, верно
 * ли они заполнены и как они читаются строкой в служебной записке и поручении
 * кассиру. Форма на столе строится по тем же полям, сервер проверяет по тем же
 * правилам — расхождения между ними нет.
 */

/** Поля реквизитов вида контрагента в порядке платёжного поручения, с подписью для этого вида. */
export function counterpartyFieldsFor(
  profile: CounterpartyRequisitesProfile,
  kind: CounterpartyKind
): (CounterpartyRequisiteField & { label: string; requiredHere: boolean; length: number | null })[] {
  return profile.fields
    .filter((f) => f.kinds.includes(kind))
    .map((f) => ({
      ...f,
      label: f.labelByKind?.[kind] ?? f.label,
      requiredHere: f.required.includes(kind),
      length: lengthFor(f, kind),
    }));
}

function lengthFor(field: CounterpartyRequisiteField, kind: CounterpartyKind): number | null {
  if (field.digits === undefined) return null;
  return typeof field.digits === 'number' ? field.digits : field.digits[kind] ?? null;
}

/** Значения без пробелов по краям; пустые строки — как отсутствие значения. */
export function normalizeCounterpartyRequisites(values: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values ?? {})) {
    if (raw === null || raw === undefined) continue;
    const value = String(raw).trim();
    if (value) out[key] = value;
  }
  return out;
}

function checksumHolds(checksum: RequisiteChecksum, value: string, values: Record<string, string>): boolean {
  switch (checksum) {
    case 'ru-inn':
      return ruInnValid(value);
    case 'ru-ogrn':
      return ruOgrnValid(value);
    case 'ru-account':
      return ruAccountValid(value, values.bik ?? '');
    case 'ru-corr-account':
      return ruCorrAccountValid(value, values.bik ?? '');
  }
}

/**
 * Нарушения в реквизитах контрагента; пусто — реквизиты верны. Поля, которых
 * у вида контрагента нет, не проверяются и в реквизиты не попадают.
 */
export function validateCounterpartyRequisites(
  profile: CounterpartyRequisitesProfile,
  kind: CounterpartyKind,
  values: Record<string, unknown>
): CounterpartyRequisiteIssue[] {
  const clean = normalizeCounterpartyRequisites(values);
  const issues: CounterpartyRequisiteIssue[] = [];
  for (const field of counterpartyFieldsFor(profile, kind)) {
    const value = clean[field.key];
    if (!value) {
      if (field.requiredHere) issues.push({ field: field.key, code: 'REQUIRED' });
      continue;
    }
    if (field.length !== null && !new RegExp(`^\\d{${field.length}}$`).test(value)) {
      issues.push({ field: field.key, code: 'FORMAT' });
      continue;
    }
    if (field.pattern && !new RegExp(field.pattern).test(value)) {
      issues.push({ field: field.key, code: 'FORMAT' });
      continue;
    }
    if (field.checksum && !checksumHolds(field.checksum, value, clean)) {
      issues.push({ field: field.key, code: 'CHECKSUM' });
    }
  }
  return issues;
}

/** Только поля вида контрагента — лишние ключи формы в реквизиты не попадают. */
export function pickCounterpartyRequisites(
  profile: CounterpartyRequisitesProfile,
  kind: CounterpartyKind,
  values: Record<string, unknown>
): Record<string, string> {
  const clean = normalizeCounterpartyRequisites(values);
  const out: Record<string, string> = {};
  for (const field of counterpartyFieldsFor(profile, kind)) {
    if (clean[field.key]) out[field.key] = clean[field.key];
  }
  return out;
}

/**
 * Реквизиты строкой — как их читают совет в служебной записке и кассир в
 * поручении: по строке на раздел, «подпись значение» через запятую.
 *
 *   ИНН 7707083893, КПП 773601001, ОГРН 1027700132195
 *   Расчётный счёт 40702810…, Банк ПАО Сбербанк, БИК 044525225, Корр. счёт 30101810…
 */
export function formatCounterpartyRequisites(
  profile: CounterpartyRequisitesProfile,
  kind: CounterpartyKind,
  values: Record<string, unknown>
): string {
  const clean = normalizeCounterpartyRequisites(values);
  const fields = counterpartyFieldsFor(profile, kind).filter((f) => clean[f.key]);
  const line = (group: CounterpartyRequisiteField['group']) =>
    fields
      .filter((f) => f.group === group)
      .map((f) => `${f.label} ${clean[f.key]}`)
      .join(', ');
  return [line('organization'), line('bank')].filter(Boolean).join('\n');
}

/** Налоговый номер контрагента — значение поля с признаком `taxId`. */
export function counterpartyTaxId(profile: CounterpartyRequisitesProfile, values: Record<string, unknown>): string {
  const field = profile.fields.find((f) => f.taxId);
  return field ? normalizeCounterpartyRequisites(values)[field.key] ?? '' : '';
}

/** Номер счёта контрагента — значение поля с признаком `accountId`. */
export function counterpartyAccountId(profile: CounterpartyRequisitesProfile, values: Record<string, unknown>): string {
  const field = profile.fields.find((f) => f.accountId);
  return field ? normalizeCounterpartyRequisites(values)[field.key] ?? '' : '';
}
