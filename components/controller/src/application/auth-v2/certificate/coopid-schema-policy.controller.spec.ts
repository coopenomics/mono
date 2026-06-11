import { CoopIdSchemaPolicyController } from './coopid-schema-policy.controller';

describe('CoopIdSchemaPolicyController', () => {
  it('отдаёт публичную политику версий схемы: current/min/deprecation (Story 4.10)', () => {
    const policy = new CoopIdSchemaPolicyController().getSchemaPolicy();
    expect(policy.current_version).toBe('1');
    expect(policy.min_supported_version).toBe('1');
    expect(policy.deprecation).toEqual({ '0': '2026-01-01' });
  });
});
