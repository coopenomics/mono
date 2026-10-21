/**
 * Почта пайщика ведётся в двух местах: в базе узла и в CoopID (authentik), где
 * по ней идёт вход. Тестнет, 21.10.2026: почту сменили в реестре пайщиков, в
 * CoopID осталась старая; новый аккаунт занял её — и вход им открыл чужой
 * кабинет. Спек фиксирует: смена почты идёт сначала в CoopID, занятость почты
 * проверяется и там, регистрация с почтой чужой учётки CoopID отклоняется.
 */
import { UserDomainService } from '~/domain/user/services/user-domain.service';

function build(opts: { identityHolders?: string[]; identityFails?: boolean } = {}) {
  const calls: string[] = [];
  const repo = {
    findByUsername: jest.fn(async (username: string) => ({ username, email: 'old@e.com' })),
    findByEmail: jest.fn(async () => null),
    isEmailTaken: jest.fn(async () => false),
    updateByUsername: jest.fn(async (username: string, updates: any) => {
      calls.push(`база ${updates.email}`);
      return { username, ...updates };
    }),
    create: jest.fn(async (data: any) => data),
  };
  const identity = {
    findUsernamesByEmail: jest.fn(async () => opts.identityHolders ?? []),
    updateEmail: jest.fn(async (_u: string, email: string) => {
      if (opts.identityFails) throw new Error('authentik недоступен');
      calls.push(`CoopID ${email}`);
      return true;
    }),
  };
  const service = new UserDomainService(repo as any, identity as any);
  (service as any).getUserByUsername = async (username: string) => ({ username, email: 'old@e.com' });
  return { service, repo, identity, calls };
}

describe('почта пайщика в базе узла и в CoopID', () => {
  it('смена почты: сначала CoopID, потом база узла', async () => {
    const { service, calls } = build();
    await service.updateUserByUsername('vatrushka', { email: 'new@e.com' } as any);
    expect(calls).toEqual(['CoopID new@e.com', 'база new@e.com']);
  });

  it('break: почта занята другой учёткой CoopID — смена отклонена, ни CoopID, ни база не тронуты', async () => {
    const { service, repo, identity } = build({ identityHolders: ['strina'] });
    await expect(service.updateUserByUsername('vatrushka', { email: 'busy@e.com' } as any)).rejects.toThrow();
    expect(identity.updateEmail).not.toHaveBeenCalled();
    expect(repo.updateByUsername).not.toHaveBeenCalled();
  });

  it('break: CoopID недоступен при смене почты — база узла не меняется, почты не расходятся', async () => {
    const { service, repo } = build({ identityFails: true });
    await expect(service.updateUserByUsername('vatrushka', { email: 'new@e.com' } as any)).rejects.toThrow('authentik недоступен');
    expect(repo.updateByUsername).not.toHaveBeenCalled();
  });

  it('почта у той же учётки CoopID — не считается занятой', async () => {
    const { service } = build({ identityHolders: ['vatrushka'] });
    await expect(service.isEmailTaken('mine@e.com', 'vatrushka')).resolves.toBe(false);
  });

  it('break: регистрация с почтой чужой учётки CoopID отклоняется', async () => {
    const { service, repo } = build({ identityHolders: ['vatrushka'] });
    await expect(service.createUser({ username: 'strina', email: 'archiday@e.com' } as any)).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('без CoopID (контур без authentik) — почта ведётся только в базе узла', async () => {
    const repo = {
      isEmailTaken: jest.fn(async () => false),
      updateByUsername: jest.fn(async (username: string, updates: any) => ({ username, ...updates })),
    };
    const service = new UserDomainService(repo as any);
    (service as any).getUserByUsername = async (username: string) => ({ username, email: 'old@e.com' });
    await expect(service.updateUserByUsername('vatrushka', { email: 'new@e.com' } as any)).resolves.toEqual(
      expect.objectContaining({ email: 'new@e.com' }),
    );
  });
});
