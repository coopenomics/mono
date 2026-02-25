import { CaslAbilityFactory, type UserForAbility } from '../../../src/infrastructure/casl/casl-ability.factory';
import { Action } from '../../../src/infrastructure/casl/actions';
import { Subject } from '../../../src/infrastructure/casl/subjects';

describe('CaslAbilityFactory', () => {
  const factory = new CaslAbilityFactory();

  describe('chairman role', () => {
    const chairman: UserForAbility = { username: 'ant', role: 'chairman' };
    const ability = factory.createForUser(chairman);

    it('can manage all resources', () => {
      expect(ability.can(Action.Manage, Subject.All)).toBe(true);
    });

    it('can read system', () => {
      expect(ability.can(Action.Read, Subject.System)).toBe(true);
    });

    it('can manage extensions', () => {
      expect(ability.can(Action.Manage, Subject.Extension)).toBe(true);
    });

    it('can generate reports', () => {
      expect(ability.can(Action.Create, Subject.Report)).toBe(true);
    });

    it('can share pages', () => {
      expect(ability.can(Action.Share, Subject.All)).toBe(true);
    });
  });

  describe('member role', () => {
    const member: UserForAbility = { username: 'petr', role: 'member' };
    const ability = factory.createForUser(member);

    it('can read all resources', () => {
      expect(ability.can(Action.Read, Subject.Payment)).toBe(true);
      expect(ability.can(Action.Read, Subject.Participant)).toBe(true);
      expect(ability.can(Action.Read, Subject.Document)).toBe(true);
    });

    it('can create/update issues', () => {
      expect(ability.can(Action.Create, Subject.Issue)).toBe(true);
      expect(ability.can(Action.Update, Subject.Issue)).toBe(true);
    });

    it('can execute decisions', () => {
      expect(ability.can(Action.Execute, Subject.Decision)).toBe(true);
    });

    it('cannot manage system', () => {
      expect(ability.can(Action.Manage, Subject.System)).toBe(false);
    });

    it('cannot manage extensions', () => {
      expect(ability.can(Action.Manage, Subject.Extension)).toBe(false);
    });

    it('can share pages', () => {
      expect(ability.can(Action.Share, Subject.Payment)).toBe(true);
    });

    it('can read reports', () => {
      expect(ability.can(Action.Read, Subject.Report)).toBe(true);
    });
  });

  describe('user role', () => {
    const user: UserForAbility = { username: 'ivan', role: 'user' };
    const ability = factory.createForUser(user);

    it('can read own wallet', () => {
      expect(ability.can(Action.Read, Subject.Wallet)).toBe(true);
    });

    it('can read own profile', () => {
      expect(ability.can(Action.Read, Subject.Profile)).toBe(true);
    });

    it('can update own profile', () => {
      expect(ability.can(Action.Update, Subject.Profile)).toBe(true);
    });

    it('can read/update issues', () => {
      expect(ability.can(Action.Read, Subject.Issue)).toBe(true);
      expect(ability.can(Action.Update, Subject.Issue)).toBe(true);
    });

    it('cannot read payments (cooperative level)', () => {
      expect(ability.can(Action.Read, Subject.Payment)).toBe(false);
    });

    it('cannot create decisions', () => {
      expect(ability.can(Action.Create, Subject.Decision)).toBe(false);
    });

    it('cannot share pages', () => {
      expect(ability.can(Action.Share, Subject.Payment)).toBe(false);
    });

    it('cannot manage system', () => {
      expect(ability.can(Action.Manage, Subject.System)).toBe(false);
    });
  });

  describe('granular permissions', () => {
    it('user with extra permissions can access granted resources', () => {
      const user: UserForAbility = {
        username: 'olga',
        role: 'user',
        permissions: [
          { action: Action.Read, subject: Subject.Payment },
          { action: Action.Read, subject: Subject.Ledger },
        ],
      };
      const ability = factory.createForUser(user);

      expect(ability.can(Action.Read, Subject.Payment)).toBe(true);
      expect(ability.can(Action.Read, Subject.Ledger)).toBe(true);
      expect(ability.can(Action.Create, Subject.Payment)).toBe(false);
    });

    it('granted execute permission works', () => {
      const user: UserForAbility = {
        username: 'test',
        role: 'user',
        permissions: [
          { action: Action.Execute, subject: Subject.Payment },
        ],
      };
      const ability = factory.createForUser(user);

      expect(ability.can(Action.Execute, Subject.Payment)).toBe(true);
      expect(ability.can(Action.Delete, Subject.Payment)).toBe(false);
    });
  });
});
