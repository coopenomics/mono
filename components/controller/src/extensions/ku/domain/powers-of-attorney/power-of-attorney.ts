import type { InnerPowerOfAttorneyStatus, InnerPowerOfAttorneyType } from '@coopenomics/innercoop';

/**
 * Доверенности кооператива (решение владельца 18.11.2026): системный учёт рядом
 * с реестром документов. Цепь хранит подписи; номер, срок и состояние ведёт
 * узел по событиям цепи. Здесь — реестр типов и правила срока.
 */

/** Описание типа доверенности. Новый тип — новая запись реестра. */
export interface PowerOfAttorneyTypeSpec {
  /** Шаблон документа в реестре фабрики. */
  registry_id: number;
  /** Срок доверенности в месяцах. */
  term_months: number;
  /** За сколько дней до конца срока узел напоминает о продлении; 0 — не напоминает. */
  renewal_notice_days: number;
}

/** Реестр типов доверенностей. */
export const POWER_OF_ATTORNEY_TYPES: Record<InnerPowerOfAttorneyType, PowerOfAttorneyTypeSpec> = {
  // Председателю кооперативного участка: выдаёт кооператив в лице председателя
  // совета после решения совета об учреждении участка; продлевается ежегодно.
  branch_trustee: { registry_id: 329, term_months: 12, renewal_notice_days: 30 },
  // Доверенному лицу участка: выдаёт председатель участка по заявке.
  branch_trusted: { registry_id: 330, term_months: 12, renewal_notice_days: 30 },
};

/** Строка учёта доверенности. */
export interface PowerOfAttorneyRow {
  id: number;
  coopname: string;
  number: number;
  type: InnerPowerOfAttorneyType;
  registry_id: number;
  braname: string;
  holder: string;
  document_hash: string;
  source_hash: string | null;
  document: Record<string, unknown>;
  countersigned: Record<string, unknown> | null;
  protocol_number: string;
  protocol_date: string;
  /** Дата выдачи, YYYY-MM-DD. */
  issued_at: string;
  /** Последний день срока, YYYY-MM-DD. */
  valid_until: string;
  /** Записанное состояние: pending | active | declined. «Срок истёк» вычисляется. */
  status: 'pending' | 'active' | 'declined';
  signed_at: Date;
  resolved_at: Date | null;
  renewal_notified_at: Date | null;
}

/** Сегодняшняя дата по Москве, YYYY-MM-DD: срок доверенности считается в днях. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now);
}

/** Последний день срока: дата выдачи плюс срок в месяцах минус один день. */
export function validUntilIso(issuedIso: string, termMonths: number): string {
  const [y, m, d] = issuedIso.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1 + termMonths, d));
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → ДД.ММ.ГГГГ — так дата стоит в тексте доверенности. */
export function ruDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** ДД.ММ.ГГГГ (как в мете документа) → YYYY-MM-DD; иное — null. */
export function isoFromRuDate(value: unknown): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(value ?? ''));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** Состояние на дату: встречно подписанная доверенность после конца срока — истёкшая. */
export function powerOfAttorneyStatus(
  row: Pick<PowerOfAttorneyRow, 'status' | 'valid_until'>,
  today: string = todayIso()
): InnerPowerOfAttorneyStatus {
  if (row.status === 'active' && row.valid_until < today) return 'expired';
  return row.status;
}

/** Дней до конца срока (0 — последний день). */
export function daysLeft(validUntilIsoDate: string, today: string = todayIso()): number {
  return Math.round((Date.parse(validUntilIsoDate) - Date.parse(today)) / 86_400_000);
}

/**
 * Пора продлевать: доверенность действует и до конца срока не больше
 * `renewal_notice_days` дней, либо срок уже истёк.
 */
export function renewalDue(
  row: Pick<PowerOfAttorneyRow, 'status' | 'valid_until' | 'type'>,
  today: string = todayIso()
): boolean {
  const notice = POWER_OF_ATTORNEY_TYPES[row.type]?.renewal_notice_days ?? 0;
  if (row.status !== 'active' || notice <= 0) return false;
  return daysLeft(row.valid_until, today) <= notice;
}
