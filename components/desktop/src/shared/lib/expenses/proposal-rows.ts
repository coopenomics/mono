/**
 * Подписи строки служебной записки в списках: автор, сумма, дата, назначение.
 * Одни и те же на реестре расходов, кассе и в авансах пайщика.
 */
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

/** Назначение записки — описание первой строки расхода; без описания — `null`. */
export function proposalPurpose(row: { items?: { description?: string | null }[] | null }): string | null {
  return row.items?.[0]?.description || null;
}
