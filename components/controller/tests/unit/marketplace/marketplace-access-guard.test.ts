/**
 * Unit-тесты MarketplaceRoleGuard: право операции `@RequireRight(resource, action)`
 * сверяется с таблицей прав Стола заказов вместе с условием строки (C28-87).
 *
 * Сценарии:
 *   (a) право роли положено и условие выполнено → проход;
 *   (b) право роли не положено → ForbiddenException + запись в журнал;
 *   (c) право положено, условие ждёт выполнения → отказ с кодом условия;
 *   (d) требование роли и требование права действуют вместе;
 *   (e) server-secret пропускает оба требования.
 */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { configureExtensionAuth, RIGHT_METADATA_KEY } from '@coopenomics/extension-kit';
import { MarketplaceRightsService } from '~/extensions/marketplace/application/access/marketplace-rights.service';
import { MARKETPLACE_ROLES_METADATA_KEY } from '~/extensions/marketplace/application/decorators/marketplace-role.decorator';
import { MarketplaceOnboardingSource } from '~/extensions/marketplace/application/dto/marketplace-onboarding-state.dto';
import { MarketplaceRoleGuard } from '~/extensions/marketplace/application/guards/marketplace-role.guard';

// Секрет межсервисного обхода живёт в каркасе: guard'ы спрашивают его там,
// а не в конфиге ядра. Хост обязан задать его на старте — тест тоже хост.
configureExtensionAuth({ serverSecret: 'svc-secret' });

