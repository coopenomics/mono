import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { t } from '../i18n';

/** Время цепи без зоны (`2026-10-06T10:00:00`) → `06.10.2026`; пустая дата — пустая строка. */
export function formatDate(value?: string | null): string {
  if (!value || value.startsWith('1970')) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

export function formatAmount(value?: string | null): string {
  return formatAsset2Digits(value);
}

/** Наименование обеспечения по ключу реестра; неизвестный ключ показывается как есть. */
export function collateralLabel(key?: string | null): string {
  if (!key) return '';
  const path = `debt.collateral.${key}`;
  const label = t(path as never);
  return label === path ? key : label;
}

/** Вид займа по контракту-источнику записи. */
export function sourceLabel(source?: string | null): string {
  if (!source) return '';
  const path = `debt.source.${source}`;
  const label = t(path as never);
  return label === path ? source : label;
}

/** Срок по умолчанию — шесть месяцев от сегодняшнего дня, значение для поля даты. */
export function defaultDueDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 6);
  return date.toISOString().slice(0, 10);
}

/** Число дней до срока по времени цепи (UTC); отрицательное — срок прошёл. */
export function daysUntil(value?: string | null): number | null {
  if (!value || value.startsWith('1970')) return null;
  const due = new Date(value.endsWith('Z') ? value : `${value}Z`).getTime();
  return Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000));
}

/** Сумма актива числом: `1000.0000 RUB` → 1000. */
export function amountOf(value?: string | null): number {
  return parseFloat(String(value ?? '').split(' ')[0]) || 0;
}
