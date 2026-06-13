import { subject } from '@casl/ability';
import {
  AccessRuleEffect,
  AccessRulePrincipalKind,
  type AccessRuleRecord,
  type IAccessRulesRepository,
} from '~/domain/auth-v2/ports/access-rules.port';
import type { ICapabilitySetsRepository } from '~/domain/auth-v2/ports/capability-sets.port';
import { AbilityFactory } from './ability.factory';
import { deserializeAbility, serializeAbility } from './ability.serialization';

/** Stub репозитория Layer 2 — для тестов Layer 1 (правил нет). */
const emptyRepo: IAccessRulesRepository = {
  findForPrincipal: async () => [],
  findForCapabilitySets: async () => [],
  insert: async () => undefined,
};

/** Stub репозитория наборов — пайщику ничего не назначено. */
const emptySets: ICapabilitySetsRepository = {
  listSets: async () => [],
  findSet: async () => null,
  listActiveSetKeys: async () => [],
  listAssignments: async () => [],
  assign: async () => undefined,
  revoke: async () => false,
};

describe('AbilityFactory — Layer 1 static ability (Story 6.1)', () => {
  const factory = new AbilityFactory(emptyRepo, emptySets);
  const ownCert = subject('Certificate', { owner: 'ant' });
  const foreignCert = subject('Certificate', { owner: 'bob' });

  describe('participant (role=user)', () => {
    const ability = factory.createForParticipant({ username: 'ant', role: 'user' });

    it('управляет своими сущностями, но не чужими', () => {
      expect(ability.can('read', ownCert)).toBe(true);
      expect(ability.can('read', foreignCert)).toBe(false);
      expect(ability.can('update', subject('Session', { owner: 'ant' }))).toBe(true);
      expect(ability.can('manage', subject('RecoveryStrategy', { owner: 'ant' }))).toBe(true);
    });

    it('не имеет админ-прав и не участвует в critical actions', () => {
      expect(ability.can('read', 'Participant')).toBe(false);
      expect(ability.can('manage', 'VerificationRule')).toBe(false);
      expect(ability.can('confirm', 'CriticalAction')).toBe(false);
      expect(ability.can('create', 'CriticalAction')).toBe(false);
    });
  });

  describe('council member (role=member)', () => {
    const ability = factory.createForParticipant({ username: 'eve', role: 'member' });

    it('наследует права пайщика над своими сущностями', () => {
      expect(ability.can('read', subject('Certificate', { owner: 'eve' }))).toBe(true);
    });

    it('read-only надзор + подтверждает critical action, но не инициирует/не модерирует', () => {
      expect(ability.can('read', 'Participant')).toBe(true);
      expect(ability.can('read', 'VerificationRule')).toBe(true);
      expect(ability.can('read', 'AuditEvent')).toBe(true);
      expect(ability.can('confirm', 'CriticalAction')).toBe(true);
      expect(ability.can('create', 'CriticalAction')).toBe(false);
      expect(ability.can('manage', 'VerificationRule')).toBe(false);
      expect(ability.can('update', 'Participant')).toBe(false);
    });
  });

  describe('chairman (role=chairman)', () => {
    const ability = factory.createForParticipant({ username: 'chief', role: 'chairman' });

    it('модерирует + инициирует critical action + наследует Member/User', () => {
      expect(ability.can('manage', 'VerificationRule')).toBe(true);
      expect(ability.can('manage', 'CoopSettings')).toBe(true);
      expect(ability.can('update', 'Participant')).toBe(true);
      expect(ability.can('create', 'Capability')).toBe(true);
      expect(ability.can('create', 'CriticalAction')).toBe(true);
      expect(ability.can('confirm', 'CriticalAction')).toBe(true);
      expect(ability.can('read', subject('Certificate', { owner: 'chief' }))).toBe(true);
    });
  });

  describe('платформенный admin / неизвестная роль → пустая Ability', () => {
    it.each(['admin', 'superuser', undefined, null])('role=%s ничего не может', (role) => {
      const ability = factory.createForParticipant({ username: 'x', role: role as string });
      expect(ability.can('read', 'Participant')).toBe(false);
      expect(ability.can('read', subject('Certificate', { owner: 'x' }))).toBe(false);
      expect(ability.can('manage', 'VerificationRule')).toBe(false);
    });
  });

  describe('сериализация в Redis-session (pack → unpack) сохраняет решения', () => {
    it('round-trip сохраняет правила и условия владения', () => {
      const ability = factory.createForParticipant({ username: 'chief', role: 'chairman' });
      const restored = deserializeAbility(serializeAbility(ability));

      expect(restored.can('manage', 'VerificationRule')).toBe(true);
      expect(restored.can('create', 'CriticalAction')).toBe(true);
      expect(restored.can('read', subject('Certificate', { owner: 'chief' }))).toBe(true);
      expect(restored.can('read', subject('Certificate', { owner: 'other' }))).toBe(false);
    });
  });
});

