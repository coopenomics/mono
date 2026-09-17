/**
 * Самообход `RolesGuard`: пайщик без нужной роли проходит, когда `username` в
 * аргументах — он сам. Для полномочий совета, где `username` — адресат действия,
 * это отключается `AuthRoles(..., { allowSelf: false })`: иначе пайщик
 * подтверждал бы своё соглашение или импортировал себе вклад сам.
 *
 * Роль `user` в списке ролей — принятый пайщик: учётная запись в статусе
 * вступления или исключения по ней не проходит, кроме операций с
 * `anyStatus: true`.
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

  @AuthRoles([])
  selfOnly(): void {
    return undefined;
  }

  @AuthRoles(['chairman', 'member', 'user'])
  participantsRead(): void {
    return undefined;
  }

  @AuthRoles(['chairman', 'member', 'user'], { anyStatus: true })
  inboxRead(): void {
    return undefined;
  }
}

function contextFor(handler: (...args: any[]) => unknown, args: Record<string, unknown>, user: { username: string; role: string; status?: string }): any {
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

  it('пустой список ролей — действие только от своего имени, даже для председателя', () => {
    expect(guard.canActivate(contextFor(Resolver.prototype.selfOnly, { data: { username: 'bob' } }, participant))).toBe(true);
    expect(() => guard.canActivate(contextFor(Resolver.prototype.selfOnly, { data: { username: 'bob' } }, chairman))).toThrow(
      'Недостаточно прав доступа',
    );
  });

  it('allowSelf: false — роль по-прежнему открывает доступ, в том числе к себе', () => {
    const ctx = contextFor(Resolver.prototype.councilAction, { data: { username: 'ant' } }, chairman);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  describe('роль user — только принятый пайщик', () => {
    const active = { username: 'bob', role: 'user', status: 'active' };
    const candidate = { username: 'eve', role: 'user', status: 'created' };
    const excluded = { username: 'kim', role: 'user', status: 'refunded' };

    it('принятый пайщик проходит по роли', () => {
      expect(guard.canActivate(contextFor(Resolver.prototype.participantsRead, {}, active))).toBe(true);
    });

    it('кандидат и исключённый по роли не проходят', () => {
      for (const user of [candidate, excluded]) {
        expect(() => guard.canActivate(contextFor(Resolver.prototype.participantsRead, {}, user))).toThrow(
          'Доступ только для пайщиков кооператива',
        );
      }
    });

    it('кандидат по-прежнему действует за себя через самообход', () => {
      expect(guard.canActivate(contextFor(Resolver.prototype.participantsRead, { data: { username: 'eve' } }, candidate))).toBe(true);
    });

    it('anyStatus: true — кандидат проходит по роли', () => {
      expect(guard.canActivate(contextFor(Resolver.prototype.inboxRead, {}, candidate))).toBe(true);
    });

    it('совет проходит по роли в любом статусе', () => {
      expect(guard.canActivate(contextFor(Resolver.prototype.participantsRead, {}, { username: 'ant', role: 'member', status: 'registered' }))).toBe(true);
    });
  });
});
