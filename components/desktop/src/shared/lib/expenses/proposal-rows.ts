/**
 * Подписи строки служебной записки в списках: автор, сумма, дата, назначение.
 * Одни и те же на реестре расходов, кассе и в авансах пайщика.
 */
import type { Cooperative } from 'cooptypes';
import { uiLocale } from 'src/shared/i18n';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { getNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';

/** Строка списка служебных записок — то, что нужно для подписи автора. */
interface IProposalAuthorRow {
  username?: string | null;
  statement_doc?: {
    document?: { signatures?: { signer_certificate?: Parameters<typeof getNameFromCertificate>[0] | null }[] | null } | null;
  } | null;
}

/**
 * ФИО автора служебной записки — из сертификата подписанта записки (её
 * подписывает создатель), без отдельного запроса аккаунта. Пока записка не
 * подписана, показывается учётное имя.
 */
export function proposalAuthorName(row: IProposalAuthorRow): string {
  const cert = row.statement_doc?.document?.signatures?.[0]?.signer_certificate;
  return (cert ? getNameFromCertificate(cert) : '') || row.username || '—';
}

/** Сумма записки для таблиц: два знака и разделитель разрядов, пусто — прочерк. */
export function formatProposalAmount(asset?: string | null): string {
  if (!asset) return '—';
  return formatAsset2Digits(asset);
}

/**
 * Дата для таблиц расходов: короткие дата и время, пусто — прочерк. Принимает
 * и строку, и скаляр DateTime схемы (в SDK он без типа).
 */
export function formatProposalDate(value?: unknown): string {
  return formatWith(value, { dateStyle: 'short', timeStyle: 'short' });
}

/** То же без времени — для мета-строки под названием («Выдан 16.10.2026»). */
export function formatProposalDay(value?: unknown): string {
  return formatWith(value, { dateStyle: 'short' });
}

function formatWith(value: unknown, style: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(uiLocale(), style);
}

/** Шапка служебной записки: цель расходов, общая сумма, срок «в срок до». */
export type IProposalHeader = Cooperative.Registry.ExpenseProposalStatement.IExpenseProposalHeader;

/**
 * Шапка записки из метаданных заявления 2010. Цели и срока нет в таблице цепи:
 * их несёт только подписанное заявление, поэтому читаем его мету. Мета
 * приходит объектом (агрегат документа) либо строкой JSON (таблица решений).
 */
export function proposalHeaderOf(meta: unknown): IProposalHeader | null {
  if (!meta) return null;
  try {
    const parsed = (typeof meta === 'string' ? JSON.parse(meta) : meta) as { proposal?: IProposalHeader };
    return parsed?.proposal ?? null;
  } catch {
    return null;
  }
}

/**
 * Назначение записки для списков — цель расходов, которую автор ввёл при
 * создании. У записок без меты заявления — описание первой строки; без
 * описания — `null`.
 */
export function proposalPurpose(row: {
  items?: { description?: string | null }[] | null;
  statement_doc?: { rawDocument?: { meta?: unknown } | null } | null;
}): string | null {
  return proposalHeaderOf(row.statement_doc?.rawDocument?.meta)?.description?.trim() || row.items?.[0]?.description || null;
}