describe('AbilityFactory — Layer 2 access_rules merge (Story 6.2)', () => {
  const factory = new AbilityFactory(emptyRepo, emptySets);

  function rule(partial: Partial<AccessRuleRecord> & Pick<AccessRuleRecord, 'action' | 'resourceType'>): AccessRuleRecord {
    return {
      subjectType: AccessRulePrincipalKind.Role,
      subjectId: 'User',
      effect: AccessRuleEffect.Allow,
      conditions: null,
      ...partial,
    };
  }

  it('allow-правило добавляет возможность сверх статической матрицы', () => {
    const ability = factory.createForParticipant(
      { username: 'ant', role: 'user' },
      [rule({ action: 'vote', resourceType: 'CriticalAction' })],
    );
    expect(ability.can('vote', 'CriticalAction')).toBe(true);
  });

  it('deny-правило перекрывает статический allow (precedence)', () => {
    const ability = factory.createForParticipant(
      { username: 'chief', role: 'chairman' },
      [rule({ effect: AccessRuleEffect.Deny, action: 'manage', resourceType: 'VerificationRule' })],
    );
    expect(ability.can('manage', 'VerificationRule')).toBe(false);
    expect(ability.can('read', 'VerificationRule')).toBe(false);
  });

  it('conditions сужают доступ до совпадающих экземпляров', () => {
    const ability = factory.createForParticipant(
      { username: 'ant', role: 'user' },
      [rule({ action: 'vote', resourceType: 'CriticalAction', conditions: { branch: 'b1' } })],
    );
    expect(ability.can('vote', subject('CriticalAction', { branch: 'b1' }))).toBe(true);
    expect(ability.can('vote', subject('CriticalAction', { branch: 'b2' }))).toBe(false);
  });

  it('createForParticipantWithRules читает репозиторий по core-ролям+username и мерджит', async () => {
    const repo: IAccessRulesRepository = {
      findForPrincipal: jest.fn(async () => [rule({ action: 'vote', resourceType: 'CriticalAction' })]),
      findForCapabilitySets: async () => [],
      insert: async () => undefined,
    };
    const f = new AbilityFactory(repo, emptySets);
    const ability = await f.createForParticipantWithRules({ username: 'eve', role: 'member' });

    expect(repo.findForPrincipal).toHaveBeenCalledWith(['User', 'Member'], 'eve');
    expect(ability.can('vote', 'CriticalAction')).toBe(true);
    expect(ability.can('read', 'Participant')).toBe(true); // статика Member сохранена
  });
});

describe('AbilityFactory — назначаемые наборы возможностей merge (Story 6.11)', () => {
  function setRule(setKey: string, action: string, resourceType: string): AccessRuleRecord {
    return {
      subjectType: AccessRulePrincipalKind.CapabilitySet,
      subjectId: setKey,
      effect: AccessRuleEffect.Allow,
      action,
      resourceType,
      conditions: null,
    };
  }

  it('правила назначенного набора добавляются к Ability пайщика поверх core-роли', async () => {
    const accessRules: IAccessRulesRepository = {
      findForPrincipal: async () => [],
      findForCapabilitySets: jest.fn(async (keys: string[]) =>
        keys.includes('cashier') ? [setRule('cashier', 'read', 'PaymentRegistry'), setRule('cashier', 'confirm', 'PaymentRegistry')] : [],
      ),
      insert: async () => undefined,
    };
    const sets: ICapabilitySetsRepository = {
      ...emptySets,
      listActiveSetKeys: jest.fn(async () => ['cashier']),
    };
    const f = new AbilityFactory(accessRules, sets);
    const ability = await f.createForParticipantWithRules({ username: 'kate', role: 'user' });

    expect(sets.listActiveSetKeys).toHaveBeenCalledWith('kate');
    expect(accessRules.findForCapabilitySets).toHaveBeenCalledWith(['cashier']);
    expect(ability.can('read', 'PaymentRegistry')).toBe(true);
    expect(ability.can('confirm', 'PaymentRegistry')).toBe(true);
    expect(ability.can('read', subject('Certificate', { owner: 'kate' }))).toBe(true); // core User сохранён
  });

  it('без назначенных наборов набор-правила не запрашиваются (пустой setKeys → пусто)', async () => {
    const accessRules: IAccessRulesRepository = {
      findForPrincipal: async () => [],
      findForCapabilitySets: jest.fn(async () => []),
      insert: async () => undefined,
    };
    const f = new AbilityFactory(accessRules, emptySets);
    const ability = await f.createForParticipantWithRules({ username: 'bob', role: 'user' });

    expect(accessRules.findForCapabilitySets).toHaveBeenCalledWith([]);
    expect(ability.can('read', 'PaymentRegistry')).toBe(false);
  });
});
