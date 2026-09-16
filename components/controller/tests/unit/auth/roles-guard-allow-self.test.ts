/**
 * Самообход `RolesGuard`: пайщик без нужной роли проходит, когда `username` в
 * аргументах — он сам. Для полномочий совета, где `username` — адресат действия,
 * это отключается `AuthRoles(..., { allowSelf: false })`: иначе пайщик
 * подтверждал бы своё соглашение или импортировал себе вклад сам.
 */
import { Reflector } from '@nestjs/core';
import { AuthRoles, RolesGuard } from '@coopenomics/extension-kit';

class Resolver {
  @AuthRoles(['chairman'])
  ownRead(): void {
    return undefined;
  }

  @AuthRoles(['chairman'], { allowSelf: false })
  councilAction(): void {
    return undefined;
  }
}

function contextFor(handler: (...args: any[]) => unknown, args: Record<string, unknown>, user: { username: string; role: string }): any {
  const context: any = {
    getHandler: () => handler,
    getClass: () => Resolver,
    getType: () => 'graphql',
    getArgs: () => [undefined, args, { req: { headers: {}, user } }, {}],
    getArgByIndex: (i: number) => context.getArgs()[i],
  };
  return context;
}

describe('RolesGuard: самообход по username', () => {
  const guard = new RolesGuard(new Reflector());
  const participant = { username: 'bob', role: 'user' };
  const chairman = { username: 'ant', role: 'chairman' };

  it('по умолчанию пайщик проходит к своим данным без роли', () => {
    const ctx = contextFor(Resolver.prototype.ownRead, { data: { username: 'bob' } }, participant);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allowSelf: false — пайщик не выполняет полномочие совета над собой', () => {
    for (const args of [{ data: { username: 'bob' } }, { filter: { username: 'bob' } }, { username: 'bob' }]) {
      const ctx = contextFor(Resolver.prototype.councilAction, args, participant);
      expect(() => guard.canActivate(ctx)).toThrow('Недостаточно прав доступа');
    }
  });

  it('allowSelf: false — роль по-прежнему открывает доступ, в том числе к себе', () => {
    const ctx = contextFor(Resolver.prototype.councilAction, { data: { username: 'ant' } }, chairman);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
