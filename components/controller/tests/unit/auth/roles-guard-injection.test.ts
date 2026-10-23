/**
 * Гард прав (`RightsGuard`) живёт в пакете, а пакет собирается esbuild'ом — без
 * `emitDecoratorMetadata`. Значит зависимости гарда объявляются явным
 * `@Inject`: иначе Nest построит его без аргументов, `reflector` окажется
 * `undefined`, и первый же запрос с `@RequireRight` вместо отказа вернёт 500.
 *
 * Тест проверяет ровно это: контейнер обязан отдать гард с готовым Reflector и
 * описанием прав приложения, а операцию без требования гард пропускает.
 */
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { APP_RIGHTS, RightsGuard, type AppRights } from '@coopenomics/extension-kit';

const rights: AppRights<'council', never> = {
  extensionName: 'probe',
  table: { council: [] },
  roles: async () => [],
};

describe('RightsGuard: зависимости приходят через DI (пакет без emitDecoratorMetadata)', () => {
  const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [RightsGuard, { provide: APP_RIGHTS, useValue: rights }] }).compile();
    return moduleRef.get(RightsGuard);
  };

  it('контейнер инстанцирует гард с Reflector и описанием прав, а не с undefined', async () => {
    const guard = await build();
    expect((guard as any).reflector).toBeInstanceOf(Reflector);
    expect((guard as any).def).toBe(rights);
  });

  it('требование не объявлено — доступ открыт (обращение к reflector не роняет запрос)', async () => {
    const guard = await build();
    const handler = function unprotectedResolver() {};
    const context: any = {
      getHandler: () => handler,
      getClass: () => class {},
      getType: () => 'graphql',
      getArgs: () => [undefined, {}, { req: { headers: {}, user: { username: 'ant' } } }, {}],
      getArgByIndex: (i: number) => context.getArgs()[i],
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    };
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
