import { NotFoundException } from '@nestjs/common';
import {
  AccessRuleEffect,
  AccessRulePrincipalKind,
  type AccessRuleRecord,
  type IAccessRulesInvalidationPublisher,
  type IAccessRulesRepository,
} from '~/domain/auth-v2/ports/access-rules.port';
import type { CapabilitySet, ICapabilitySetsRepository } from '~/domain/auth-v2/ports/capability-sets.port';
import type { AuditService } from '../audit/audit.service';
import type { AbilityFactory } from './ability.factory';
import { CapabilitySetService } from './capability-set.service';

const ACCOUNTANT: CapabilitySet = {
  setKey: 'accountant',
  title: 'Бухгалтер',
  description: 'Стол бухгалтера',
  builtin: true,
  coopname: null,
};

function setRule(setKey: string, action: string, resource: string): AccessRuleRecord {
  return {
    subjectType: AccessRulePrincipalKind.CapabilitySet,
    subjectId: setKey,
    effect: AccessRuleEffect.Allow,
    action,
    resourceType: resource,
    conditions: null,
  };
}

function build() {
  const repo = {
    listSets: jest.fn(async (): Promise<CapabilitySet[]> => [ACCOUNTANT]),
    findSet: jest.fn(async (key: string): Promise<CapabilitySet | null> => (key === 'accountant' ? ACCOUNTANT : null)),
    listActiveSetKeys: jest.fn(async (_username: string): Promise<string[]> => ['accountant']),
    listAssignments: jest.fn(async (_username: string) => []),
    assign: jest.fn(async (): Promise<void> => undefined),
    revoke: jest.fn(async (_username: string, _setKey: string): Promise<boolean> => true),
  } satisfies ICapabilitySetsRepository;
  const accessRules = {
    findForPrincipal: jest.fn(async (): Promise<AccessRuleRecord[]> => []),
    findForCapabilitySets: jest.fn(async (keys: string[]): Promise<AccessRuleRecord[]> =>
      keys.includes('accountant') ? [setRule('accountant', 'read', 'AccountingDesk')] : [],
    ),
    insert: jest.fn(async (): Promise<void> => undefined),
    deleteExpired: jest.fn(async (): Promise<number> => 0),
  } satisfies IAccessRulesRepository;
  const invalidation = { publish: jest.fn(async (): Promise<void> => undefined) } satisfies IAccessRulesInvalidationPublisher;
  const ability = { rules: [{ action: 'read', subject: 'AccountingDesk', inverted: false }] };
  const abilityFactory = {
    createForParticipantWithRules: jest.fn(async () => ability),
  } as unknown as AbilityFactory;
  const audit = { record: jest.fn(async (): Promise<void> => undefined) } as unknown as AuditService & { record: jest.Mock };
  const service = new CapabilitySetService(repo, accessRules, invalidation, abilityFactory, audit);
  return { service, repo, accessRules, invalidation, abilityFactory, audit };
}

describe('CapabilitySetService — назначаемые наборы (Story 6.11)', () => {
  it('assign: валидирует набор, пишет назначение, инвалидирует сессии, аудирует', async () => {
    const { service, repo, invalidation, audit } = build();
    await service.assign({ username: 'kate', setKey: 'accountant', grantedBy: 'chief', expiresAt: null });

    expect(repo.findSet).toHaveBeenCalledWith('accountant');
    expect(repo.assign).toHaveBeenCalledWith({ username: 'kate', setKey: 'accountant', grantedBy: 'chief', expiresAt: null });
    expect(invalidation.publish).toHaveBeenCalledWith({ subjectType: AccessRulePrincipalKind.Participant, subjectId: 'kate' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'CapabilitySetAssigned', subjectId: 'kate', actor: 'chief', result: 'success' }),
    );
  });

  it('assign: несуществующий набор → NotFound, без записи/инвалидации/аудита', async () => {
    const { service, repo, invalidation, audit } = build();
    await expect(service.assign({ username: 'kate', setKey: 'ghost', grantedBy: 'chief' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.assign).not.toHaveBeenCalled();
    expect(invalidation.publish).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('revoke: снимает набор, инвалидирует, аудирует', async () => {
    const { service, repo, invalidation, audit } = build();
    await service.revoke('kate', 'accountant', 'chief');

    expect(repo.revoke).toHaveBeenCalledWith('kate', 'accountant');
    expect(invalidation.publish).toHaveBeenCalledWith({ subjectType: AccessRulePrincipalKind.Participant, subjectId: 'kate' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'CapabilitySetRevoked', subjectId: 'kate', actor: 'chief', result: 'success', context: { set_key: 'accountant' } }),
    );
  });

  it('revoke: нет активного назначения → NotFound, без инвалидации/аудита', async () => {
    const { service, repo, invalidation, audit } = build();
    repo.revoke.mockResolvedValueOnce(false);
    await expect(service.revoke('kate', 'accountant', 'chief')).rejects.toBeInstanceOf(NotFoundException);
    expect(invalidation.publish).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('listSets отдаёт каталог наборов, обогащённый их грантами', async () => {
    const { service } = build();
    const sets = await service.listSets();
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ setKey: 'accountant', title: 'Бухгалтер' });
    expect(sets[0].grants).toEqual([{ action: 'read', resource: 'AccountingDesk' }]);
  });

  it('getMyAccess отдаёт активные наборы + плоские гранты из Ability (allow, без дублей)', async () => {
    const { service, abilityFactory } = build();
    const access = await service.getMyAccess({ username: 'kate', role: 'user' });
    expect(abilityFactory.createForParticipantWithRules).toHaveBeenCalledWith({ username: 'kate', role: 'user' });
    expect(access.sets).toEqual(['accountant']);
    expect(access.grants).toEqual([{ action: 'read', resource: 'AccountingDesk' }]);
  });
});
