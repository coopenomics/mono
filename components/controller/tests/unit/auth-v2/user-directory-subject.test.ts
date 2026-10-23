import { UserDirectoryInnercoopAdapter } from '~/infrastructure/innercoop/user-directory-innercoop.adapter';

/**
 * Справочник пользователей: `sub` из CoopID сводится к пайщику через имя учётки.
 *
 * uuid учётки authentik и id пользователя ядра — разные числа; сеть карт присылает
 * первый, и по нему пайщика раньше не находили (стенд 02.09.2026).
 */
describe('innercoop: пользователь по sub из CoopID', () => {
  const member = { id: '4214c35f-3120-4450-9638-832100f904b9', username: 'ant' };
  const build = (opts: { byId?: unknown; byUsername?: unknown; usernameByUuid?: string | null }) => {
    const userRepository = {
      findById: jest.fn(async () => opts.byId ?? null),
      findByUsername: jest.fn(async () => opts.byUsername ?? null),
    };
    const userDomainService = { getUserByLegacyMongoId: jest.fn() };
    const authentik = { findUsernameByUuid: jest.fn(async () => opts.usernameByUuid ?? null) };
    return {
      adapter: new UserDirectoryInnercoopAdapter(userRepository as any, userDomainService as any, authentik as any),
      userRepository,
      authentik,
    };
  };

  it('свой id ядра находится напрямую, в authentik не ходим', async () => {
    const { adapter, authentik } = build({ byId: member });
    await expect(adapter.findBySubject(member.id)).resolves.toBe(member);
    expect(authentik.findUsernameByUuid).not.toHaveBeenCalled();
  });

  it('uuid учётки CoopID сводится к пайщику через имя учётки', async () => {
    const { adapter, authentik, userRepository } = build({ byUsername: member, usernameByUuid: 'ant' });
    await expect(adapter.findBySubject('2f8a6bb6-e892-4044-ae52-3e0d0f2e45ee')).resolves.toBe(member);
    expect(authentik.findUsernameByUuid).toHaveBeenCalledWith('2f8a6bb6-e892-4044-ae52-3e0d0f2e45ee');
    expect(userRepository.findByUsername).toHaveBeenCalledWith('ant');
  });

  it('неизвестный uuid — та же ошибка, что и раньше', async () => {
    const { adapter } = build({ usernameByUuid: null });
    await expect(adapter.findBySubject('2f8a6bb6-e892-4044-ae52-3e0d0f2e45ee')).rejects.toThrow('Пользователь с указанным JWT не найден');
  });

  it('не-uuid в authentik не отправляется', async () => {
    const { adapter, authentik } = build({});
    await expect(adapter.findBySubject('not-an-id')).rejects.toThrow();
    expect(authentik.findUsernameByUuid).not.toHaveBeenCalled();
  });
});
