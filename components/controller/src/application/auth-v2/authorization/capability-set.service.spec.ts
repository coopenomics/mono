import { NotFoundException } from '@nestjs/common';
import { AccessRulePrincipalKind, type IAccessRulesInvalidationPublisher } from '~/domain/auth-v2/ports/access-rules.port';
import type { CapabilitySet, ICapabilitySetsRepository } from '~/domain/auth-v2/ports/capability-sets.port';
import type { AuditService } from '../audit/audit.service';
import { CapabilitySetService } from './capability-set.service';

const ACCOUNTANT: CapabilitySet = {
  setKey: 'accountant',
  title: 'Бухгалтер',
  description: 'Стол бухгалтера',
  builtin: true,
  coopname: null,
};

function build() {
  const repo = {
    listSets: jest.fn(async (): Promise<CapabilitySet[]> => [ACCOUNTANT]),
    findSet: jest.fn(async (key: string): Promise<CapabilitySet | null> => (key === 'accountant' ? ACCOUNTANT : null)),
    listActiveSetKeys: jest.fn(async (_username: string): Promise<string[]> => []),
    listAssignments: jest.fn(async (_username: string) => []),
    assign: jest.fn(async (): Promise<void> => undefined),
    revoke: jest.fn(async (_username: string, _setKey: string): Promise<boolean> => true),
  } satisfies ICapabilitySetsRepository;
  const invalidation = { publish: jest.fn(async (): Promise<void> => undefined) } satisfies IAccessRulesInvalidationPublisher;
  const audit = { record: jest.fn(async (): Promise<void> => undefined) } as unknown as AuditService & { record: jest.Mock };
  const service = new CapabilitySetService(repo, invalidation, audit);
  return { service, repo, invalidation, audit };
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

  it('listSets отдаёт каталог наборов', async () => {
    const { service } = build();
    await expect(service.listSets()).resolves.toEqual([ACCOUNTANT]);
  });
});
