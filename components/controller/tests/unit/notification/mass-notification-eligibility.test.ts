import { isEligibleForParticipantMassNotification, MonoAccountStatus } from '@coopenomics/innercoop';

const account = (over: Partial<{ status: MonoAccountStatus; is_registered: boolean; has_account: boolean }> = {}) => ({
  provider_account: {
    username: 'member',
    status: MonoAccountStatus.Active,
    is_registered: true,
    has_account: true,
    ...over,
  },
}) as Parameters<typeof isEligibleForParticipantMassNotification>[0];

describe('Кого включаем в массовые рассылки пайщикам', () => {
  it('действующий пайщик получает', () => {
    expect(isEligibleForParticipantMassNotification(account())).toBe(true);
  });

  it('пайщик со снятым флагом has_account всё равно получает', () => {
    // Флаг говорит лишь о заведении аккаунта при регистрации и у ранних пайщиков
    // остался false при живом аккаунте — из-за него из рассылок о собраниях
    // выпадали действующие пайщики, включая членов совета (инцидент 2026-08-27).
    expect(isEligibleForParticipantMassNotification(account({ has_account: false }))).toBe(true);
  });

  it.each([
    MonoAccountStatus.Created,
    MonoAccountStatus.Joined,
    MonoAccountStatus.Payed,
    MonoAccountStatus.Registered,
  ])('не завершивший вступление (%s) не получает', (status) => {
    expect(isEligibleForParticipantMassNotification(account({ status }))).toBe(false);
  });

  it.each([
    MonoAccountStatus.Failed,
    MonoAccountStatus.Refunding,
    MonoAccountStatus.Refunded,
    MonoAccountStatus.Blocked,
  ])('выбывший или заблокированный (%s) не получает', (status) => {
    expect(isEligibleForParticipantMassNotification(account({ status }))).toBe(false);
  });

  it('незавершённая регистрация не получает', () => {
    expect(isEligibleForParticipantMassNotification(account({ is_registered: false }))).toBe(false);
  });

  it('без учётной записи у провайдера не получает', () => {
    expect(isEligibleForParticipantMassNotification({ provider_account: null })).toBe(false);
  });
});