const makeLogger = () =>
  ({
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as any);

/** Сервис прав над таблицей; состояние кооператива и пайщика задаёт тест. */
function makeRights(state: { accepted?: boolean; onboarded?: boolean; containers?: boolean; cells?: boolean } = {}) {
  const { accepted = true, onboarded = true, containers = false, cells = false } = state;
  const config = {
    get: jest.fn().mockResolvedValue({
      coopAcceptance: { accepted },
      warehouse: { containers_enabled: containers, cells_enabled: cells },
    }),
  } as any;
  const onboarding = {
    getOnboardingState: jest.fn().mockResolvedValue({
      requires_gate: !onboarded,
      source: onboarded ? MarketplaceOnboardingSource.AGREEMENT_SIGNED : MarketplaceOnboardingSource.GATE_REQUIRED,
    }),
  } as any;
  const cart = { findByOrderer: jest.fn().mockResolvedValue(onboarded ? { delivery_braname: 'krg' } : null) } as any;
  return { rights: new MarketplaceRightsService(config, onboarding, cart), onboarding };
}

function makeReflector({ roles, access }: { roles?: string[]; access?: { resource: string; action: string | string[] } }): Reflector {
  return {
    getAllAndOverride: jest.fn().mockImplementation((key: string) => {
      if (key === MARKETPLACE_ROLES_METADATA_KEY) return roles;
      if (key === RIGHT_METADATA_KEY) return access;
      return undefined;
    }),
  } as any;
}

function makeCtx(req: any) {
  const gqlCtx = { req, currentMember: req?.currentMember };
  return {
    getType: () => 'graphql',
    getHandler: () => ({ name: 'handler' }) as any,
    getClass: () => ({ name: 'Resolver' }) as any,
    getArgs: () => [undefined, undefined, gqlCtx, undefined] as any,
    getArgByIndex: (i: number) => [undefined, undefined, gqlCtx, undefined][i],
    switchToHttp: () => ({ getRequest: () => req }) as any,
    switchToRpc: () => undefined as any,
    switchToWs: () => undefined as any,
  };
}

const orderer = { username: 'alice', core_roles: ['User'], marketplace_roles: ['orderer'] };
const operator = { username: 'oleg', core_roles: ['User'], marketplace_roles: ['orderer', 'operator'] };
const chairman = {
  username: 'chair',
  core_roles: ['User', 'Member', 'Chairman'],
  marketplace_roles: ['orderer', 'board_readonly', 'admin'],
};

function run(
  access: { resource: string; action: string | string[] },
  member: typeof orderer,
  state: Parameters<typeof makeRights>[0] = {},
  roles?: string[],
  logger = makeLogger()
) {
  const guard = new MarketplaceRoleGuard(makeReflector({ roles, access }), logger, makeRights(state).rights);
  return guard.canActivate(makeCtx({ headers: {}, currentMember: member }) as any);
}

describe('MarketplaceRoleGuard — право по таблице', () => {
  it('Order:create у подключённого заказчика → проход', async () => {
    await expect(run({ resource: 'Order', action: 'create' }, orderer)).resolves.toBe(true);
  });

  it('KU:manage у заказчика → ForbiddenException и запись в журнал', async () => {
    const logger = makeLogger();
    await expect(run({ resource: 'KU', action: 'manage' }, orderer, {}, undefined, logger)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    const msg = (logger.warn as jest.Mock).mock.calls[0][0] as string;
    expect(msg).toContain('forbidden-attempt');
    expect(msg).toContain('requested_access=KU:manage');
  });

  it('требование роли admin и права Offer:moderate у председателя → проход', async () => {
    await expect(run({ resource: 'Offer', action: 'moderate' }, chairman, {}, ['admin'])).resolves.toBe(true);
  });

  it('роль admin есть, право Inventory:label ему не положено → отказ', async () => {
    await expect(run({ resource: 'Inventory', action: 'label' }, chairman, {}, ['admin'])).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('список действий: достаточно одного из них', async () => {
    await expect(run({ resource: 'Receiving', action: ['cancel:own', 'cancel:own-KU'] }, operator)).resolves.toBe(true);
  });

  it('server-secret пропускает оба требования', () => {
    const guard = new MarketplaceRoleGuard(
      makeReflector({ roles: ['admin'], access: { resource: 'KU', action: 'manage' } }),
      makeLogger(),
      makeRights().rights
    );
    expect(guard.canActivate(makeCtx({ headers: { 'server-secret': 'svc-secret' } }) as any)).toBe(true);
  });

  it('ни одного декоратора → guard разрешает (членство проверяется отдельно)', () => {
    const guard = new MarketplaceRoleGuard(makeReflector({}), makeLogger(), makeRights().rights);
    expect(guard.canActivate(makeCtx({ headers: {} }) as any)).toBe(true);
  });
});

describe('MarketplaceRoleGuard — условия строк таблицы', () => {
  // mkt.rights.side.01
  it('заказчик без оферты и пункта выдачи: корзина и каталог закрыты кодом подключения', async () => {
    for (const access of [
      { resource: 'Cart', action: 'manage:own' },
      { resource: 'Offer', action: 'read' },
      { resource: 'Order', action: 'create' },
    ]) {
      await expect(run(access, orderer, { onboarded: false })).rejects.toMatchObject({
        code: 'MARKETPLACE_ORDERER_ONBOARDING_REQUIRED',
      });
    }
  });

  // mkt.rights.happy.01
  it('заказчик без оферты и пункта выдачи проходит права подключения', async () => {
    for (const access of [
      { resource: 'Onboarding', action: 'read:own' },
      { resource: 'Onboarding', action: 'sign:own' },
      { resource: 'DeliveryPoint', action: 'choose:own' },
      { resource: 'KU', action: 'read' },
      { resource: 'Supplier', action: 'request:own' },
      { resource: 'Membership', action: 'read:own' },
    ]) {
      await expect(run(access, orderer, { onboarded: false })).resolves.toBe(true);
    }
  });

  // mkt.rights.side.02
  it('оператор без подключения заказчика читает каталог по своей роли, корзина закрыта', async () => {
    await expect(run({ resource: 'Offer', action: 'read' }, operator, { onboarded: false })).resolves.toBe(true);
    await expect(run({ resource: 'Cart', action: 'manage:own' }, operator, { onboarded: false })).rejects.toMatchObject({
      code: 'MARKETPLACE_ORDERER_ONBOARDING_REQUIRED',
    });
  });

  // mkt.rights.side.09
  it('член совета без подключения заказчика открывает карточку предложения и витрину, корзина закрыта', async () => {
    const council = { username: 'petr', core_roles: ['User', 'Member'], marketplace_roles: ['orderer', 'board_readonly'] };
    for (const access of [
      { resource: 'Offer', action: 'read' },
      { resource: 'Offer', action: 'read:all' },
      { resource: 'Vitrine', action: 'read' },
      { resource: 'Economy', action: 'read' },
    ]) {
      await expect(run(access, council, { onboarded: false })).resolves.toBe(true);
    }
    await expect(run({ resource: 'Cart', action: 'manage:own' }, council, { onboarded: false })).rejects.toMatchObject({
      code: 'MARKETPLACE_ORDERER_ONBOARDING_REQUIRED',
    });
  });

  // mkt.rights.side.03
  it('до решения совета действует только подключение кооператива', async () => {
    const state = { accepted: false };
    await expect(run({ resource: 'Extension', action: 'configure' }, chairman, state)).resolves.toBe(true);
    await expect(run({ resource: 'Extension', action: 'read' }, orderer, state)).resolves.toBe(true);
    await expect(run({ resource: 'Membership', action: 'read:own' }, orderer, state)).resolves.toBe(true);
    await expect(run({ resource: 'KU', action: 'manage' }, chairman, state)).rejects.toMatchObject({
      code: 'MARKETPLACE_COOP_NOT_CONNECTED',
    });
    await expect(run({ resource: 'Onboarding', action: 'sign:own' }, orderer, state)).rejects.toMatchObject({
      code: 'MARKETPLACE_COOP_NOT_CONNECTED',
    });
  });

  // mkt.rights.side.04
  it('боксы и ячейки отвечают только при включённом хранении', async () => {
    await expect(run({ resource: 'Container', action: 'manage:own-KU' }, operator)).rejects.toMatchObject({
      code: 'MARKETPLACE_CONTAINERS_DISABLED',
    });
    await expect(run({ resource: 'StorageCell', action: 'read:own-KU' }, operator)).rejects.toMatchObject({
      code: 'MARKETPLACE_STORAGE_CELLS_DISABLED',
    });
    await expect(run({ resource: 'Container', action: 'manage:own-KU' }, operator, { containers: true })).resolves.toBe(true);
    await expect(run({ resource: 'StorageCell', action: 'read:own-KU' }, chairman, { cells: true })).resolves.toBe(true);
  });

  // mkt.rights.side.05
  it('подключение заказчика читается, только когда без него право не складывается', async () => {
    const { rights, onboarding } = makeRights({ onboarded: false });
    const guard = new MarketplaceRoleGuard(
      makeReflector({ access: { resource: 'Offer', action: 'read' } }),
      makeLogger(),
      rights
    );
    await guard.canActivate(makeCtx({ headers: {}, currentMember: operator }) as any);
    expect(onboarding.getOnboardingState).not.toHaveBeenCalled();
  });
});
