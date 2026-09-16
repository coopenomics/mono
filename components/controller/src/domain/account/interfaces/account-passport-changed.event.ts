import type { PassportDataDomainInterface } from '~/domain/common/interfaces/passport-data-domain.interface';

/**
 * Совет меняет паспортные данные пайщика. Сверка по паспорту подтверждала
 * прежний документ, поэтому до записи нового её снимают; заново её ставит
 * председатель или член совета. Публикуется через `emitAsync`: если отозвать
 * сверку не удалось, данные не меняются.
 */
export const ACCOUNT_PASSPORT_CHANGED_EVENT = 'account::passport-changed';

export interface AccountPassportChangedEvent {
  /** Чей паспорт меняется. */
  username: string;
  /** Кто меняет — от его имени снимается сверка. */
  actor: string;
}

/** Совпадают ли паспорта по всем полям документа. Отсутствие с обеих сторон — совпадение. */
export function isSamePassport(
  previous: PassportDataDomainInterface | null | undefined,
  next: PassportDataDomainInterface | null | undefined
): boolean {
  if (!previous && !next) return true;
  if (!previous || !next) return false;
  return (
    String(previous.series) === String(next.series) &&
    String(previous.number) === String(next.number) &&
    String(previous.code ?? '') === String(next.code ?? '') &&
    String(previous.issued_at ?? '') === String(next.issued_at ?? '') &&
    String(previous.issued_by ?? '').trim() === String(next.issued_by ?? '').trim()
  );
}
