import { ForbiddenException } from '@nestjs/common';
import type { IAccessRulesRepository } from '~/domain/auth-v2/ports/access-rules.port';
import type { ICapabilitySetsRepository } from '~/domain/auth-v2/ports/capability-sets.port';
import { AbilityFactory } from './ability.factory';
import { PolicyService } from './policy.service';
import { PolicyRegistry } from './policy.registry';
import type { CheckAbilityRequirement } from './check-ability.decorator';

const emptyRepo: IAccessRulesRepository = {
  findForPrincipal: async () => [],
  findForCapabilitySets: async () => [],
  insert: async () => undefined,
  deleteExpired: async () => 0,
};

const emptySets: ICapabilitySetsRepository = {
  listSets: async () => [],
  findSet: async () => null,
  listActiveSetKeys: async () => [],
  listAssignments: async () => [],
  assign: async () => undefined,
  revoke: async () => false,
};

function makeService(evaluate?: jest.Mock): { service: PolicyService; evaluate: jest.Mock } {
  const evalFn = evaluate ?? jest.fn();
  const registry = { evaluate: evalFn } as unknown as PolicyRegistry;
  const service = new PolicyService(new AbilityFactory(emptyRepo, emptySets), registry);
  return { service, evaluate: evalFn };
}

const req = (
  action: CheckAbilityRequirement['action'],
  subject: CheckAbilityRequirement['subject'],
  policy?: string,
): CheckAbilityRequirement => ({ action, subject, policy });

describe('PolicyService — Layer 4 общий вычислитель (Story 6.4)', () => {
  it('нет авторизованного пайщика → 403', async () => {
    const { service } = makeService();
    await expect(service.ensure(req('read', 'Participant'), undefined)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Ability разрешает (chairman manage VerificationRule) → проходит', async () => {
    const { service } = makeService();
    await expect(service.ensure(req('manage', 'VerificationRule'), { username: 'chief', role: 'chairman' }))
      .resolves.toBeUndefined();
  });

  it('Ability запрещает (user manage VerificationRule) → 403', async () => {
    const { service } = makeService();
    await expect(service.ensure(req('manage', 'VerificationRule'), { username: 'ant', role: 'user' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('instance-level ownership через resource (свой Certificate → ок, чужой → 403)', async () => {
    const { service } = makeService();
    await expect(service.ensure(req('read', 'Certificate'), { username: 'ant', role: 'user' }, { owner: 'ant' }))
      .resolves.toBeUndefined();
    await expect(service.ensure(req('read', 'Certificate'), { username: 'ant', role: 'user' }, { owner: 'bob' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('Layer 3: политика вызывается только после прохождения Ability и решает допуск', async () => {
    const evaluate = jest.fn().mockResolvedValue(false);
    const { service } = makeService(evaluate);
    // Ability проходит (chairman create CriticalAction), но политика отказывает → 403.
    await expect(service.ensure(req('create', 'CriticalAction', 'same-coop-voting'), { username: 'chief', role: 'chairman' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(evaluate).toHaveBeenCalledWith('same-coop-voting', expect.objectContaining({ action: 'create', subject: 'CriticalAction' }));

    evaluate.mockResolvedValue(true);
    await expect(service.ensure(req('create', 'CriticalAction', 'same-coop-voting'), { username: 'chief', role: 'chairman' }))
      .resolves.toBeUndefined();
  });

  it('политика НЕ вызывается, если Ability уже отказала', async () => {
    const evaluate = jest.fn().mockResolvedValue(true);
    const { service } = makeService(evaluate);
    await expect(service.ensure(req('manage', 'CoopSettings', 'same-coop-voting'), { username: 'ant', role: 'user' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(evaluate).not.toHaveBeenCalled();
  });
});
