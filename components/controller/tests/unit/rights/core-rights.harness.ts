/**
 * Стенд для тестов прав ядра: требование операции читается из исходника
 * резолвера и прогоняется через общий гард (`RightsGuard`) над описанием прав
 * ядра (`CoreRights`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Reflector } from '@nestjs/core';
import {
  configureExtensionAuth,
  RIGHT_METADATA_KEY,
  RightsGuard,
  SELF,
  type AppRights,
  type IRightRequirement,
  type RightSource,
} from '@coopenomics/extension-kit';
import { CoreRights } from '~/application/rights/core-rights';

configureExtensionAuth({ serverSecret: 'svc-secret' });

export const APPLICATION = join(__dirname, '../../../src/application');

/** Источник в коде — `SELF`, литерал объекта или список литералов с одинарными кавычками. */
function sourceOf(text: string | undefined): RightSource | RightSource[] | undefined {
  const literal = text?.trim();
  if (!literal) return undefined;
  if (literal === 'SELF') return SELF;
  return JSON.parse(literal.replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
}

const REQUIREMENT = /@RequireRight\('([A-Za-z0-9]+)',\s*(\[[^\]]*\]|'[^']*')\s*(?:,\s*(.*))?\)\n/;

/**
 * Требование права, объявленное у операции в исходнике резолвера. Операция
 * называется именем GraphQL (`name: '…'`) либо именем метода.
 */
export function requirementOf(file: string, operation: string): IRightRequirement {
  return requirementAt(join(APPLICATION, file), operation);
}

/** То же по полному пути исходника — для резолверов расширений. */
export function requirementAt(path: string, operation: string): IRightRequirement {
  const file = path;
  const src = readFileSync(path, 'utf8');
  const named = src.indexOf(`name: '${operation}'`);
  const method = src.search(new RegExp(`^  async ${operation}\\(`, 'm'));
  const from = named >= 0 ? named : method < 0 ? -1 : src.lastIndexOf('@RequireRight(', method);
  const found = from < 0 ? null : REQUIREMENT.exec(src.slice(from));
  if (!found) throw new Error(`требование права операции ${operation} не найдено в ${file}`);
  const actions = [...found[2].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return { resource: found[1], action: found[2].startsWith('[') ? actions : actions[0], source: sourceOf(found[3]) };
}

export type Caller = { username: string; role: string; status: string };
export const participant: Caller = { username: 'ivan', role: 'user', status: 'active' };
export const candidate: Caller = { username: 'cand', role: 'user', status: 'registered' };
export const councilMember: Caller = { username: 'petr', role: 'member', status: 'active' };
export const chairman: Caller = { username: 'ant', role: 'chairman', status: 'active' };

export const NO_RIGHT = { code: 'KIT_INSUFFICIENT_RIGHTS' };
export const OWN = { code: 'KIT_RIGHT_SCOPE_OWN' };

export interface CoreStand {
  meets?: Record<string, { presider: string; secretary: string }>;
  /** Платежи: номер → плательщик. */
  payments?: Record<string, string>;
  /** Файлы платежей: номер файла → номер платежа. */
  files?: Record<number, string>;
}

export function makeGuard(stand: CoreStand = {}) {
  const registry = { register: jest.fn() };
  const meetRepo = { findByHash: jest.fn(async (hash: string) => stand.meets?.[hash] ?? null) };
  const paymentRepo = {
    findByHash: jest.fn(async (hash: string) => (stand.payments?.[hash] ? { username: stand.payments[hash] } : null)),
  };
  const fileRepo = {
    findById: jest.fn(async (id: number) => (stand.files?.[id] ? { payment_hash: stand.files[id] } : null)),
  };
  const rights = new CoreRights(registry as any, meetRepo as any, paymentRepo as any, fileRepo as any);
  return { pass: guardOver(rights), rights, registry, meetRepo };
}

/** Проход общего гарда над описанием прав `rights`; отказ — исключение. */
export function guardOver(rights: AppRights<any, any>) {
  return async function pass(requirement: IRightRequirement, caller: Caller | null, args: Record<string, unknown> = {}): Promise<boolean> {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === RIGHT_METADATA_KEY ? requirement : undefined)),
    } as unknown as Reflector;
    const guard = new RightsGuard(reflector, rights);
    const request = { headers: {}, user: caller ?? undefined };
    const slots = [undefined, args, { req: request }, undefined];
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
  };
}
