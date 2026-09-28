import moment from './moment';
import { getTimezone } from './timezone';

/**
 * Дата создания документа из его меты — в виде «ДД.ММ.ГГГГ ЧЧ:ММ».
 *
 * Фабрика пишет `meta.created_at` в ISO 8601 и называет пояс документа в
 * `meta.timezone`; дата переводится в этот пояс, как в самом документе.
 * Документы до 28.09.2026 хранят дату уже в виде для человека — она
 * показывается как есть.
 */
export function formatDocumentCreatedAt(meta?: { created_at?: string; timezone?: string } | null): string {
  const value = meta?.created_at;
  if (!value) return '';
  const parsed = moment(value, moment.ISO_8601, true);
  if (!parsed.isValid()) return value;
  return parsed.tz(meta?.timezone || getTimezone()).format('DD.MM.YYYY HH:mm');
}
