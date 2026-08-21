/** Гранты столов edubridge: гость, председатель до ЦПП, пайщик без оферт, неактивный. */
import { EdubridgeDesktopGrantsProvider } from '~/extensions/edubridge/application/desktop/edubridge-desktop-grants.provider';
import { EdubridgeMembershipService } from '~/extensions/edubridge/application/membership/edubridge-membership.service';
import { EdubridgeConfigHolder } from '~/extensions/edubridge/application/config/edubridge-config.holder';
import { defaultConfig } from '~/extensions/edubridge/types';

function make(opts: { accepted?: boolean; teacher?: boolean; learner?: boolean } = {}) {
  const holder = new EdubridgeConfigHolder({ get: async () => null } as any);
  holder.set({ ...defaultConfig, coopAcceptance: { accepted: opts.accepted ?? true, accepted_at: '' } });
  const facts = { resolve: async () => ({ isLearner: !!opts.learner, isTeacher: !!opts.teacher, isAdmin: false }) };
  const membership = new EdubridgeMembershipService(facts, holder);
  const registry = { register: jest.fn() };
  return new EdubridgeDesktopGrantsProvider(registry, membership);
}

const coop = 'voskhod';

describe('EdubridgeDesktopGrantsProvider', () => {
  it('гость: только каталог', async () => {
    const grants = await make().resolveGrants({ coopname: coop });
    expect(grants).toEqual(['EduCatalog:read']);
  });

  it('председатель до принятия ЦПП: каталог + настройка, рабочих прав нет', async () => {
    const grants = await make({ accepted: false }).resolveGrants({ coopname: coop, username: 'ant', userRole: 'chairman', userStatus: 'active' });
    expect(grants.sort()).toEqual(['EduCatalog:read', 'Extension:configure']);
  });

  it('ЦПП принята, пайщик без оферт: маркеры онбординга обоих столов, рабочих прав нет', async () => {
    const grants = await make().resolveGrants({ coopname: coop, username: 'ant', userRole: 'user', userStatus: 'active' });
    expect(grants).toContain('Onboarding:learner');
    expect(grants).toContain('Onboarding:teacher');
    expect(grants.some((g) => g.startsWith('EduLearner:'))).toBe(false);
  });

  it('преподаватель: права преподавателя, маркер только для слушателя', async () => {
    const grants = await make({ teacher: true }).resolveGrants({ coopname: coop, username: 'ant', userRole: 'user', userStatus: 'active' });
    expect(grants).toContain('EduAssignment:read:own');
    expect(grants).toContain('Onboarding:learner');
    expect(grants).not.toContain('Onboarding:teacher');
  });

  it('пайщик со статусом не active — как гость', async () => {
    const grants = await make().resolveGrants({ coopname: coop, username: 'ant', userRole: 'user', userStatus: 'blocked' });
    expect(grants).toEqual(['EduCatalog:read']);
  });
});
