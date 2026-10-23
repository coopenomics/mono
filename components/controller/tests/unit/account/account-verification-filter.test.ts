/**
 * Отбор реестра пайщиков по уровню верификации (серверная постраничность реестра).
 *
 * Уровни живут в цепи: «паспорт сверен» — запись procedure = passport с
 * is_verified в registrator::accounts, базовый уровень — пайщик принят советом.
 * Правило должно совпадать с тем, как десктоп рисует бейджи
 * (`deriveVerificationTypes` в @coopenomics/auth).
 */
import {
  AccountVerificationFilter,
  matchesVerificationFilter,
} from '~/domain/account/utils/account-verification-filter';

const passport = (is_verified: boolean) => ({ verifications: [{ procedure: 'passport', is_verified } as any] });
const accepted = { status: 'accepted' } as any;
const pending = { status: 'pending' } as any;

const { PASSPORT, NO_PASSPORT, NONE } = AccountVerificationFilter;

describe('matchesVerificationFilter', () => {
  it('паспорт сверен — только в «паспорт проверен»', () => {
    expect(matchesVerificationFilter(PASSPORT, passport(true), accepted)).toBe(true);
    expect(matchesVerificationFilter(NO_PASSPORT, passport(true), accepted)).toBe(false);
    expect(matchesVerificationFilter(NONE, passport(true), null)).toBe(false);
  });

  it('незавершённая сверка паспорта уровнем не считается', () => {
    expect(matchesVerificationFilter(PASSPORT, passport(false), accepted)).toBe(false);
    expect(matchesVerificationFilter(NO_PASSPORT, passport(false), accepted)).toBe(true);
  });

  it('другая процедура не делает паспорт сверенным', () => {
    const other = { verifications: [{ procedure: 'email', is_verified: true } as any] };
    expect(matchesVerificationFilter(PASSPORT, other, accepted)).toBe(false);
  });

  it('принят советом без паспорта — «нужен паспорт», но не «без уровней»', () => {
    expect(matchesVerificationFilter(NO_PASSPORT, { verifications: [] }, accepted)).toBe(true);
    expect(matchesVerificationFilter(NONE, { verifications: [] }, accepted)).toBe(false);
  });

  it('не принят и паспорт не сверен — «без уровней»; нет записей в цепи — тоже', () => {
    expect(matchesVerificationFilter(NONE, { verifications: [] }, pending)).toBe(true);
    expect(matchesVerificationFilter(NONE, null, null)).toBe(true);
    expect(matchesVerificationFilter(NO_PASSPORT, null, null)).toBe(true);
    expect(matchesVerificationFilter(PASSPORT, null, null)).toBe(false);
  });
});
