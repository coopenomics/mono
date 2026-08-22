/**
 * `RolesGuard` живёт в пакете, а пакет собирается esbuild'ом — без
 * `emitDecoratorMetadata`. Значит зависимость гарда объявляется явным
 * `@Inject`: иначе Nest построит его без аргументов, `reflector` окажется
 * `undefined`, и первый же запрос с `@AuthRoles` вместо отказа вернёт 500
 * («Cannot read properties of undefined (reading 'get')»).
 *
 * Тест проверяет ровно это: контейнер обязан отдать гард с готовым Reflector,
 * а гард без объявленных ролей — пропустить запрос, а не упасть.
 */
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@coopenomics/extension-kit';

describe('RolesGuard: зависимость приходит через DI (пакет без emitDecoratorMetadata)', () => {
  it('контейнер инстанцирует гард с Reflector, а не с undefined', async () => {
    const moduleRef = await Test.createTestingModule({ providers: [RolesGuard] }).compile();

    const guard = moduleRef.get(RolesGuard);

    expect((guard as any).reflector).toBeInstanceOf(Reflector);
  });

  it('роли не объявлены — доступ открыт (обращение к reflector не роняет запрос)', async () => {
    const moduleRef = await Test.createTestingModule({ providers: [RolesGuard] }).compile();
    const guard = moduleRef.get(RolesGuard);

    // Контекст GraphQL-запроса без метаданных ролей: гард обязан вернуть true.
    const handler = function unprotectedResolver() {};
    const context: any = {
      getHandler: () => handler,
      getClass: () => class {},
      getType: () => 'graphql',
      getArgs: () => [undefined, {}, { req: { headers: {}, user: { username: 'ant' } } }, {}],
      getArgByIndex: (i: number) => context.getArgs()[i],
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    };

    expect(guard.canActivate(context)).toBe(true);
  });
});
