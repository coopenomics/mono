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

/** Дата записки для таблиц: короткие дата и время, пусто — прочерк. */
export function formatProposalDate(createdAt?: string | null): string {
  if (!createdAt) return '—';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleString(uiLocale(), { dateStyle: 'short', timeStyle: 'short' });
}

/** Назначение записки — описание первой строки расхода; без описания — `null`. */
export function proposalPurpose(row: { items?: { description?: string | null }[] | null }): string | null {
  return row.items?.[0]?.description || null;
}
