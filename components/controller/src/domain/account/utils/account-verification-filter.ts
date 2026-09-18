import type { RegistratorContract, SovietContract } from 'cooptypes';

/**
 * Фильтр реестра пайщиков по уровню верификации.
 *
 * Уровни верификации живут в цепи, а не в базе узла: базовый уровень — пайщик
 * принят советом (запись в soviet::participants со статусом accepted), уровень
 * «паспорт сверен» — запись procedure = passport с is_verified в
 * registrator::accounts. Правило повторяет `deriveVerificationTypes` из
 * `@coopenomics/auth` (там же десктоп рисует бейджи); контроллер от этого пакета
 * не зависит, поэтому здесь только то, что нужно для отбора.
 */
export enum AccountVerificationFilter {
  /** Паспорт ещё не сверен — таких совету предстоит верифицировать. */
  NO_PASSPORT = 'NO_PASSPORT',
  /** Паспорт сверен на участке или советом. */
  PASSPORT = 'PASSPORT',
  /** Ни одного уровня: не принят советом и паспорт не сверен. */
  NONE = 'NONE',
}

const PASSPORT_PROCEDURE = 'passport';

export function matchesVerificationFilter(
  filter: AccountVerificationFilter,
  user_account: Pick<RegistratorContract.Tables.Accounts.IAccount, 'verifications'> | null,
  participant_account: Pick<SovietContract.Tables.Participants.IParticipants, 'status'> | null
): boolean {
  const passport = (user_account?.verifications ?? []).some(
    (record) => record?.is_verified && String(record.procedure) === PASSPORT_PROCEDURE
  );
  const baseline = participant_account?.status === 'accepted';

  switch (filter) {
    case AccountVerificationFilter.PASSPORT:
      return passport;
    case AccountVerificationFilter.NO_PASSPORT:
      return !passport;
    case AccountVerificationFilter.NONE:
      return !passport && !baseline;
    default:
      return true;
  }
}
