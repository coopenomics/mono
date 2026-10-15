/**
 * Право на генерацию заявления об аннулировании соглашений ЦПП (выход из
 * кооператива). Мутация объявлена правом `MembershipExit:generate` из матрицы:
 * за себя заявление формирует сам пайщик, за другого — совет. Проверяется вся
 * цепочка — объявление на резолвере, гард, вычислитель и матрица.
 */
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { MembershipExitResolver } from '~/application/membership-exit/resolvers/membership-exit.resolver';
import { AuthorizationGuard } from '~/application/auth-v2/authorization/authorization.guard';
import { CHECK_ABILITY } from '~/application/auth-v2/authorization/check-ability.decorator';
import { AbilityFactory } from '~/application/auth-v2/authorization/ability.factory';
import { PolicyService } from '~/application/auth-v2/authorization/policy.service';
import { PolicyRegistry } from '~/application/auth-v2/authorization/policy.registry';

const handler = MembershipExitResolver.prototype.generateProgramAgreementsAnnulment;

/** Запрос мутации от `user` о выходе пайщика `username`. */
function request(user: unknown, username: string): ExecutionContext {
  const gqlArgs = [{}, { data: { coopname: 'voskhod', username } }, { req: { user, headers: {} } }, {}];
  return {
    getType: () => 'graphql',
    getHandler: () => handler,
    getClass: () => MembershipExitResolver,
    getArgs: () => gqlArgs,
    getArgByIndex: (i: number) => gqlArgs[i],
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

function makeGuard(): AuthorizationGuard {
  const noRules = { findForPrincipal: async () => [], findForCapabilitySets: async () => [] } as any;
  const noSets = { listActiveSetKeys: async () => [] } as any;
  const policies = { evaluate: jest.fn() } as unknown as PolicyRegistry;
  return new AuthorizationGuard(new Reflector(), new PolicyService(new AbilityFactory(noRules, noSets), policies));
}

describe('генерация заявления об аннулировании соглашений ЦПП — право из матрицы', () => {
  it('мутация объявлена правом MembershipExit:generate и гардом матрицы, а не ролью', () => {
    expect(Reflect.getMetadata(CHECK_ABILITY, handler)).toEqual({ action: 'generate', subject: 'MembershipExit', policy: undefined });
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(AuthorizationGuard);
    expect(Reflect.getMetadata('roles', handler)).toBeUndefined();
  });

  it('пайщик формирует заявление за себя', async () => {
    await expect(makeGuard().canActivate(request({ username: 'alice', role: 'user' }, 'alice'))).resolves.toBe(true);
  });

  it('пайщик за другого пайщика заявление не формирует', async () => {
    await expect(makeGuard().canActivate(request({ username: 'alice', role: 'user' }, 'bob'))).rejects.toMatchObject({ status: 403 });
  });

  it('член совета и председатель формируют заявление за любого пайщика', async () => {
    for (const role of ['member', 'chairman']) {
      await expect(makeGuard().canActivate(request({ username: 'council', role }, 'bob'))).resolves.toBe(true);
    }
  });

  it('без пайщика в запросе и с не кооперативной ролью — отказ', async () => {
    await expect(makeGuard().canActivate(request(undefined, 'bob'))).rejects.toMatchObject({ status: 403 });
    await expect(makeGuard().canActivate(request({ username: 'bob', role: 'admin' }, 'bob'))).rejects.toMatchObject({ status: 403 });
  });
});
