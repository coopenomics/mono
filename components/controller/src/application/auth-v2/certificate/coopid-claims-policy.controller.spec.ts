import config from '~/config/config';
import { CoopIdClaimsPolicyController } from './coopid-claims-policy.controller';

describe('CoopIdClaimsPolicyController', () => {
  it('отдаёт публичную политику claims с обязательством, периодом и ссылкой на договор (Story 4.8)', () => {
    const policy = new CoopIdClaimsPolicyController().getClaimsPolicy();
    expect(policy.data_retention_contract).toBe('erase_on_exclusion');
    expect(policy.retention_period_days).toBe(30);
    expect(policy.policy_version).toBe('1');
    expect(policy.membership_agreement_url).toBe(`https://${config.coopname}.coop/agreement`);
    expect(policy.description).toContain('participant_certificate');
  });
});
