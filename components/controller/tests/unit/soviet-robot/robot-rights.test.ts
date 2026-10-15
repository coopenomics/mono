/**
 * Права стола «Робот совета» по таблице прав (C28-87, случаи robot.rights.* в
 * test-registry/soviet.robot.yaml).
 *
 * Операции стола стоят под общим гардом каркаса расширений (`RightsGuard`) над
 * описанием прав стола (`RobotRights`); из того же описания выдаются права
 * страниц рабочего стола. Требование каждой операции тест читает из исходника
 * резолвера.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Reflector } from '@nestjs/core';
import {
  configureExtensionAuth,
  desktopGrantsOf,
  RIGHT_METADATA_KEY,
  RightsGuard,
  SELF,
  type IRightRequirement,
} from '@coopenomics/extension-kit';
import { RobotRights, robotRightsTable, robotRolesOf } from '~/extensions/soviet-robot/application/access/robot-rights';

configureExtensionAuth({ serverSecret: 'svc-secret' });

const RESOLVER = join(__dirname, '../../../src/extensions/soviet-robot/application/resolvers/soviet-robot.resolver.ts');

/** Требование права, объявленное у операции в исходнике резолвера. */
function requirementOf(operation: string): IRightRequirement {
  const src = readFileSync(RESOLVER, 'utf8');
  const from = src.indexOf(`name: '${operation}'`);
  const found = from < 0 ? null : /@RequireRight\('([A-Za-z]+)',\s*'([^']*)'\s*(?:,\s*(SELF))?\)/.exec(src.slice(from));
  if (!found) throw new Error(`требование права операции ${operation} не найдено`);
  return { resource: found[1], action: found[2], source: found[3] ? SELF : undefined };
}

