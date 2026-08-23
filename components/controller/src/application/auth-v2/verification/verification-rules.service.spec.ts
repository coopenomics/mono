import { VerificationType, type VerificationRule } from '~/domain/auth-v2/verification/verification.types';
import { VerificationRulesService } from './verification-rules.service';

function makeService(rule: VerificationRule | null = null) {
  const repository = {
    findByActionCode: jest.fn().mockResolvedValue(rule),
    list: jest.fn().mockResolvedValue(rule ? [rule] : []),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  const service = new VerificationRulesService(repository as any);
  return { service, repository };
}

describe('VerificationRulesService (Story 4.2)', () => {
  it('getRequiredTypes: правило задано → его типы', async () => {
    const { service } = makeService({ action_code: 'council_vote', required_types: [VerificationType.CoopBaseline] });
    await expect(service.getRequiredTypes('council_vote')).resolves.toEqual([VerificationType.CoopBaseline]);
  });

  it('getRequiredTypes: правила нет → пустой список (действие без ограничений)', async () => {
    const { service, repository } = makeService(null);
    await expect(service.getRequiredTypes('whatever')).resolves.toEqual([]);
    expect(repository.findByActionCode).toHaveBeenCalledWith('whatever');
  });

  it('saveRule: дедуплицирует типы и отбрасывает невалидные, отдаёт в upsert чистый набор', async () => {
    const { service, repository } = makeService();
    const saved = await service.saveRule('council_vote', [
      VerificationType.CoopBaseline,
      VerificationType.CoopBaseline,
      'bogus_type' as VerificationType,
    ]);
    expect(saved).toEqual({ action_code: 'council_vote', required_types: [VerificationType.CoopBaseline] });
    expect(repository.upsert).toHaveBeenCalledWith({
      action_code: 'council_vote',
      required_types: [VerificationType.CoopBaseline],
    });
  });

  it('list: делегирует в репозиторий', async () => {
    const rule = { action_code: 'a', required_types: [VerificationType.CoopBaseline] };
    const { service } = makeService(rule);
    await expect(service.list()).resolves.toEqual([rule]);
  });
});
