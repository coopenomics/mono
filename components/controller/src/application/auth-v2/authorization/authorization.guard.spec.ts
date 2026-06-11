import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import config from '~/config/config';
import { AuthorizationGuard } from './authorization.guard';
import { PolicyService } from './policy.service';
import type { CheckAbilityRequirement } from './check-ability.decorator';

function makeGuard(requirement: CheckAbilityRequirement | undefined): {
  guard: AuthorizationGuard;
  ensure: jest.Mock;
} {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requirement) } as unknown as Reflector;
  const ensure = jest.fn().mockResolvedValue(undefined);
  const guard = new AuthorizationGuard(reflector, { ensure } as unknown as PolicyService);
  return { guard, ensure };
}

/** Фейковый GraphQL ExecutionContext: getArgs() отдаёт [root, args, ctx, info]. */
function gqlContext(args: Record<string, unknown>, reqObj: unknown): ExecutionContext {
  const gqlArgs = [{}, args, { req: reqObj }, {}];
  return {
    getType: () => 'graphql',
    getHandler: () => () => undefined,
    getClass: () => class {},
    getArgs: () => gqlArgs,
    getArgByIndex: (i: number) => gqlArgs[i],
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

function httpContext(reqObj: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => reqObj }),
  } as unknown as ExecutionContext;
}

describe('AuthorizationGuard — единый guard 4 слоёв (Story 6.4)', () => {
  it('нет @CheckAbility → пропускает (не наш endpoint)', async () => {
    const { guard, ensure } = makeGuard(undefined);
    await expect(guard.canActivate(gqlContext({}, { user: {} }))).resolves.toBe(true);
    expect(ensure).not.toHaveBeenCalled();
  });

  it('server-secret → служебный обход без проверки', async () => {
    const { guard, ensure } = makeGuard({ action: 'update', subject: 'Participant' });
    const ctx = gqlContext({}, { user: { username: 'x', role: 'user' }, headers: { 'server-secret': config.server_secret } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ensure).not.toHaveBeenCalled();
  });

  it('GraphQL: извлекает user + args.data и делегирует PolicyService.ensure', async () => {
    const { guard, ensure } = makeGuard({ action: 'update', subject: 'Participant' });
    const user = { username: 'chief', role: 'chairman' };
    await guard.canActivate(gqlContext({ data: { id: 'p1' } }, { user, headers: {} }));
    expect(ensure).toHaveBeenCalledWith({ action: 'update', subject: 'Participant' }, user, { id: 'p1' });
  });

  it('HTTP REST: извлекает user + params/query/body и делегирует ensure', async () => {
    const { guard, ensure } = makeGuard({ action: 'read', subject: 'Certificate' });
    const user = { username: 'ant', role: 'user' };
    const ctx = httpContext({ user, headers: {}, params: { id: 'c1' }, query: {}, body: { owner: 'ant' } });
    await guard.canActivate(ctx);
    expect(ensure).toHaveBeenCalledWith({ action: 'read', subject: 'Certificate' }, user, { id: 'c1', owner: 'ant' });
  });

  it('отказ PolicyService пробрасывается (canActivate отклоняется)', async () => {
    const { guard, ensure } = makeGuard({ action: 'manage', subject: 'CoopSettings' });
    ensure.mockRejectedValueOnce(new Error('forbidden'));
    await expect(guard.canActivate(gqlContext({}, { user: { username: 'ant', role: 'user' }, headers: {} }))).rejects.toThrow();
  });
});