function makeGuard() {
  const registry = { register: jest.fn() };
  const rights = new RobotRights(registry as any);
  /** Проход гарда для пайщика с ролью узла `role`; отказ — исключение. */
  async function pass(operation: string, role: string | null, status = 'active'): Promise<boolean> {
    const requirement = requirementOf(operation);
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === RIGHT_METADATA_KEY ? requirement : undefined)),
    } as unknown as Reflector;
    const guard = new RightsGuard(reflector, rights);
    const request = { headers: {}, user: role === null ? undefined : { username: 'ivan', role, status } };
    const slots = [undefined, {}, { req: request }, undefined];
    const context = {
      getType: () => 'graphql',
      getHandler: () => ({ name: 'handler' }),
      getClass: () => ({ name: 'SovietRobotResolver' }),
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

const COUNCIL_OPS = [
  'sovietRobotRegistry',
  'sovietRobotCouncil',
  'sovietRobotJournal',
  'sovietRobotKeyStatus',
  'sovietRobotDelegateKey',
  'sovietRobotRevokeKey',
];
const CHAIRMAN_OPS = ['sovietRobotKeys', 'sovietRobotRetryDecision'];
const NO_RIGHT = { code: 'KIT_INSUFFICIENT_RIGHTS' };

describe('роли стола по роли узла', () => {
  it('председатель — член совета и председатель, член совета — член совета, пайщик — никто', () => {
    expect(robotRolesOf('chairman')).toEqual(['council', 'chairman']);
    expect(robotRolesOf('member')).toEqual(['council']);
    expect(robotRolesOf('user')).toEqual([]);
    expect(robotRolesOf(undefined)).toEqual([]);
  });
});

describe('операции стола под общим гардом', () => {
  // robot.rights.happy.01
  it.each(COUNCIL_OPS)('%s: член совета и председатель проходят', async (operation) => {
    const { pass } = makeGuard();
    await expect(pass(operation, 'member')).resolves.toBe(true);
    await expect(pass(operation, 'chairman')).resolves.toBe(true);
  });

  // robot.rights.side.01
  it.each([...COUNCIL_OPS, ...CHAIRMAN_OPS])('%s: рядовой пайщик получает отказ', async (operation) => {
    const { pass } = makeGuard();
    await expect(pass(operation, 'user')).rejects.toMatchObject(NO_RIGHT);
  });

  // robot.rights.side.02
  it.each(CHAIRMAN_OPS)('%s: председатель проходит, член совета получает отказ', async (operation) => {
    const { pass } = makeGuard();
    await expect(pass(operation, 'chairman')).resolves.toBe(true);
    await expect(pass(operation, 'member')).rejects.toMatchObject(NO_RIGHT);
  });

  // robot.rights.side.03
  it('совет проходит по роли в любом статусе учётной записи', async () => {
    const { pass } = makeGuard();
    await expect(pass('sovietRobotRegistry', 'member', 'registered')).resolves.toBe(true);
    await expect(pass('sovietRobotKeys', 'chairman', 'registered')).resolves.toBe(true);
  });

  // robot.rights.side.04
  it('вызов без входа получает отказ входа', async () => {
    const { pass } = makeGuard();
    await expect(pass('sovietRobotRegistry', null)).rejects.toMatchObject({ code: 'KIT_USER_NOT_AUTHORIZED' });
  });

  it('у каждой операции резолвера объявлено право из таблицы', () => {
    const src = readFileSync(RESOLVER, 'utf8');
    const operations = [...src.matchAll(/^[ \t]*@(?:Query|Mutation)\(/gm)].length;
    const requirements = [...src.matchAll(/^[ \t]*@RequireRight\('([A-Za-z]+)',\s*'([^']*)'/gm)];
    expect(operations).toBe(COUNCIL_OPS.length + CHAIRMAN_OPS.length);
    expect(requirements.length).toBe(operations);
    const declared = new Set(
      Object.values(robotRightsTable).flatMap((groups) =>
        groups.flatMap((group) => Object.entries(group.rights).flatMap(([resource, actions]) => actions.map((a) => `${resource}:${a}`)))
      )
    );
    for (const [, resource, action] of requirements) expect(declared).toContain(`${resource}:${action}`);
    expect(src).not.toContain('@AuthRoles');
  });
});

describe('права страниц рабочего стола из того же описания', () => {
  const grantsFor = async (userRole: string | undefined, userStatus = 'active') => {
    const { rights } = makeGuard();
    return (await desktopGrantsOf(rights).resolveGrants({ coopname: 'voskhod', username: 'ivan', userRole, userStatus })).sort();
  };

  // robot.rights.happy.02
  it('член совета: реестр и журнал, свой голос и свой ключ', async () => {
    expect(await grantsFor('member')).toEqual(['Robot:delegate', 'Robot:read', 'RobotKey:manage:own', 'RobotKey:read:own']);
  });

  // robot.rights.happy.03
  it('председатель: дополнительно подпись протоколов, ключи совета и повтор решений', async () => {
    const grants = await grantsFor('chairman');
    for (const grant of ['Robot:read', 'Robot:delegate', 'Robot:authorize', 'RobotKey:read:all', 'RobotDecision:retry']) {
      expect(grants).toContain(grant);
    }
  });

  // robot.rights.side.05
  it('рядовой пайщик и гость прав не получают — стола не видят', async () => {
    expect(await grantsFor('user')).toEqual([]);
    const { rights } = makeGuard();
    expect(await desktopGrantsOf(rights).resolveGrants({ coopname: 'voskhod' })).toEqual([]);
  });

  // robot.rights.side.03
  it('совет получает права стола в любом статусе учётной записи', async () => {
    expect(await grantsFor('member', 'registered')).toContain('Robot:read');
  });

  it('описание прав регистрирует провайдер прав стола под именем расширения', () => {
    const { rights, registry } = makeGuard();
    rights.onModuleInit();
    expect(registry.register).toHaveBeenCalledWith(expect.objectContaining({ extensionName: 'robot' }));
  });
});
