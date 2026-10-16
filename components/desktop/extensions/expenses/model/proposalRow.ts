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
