/**
 * Права стола председателя по таблице прав (C28-87, случаи chair.rights.* в
 * test-registry/chairman.approvals.yaml).
 *
 * Операции одобрений и шагов подключения стоят под общим гардом каркаса
 * расширений (`RightsGuard`) над описанием прав стола (`ChairmanRights`); из
 * того же описания выдаются права страниц рабочего стола.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Reflector } from '@nestjs/core';
import { configureExtensionAuth, desktopGrantsOf, RIGHT_METADATA_KEY, RightsGuard, type IRightRequirement } from '@coopenomics/extension-kit';
import { ChairmanRights } from '~/extensions/chairman/application/access/chairman-rights';

configureExtensionAuth({ serverSecret: 'svc-secret' });

const RESOLVERS = join(__dirname, '../../../src/extensions/chairman/application/resolvers');

/** Требование права, объявленное у операции в исходнике резолвера. */
function requirementOf(file: string, operation: string): IRightRequirement {
  const src = readFileSync(join(RESOLVERS, file), 'utf8');
  const from = src.indexOf(`name: '${operation}'`);
  const found = from < 0 ? null : /@RequireRight\('([A-Za-z]+)',\s*'([^']*)'\)/.exec(src.slice(from));
  if (!found) throw new Error(`требование права операции ${operation} не найдено`);
  return { resource: found[1], action: found[2] };
}

function makeGuard() {
  const registry = { register: jest.fn() };
  const rights = new ChairmanRights(registry as any);
  /** Проход гарда для пайщика с ролью узла `role`; отказ — исключение. */
  async function pass(requirement: IRightRequirement, role: string, status = 'active'): Promise<boolean> {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === RIGHT_METADATA_KEY ? requirement : undefined)),
    } as unknown as Reflector;
    const guard = new RightsGuard(reflector, rights);
    const request = { headers: {}, user: { username: 'ivan', role, status } };
    const slots = [undefined, {}, { req: request }, undefined];
    const context = {
      getType: () => 'graphql',
      getHandler: () => ({ name: 'handler' }),
      getClass: () => ({ name: 'Resolver' }),
      getArgs: () => slots,
      getArgByIndex: (i: number) => slots[i],
      switchToHttp: () => ({ getRequest: () => request }),
      switchToRpc: () => undefined,
      switchToWs: () => undefined,
    };
    return guard.canActivate(context as any);
  }
  return { pass, rights, registry };
}

const NO_RIGHT = { code: 'KIT_INSUFFICIENT_RIGHTS' };
const READS = ['chairmanApprovals', 'chairmanApproval'];
const DECISIONS = ['chairmanConfirmApprove', 'chairmanDeclineApprove'];
const ONBOARDING = ['getChairmanOnboardingState', 'completeChairmanAgendaStep', 'completeChairmanGeneralMeetStep'];

describe('операции стола председателя под общим гардом', () => {
  // chair.rights.happy.01
  it.each(READS)('%s: одобрения читают член совета и председатель; пайщику отказ', async (operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf('approval.resolver.ts', operation);
    await expect(pass(requirement, 'member')).resolves.toBe(true);
    await expect(pass(requirement, 'chairman', 'registered')).resolves.toBe(true);
    await expect(pass(requirement, 'user')).rejects.toMatchObject(NO_RIGHT);
  });

  // chair.rights.side.01
  it.each(DECISIONS)('%s: решение по одобрению принимает председатель; члену совета отказ', async (operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf('approval.resolver.ts', operation);
    await expect(pass(requirement, 'chairman')).resolves.toBe(true);
    await expect(pass(requirement, 'member')).rejects.toMatchObject(NO_RIGHT);
  });

  // chair.rights.side.02
  it.each(ONBOARDING)('%s: шаги подключения кооператива ведёт председатель', async (operation) => {
    const { pass } = makeGuard();
    const requirement = requirementOf('onboarding.resolver.ts', operation);
    await expect(pass(requirement, 'chairman')).resolves.toBe(true);
    await expect(pass(requirement, 'member')).rejects.toMatchObject(NO_RIGHT);
    await expect(pass(requirement, 'user')).rejects.toMatchObject(NO_RIGHT);
  });

  it('под ролями в резолверах расширения не осталось ни одной операции', () => {
    for (const file of ['approval.resolver.ts', 'onboarding.resolver.ts']) {
      expect(readFileSync(join(RESOLVERS, file), 'utf8')).not.toContain('@AuthRoles');
    }
  });
});

describe('права страниц стола председателя из того же описания', () => {
  const grantsFor = async (userRole: string) => {
    const { rights } = makeGuard();
    return (await desktopGrantsOf(rights).resolveGrants({ coopname: 'voskhod', username: 'ivan', userRole, userStatus: 'active' })).sort();
  };

  // chair.rights.happy.02
  it('председатель получает одобрения и шаги подключения, член совета — чтение одобрений, пайщик — ничего', async () => {
    expect(await grantsFor('chairman')).toEqual(['Approval:confirm', 'Approval:read', 'ChairmanOnboarding:manage']);
    expect(await grantsFor('member')).toEqual(['Approval:read']);
    expect(await grantsFor('user')).toEqual([]);
  });

  it('описание прав кладёт своего поставщика под именем стола председателя', () => {
    const { rights, registry } = makeGuard();
    rights.onModuleInit();
    expect(registry.register).toHaveBeenCalledWith(expect.objectContaining({ extensionName: 'chairman' }));
  });
});
