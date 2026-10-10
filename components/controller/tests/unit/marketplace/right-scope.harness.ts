/**
 * Обвязка тестов сверки охвата прав Стола заказов (C28-87).
 *
 * Гард собирается настоящий: общий `RightsGuard` каркаса расширений над
 * описанием прав Стола заказов — таблица, условия, справочник объектов. Подставные здесь только хранилища и
 * состав участков. Требование операции читается из исходника резолвера —
 * тест проверяет то, что объявлено в коде, а не свою копию.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Reflector } from '@nestjs/core';
import {
  configureExtensionAuth,
  GRANTED_SCOPE_KEY,
  platformSettings,
  RIGHT_METADATA_KEY,
  RightsGuard,
  SELF,
  type IGrantedScope,
  type IRightRequirement,
  type RightSource,
} from '@coopenomics/extension-kit';
import { MarketplaceRightSubjects } from '~/extensions/marketplace/application/access/marketplace-right-subjects.service';
import { MarketplaceRightsService } from '~/extensions/marketplace/application/access/marketplace-rights.service';
import { MarketplaceOnboardingSource } from '~/extensions/marketplace/application/dto/marketplace-onboarding-state.dto';

configureExtensionAuth({ serverSecret: 'svc-secret' });

const RESOLVERS = join(__dirname, '../../../src/extensions/marketplace/application/resolvers');

/** Источник в коде — константа SELF либо литерал объекта с одинарными кавычками. */
function sourceOf(text: string | undefined): RightSource | undefined {
  const literal = text?.trim();
  if (!literal) return undefined;
  if (literal === 'SELF') return SELF;
  return JSON.parse(literal.replace(/(\w+):/g, '"$1":').replace(/'/g, '"')) as RightSource;
}

/** Требование права вместе с источником объекта, объявленное у операции. */
export function requirementOf(file: string, operation: string): IRightRequirement {
  const src = readFileSync(join(RESOLVERS, file), 'utf8');
  const from = src.indexOf(`name: '${operation}'`);
  const found =
    from < 0 ? null : /@RequireRight\('([A-Za-z]+)',\s*(\[[^\]]*\]|'[^']*')\s*(?:,\s*([^)]*))?\)/.exec(src.slice(from));
  if (!found) throw new Error(`требование права операции ${operation} не найдено в ${file}`);
  const actions = [...found[2].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return { resource: found[1], action: found[2].startsWith('[') ? actions : actions[0], source: sourceOf(found[3]) };
}

export interface ScopeMember {
  username: string;
  core_roles: string[];
  marketplace_roles: string[];
}

export const memberOf = (username: string, ...marketplace_roles: string[]): ScopeMember => ({
  username,
  core_roles: ['User'],
  marketplace_roles,
});

/** Мир теста: участки, объекты по видам справочника и состояние кооператива. */
export interface ScopeWorld {
  /** участок → председатель и доверенные */
  branches?: Record<string, { trustee: string; trusted?: string[] }>;
  /** вид объекта → номер → поля объекта (кооператив подставляется сам) */
  objects?: Record<string, Record<string, Record<string, unknown>>>;
  accepted?: boolean;
  onboarded?: boolean;
  containers?: boolean;
  cells?: boolean;
}

export function makeScopeGuard(world: ScopeWorld = {}) {
  const coopname = platformSettings().coopname;
  const { accepted = true, onboarded = true, containers = true, cells = true } = world;
  const branches = world.branches ?? {};
  const objects = world.objects ?? {};

  const repo = (kind: string) => ({
    findById: jest.fn(async (id: string) => {
      const found = objects[kind]?.[id];
      return found ? { coopname, id, ...found } : null;
    }),
  });
  const repos = {
    Order: repo('Order'),
    Offer: repo('Offer'),
    Cycle: repo('Cycle'),
    Shipment: repo('Shipment'),
    Reception: repo('Reception'),
    Inventory: repo('Inventory'),
    Container: {
      ...repo('Container'),
      findByCode: jest.fn(async (_coopname: string, code: string) => {
        const found = objects.ContainerCode?.[code];
        return found ? { coopname, ...found } : null;
      }),
    },
    StorageCell: repo('StorageCell'),
    ReturnClaim: repo('ReturnClaim'),
    SupplierClaim: repo('SupplierClaim'),
    StockProposal: repo('StockProposal'),
    IssuanceSaga: {
      findActiveByOrderId: jest.fn(async (_coopname: string, order_id: string) => {
        const found = objects.IssuanceSaga?.[order_id];
        return found ? { coopname, ...found } : null;
      }),
      findByOrderHash: jest.fn().mockResolvedValue(null),
    },
    WriteoffProposal: repo('WriteoffProposal'),
    Review: repo('Review'),
  };
  const subjects = new MarketplaceRightSubjects(
    repos.Order as any,
    repos.Offer as any,
    repos.Cycle as any,
    repos.Shipment as any,
    repos.Reception as any,
    repos.Inventory as any,
    repos.Container as any,
    repos.StorageCell as any,
    repos.ReturnClaim as any,
    repos.SupplierClaim as any,
    repos.StockProposal as any,
    repos.IssuanceSaga as any,
    repos.WriteoffProposal as any,
    repos.Review as any
  );

  const kuChairmanService = {
    listBranamesForMember: jest.fn(async (_coopname: string, username: string) =>
      Object.entries(branches)
        .filter(([, branch]) => branch.trustee === username || (branch.trusted ?? []).includes(username))
        .map(([braname]) => braname)
    ),
    listChairedBranames: jest.fn(async (_coopname: string, username: string) =>
      Object.entries(branches)
        .filter(([, branch]) => branch.trustee === username)
        .map(([braname]) => braname)
    ),
  };

  const config = {
    get: jest.fn().mockResolvedValue({
      coopAcceptance: { accepted },
      warehouse: { containers_enabled: containers, cells_enabled: cells },
    }),
  };
  const onboarding = {
    getOnboardingState: jest.fn().mockResolvedValue({
      requires_gate: !onboarded,
      source: onboarded ? MarketplaceOnboardingSource.AGREEMENT_SIGNED : MarketplaceOnboardingSource.GATE_REQUIRED,
    }),
  };
  const cart = { findByOrderer: jest.fn().mockResolvedValue(onboarded ? { delivery_braname: 'krg' } : null) };
  const supplierRegistry = { isOfferer: jest.fn().mockResolvedValue(false) };
  const grantsRegistry = { register: jest.fn() };
  const rights = new MarketplaceRightsService(
    config as any,
    onboarding as any,
    cart as any,
    supplierRegistry as any,
    kuChairmanService as any,
    subjects,
    grantsRegistry as any
  );

  /** Итог гарда для операции: охват, по которому она выполняется. Отказ — исключение. */
  async function granted(
    requirement: IRightRequirement | undefined,
    member: ScopeMember,
    args: Record<string, unknown> = {},
    headers: Record<string, string> = {}
  ): Promise<IGrantedScope> {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => (key === RIGHT_METADATA_KEY ? requirement : undefined)),
    } as unknown as Reflector;
    const guard = new RightsGuard(reflector, rights);
    // Вход пайщика и его роли к этому моменту поставили гард входа и гард членства.
    const request: Record<string, unknown> = {
      headers,
      user: { username: member.username, role: 'user', status: 'active' },
      currentMember: member,
    };
    const gqlCtx = { req: request, currentMember: member };
    const slots = [undefined, args, gqlCtx, undefined];
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
    await guard.canActivate(context as any);
    return request[GRANTED_SCOPE_KEY] as IGrantedScope;
  }

  return { granted, repos, kuChairmanService, rights, onboarding, config };
}
