import { isRegistrationOpen } from '~/domain/system/utils/is-registration-open.util';
import type { VarsDomainInterface } from '~/domain/system/interfaces/vars-domain.interface';

describe('isRegistrationOpen', () => {
  const filledAgreement = {
    protocol_number: '1',
    protocol_day_month_year: '01.01.2026',
  };

  const baseVars = {
    coopname: 'testcoop',
    wallet_agreement: filledAgreement,
    signature_agreement: filledAgreement,
    privacy_agreement: filledAgreement,
    user_agreement: filledAgreement,
    participant_application: filledAgreement,
  } as VarsDomainInterface;

  it('returns false when vars are missing', () => {
    expect(isRegistrationOpen(null)).toBe(false);
    expect(isRegistrationOpen(undefined)).toBe(false);
  });

  it('returns false when any required agreement var is incomplete', () => {
    expect(
      isRegistrationOpen({
        ...baseVars,
        wallet_agreement: { protocol_number: '', protocol_day_month_year: '01.01.2026' },
      })
    ).toBe(false);
  });

  it('returns true when all required agreement vars are filled', () => {
    expect(isRegistrationOpen(baseVars)).toBe(true);
  });
});
