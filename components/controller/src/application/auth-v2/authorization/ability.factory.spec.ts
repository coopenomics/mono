import { subject } from '@casl/ability';
import { AbilityFactory } from './ability.factory';
import { deserializeAbility, serializeAbility } from './ability.serialization';

describe('AbilityFactory — Layer 1 static ability (Story 6.1)', () => {
  const factory = new AbilityFactory();
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
      // наследование
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
