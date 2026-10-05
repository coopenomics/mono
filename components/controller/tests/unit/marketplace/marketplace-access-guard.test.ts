/**
 * Право операции Стола заказов по таблице прав вместе с условием строки (C28-87).
 *
 * Проверку ведёт общий гард каркаса расширений (`RightsGuard`) над описанием
 * прав Стола заказов: `@RequireRight(resource, action)` сверяется с таблицей,
 * затем с условием строки. Охват права (чей объект) сверяется следом —
 * marketplace-right-scopes.test.ts.
 *
 * Сценарии:
 *   (a) право роли положено и условие выполнено → проход;
 *   (b) право роли не положено → отказ KIT_INSUFFICIENT_RIGHTS;
 *   (c) право положено, условие ждёт выполнения → отказ с кодом условия;
 *   (d) server-secret пропускает требование;
 *   (e) операция без требования права проходит.
 */
import { makeScopeGuard, memberOf, requirementOf, type ScopeWorld } from './right-scope.harness';

const orderer = memberOf('alice', 'orderer');
const operator = memberOf('oleg', 'orderer', 'operator');
const chairman = memberOf('chair', 'orderer', 'board_readonly', 'admin');
const council = memberOf('petr', 'orderer', 'board_readonly');

/** Проход или отказ гарда по требованию без источника объекта. */
function run(access: { resource: string; action: string | string[] }, member: typeof orderer, world: ScopeWorld = {}) {
  return makeScopeGuard(world).granted(access, member);
}

const NO_RIGHT = { code: 'KIT_INSUFFICIENT_RIGHTS' };
const NOT_ONBOARDED = { code: 'MARKETPLACE_ORDERER_ONBOARDING_REQUIRED' };

describe('право по таблице', () => {
  it('Order:create у подключённого заказчика → проход', async () => {
    await expect(run({ resource: 'Order', action: 'create' }, orderer)).resolves.toBeDefined();
  });

  it('KU:manage у заказчика → отказ: право его ролям не положено', async () => {
    await expect(run({ resource: 'KU', action: 'manage' }, orderer)).rejects.toMatchObject(NO_RIGHT);
  });

  it('Offer:moderate у председателя → проход; Inventory:label ему не положено', async () => {
    await expect(run({ resource: 'Offer', action: 'moderate' }, chairman)).resolves.toBeDefined();
    await expect(run({ resource: 'Inventory', action: 'label' }, chairman)).rejects.toMatchObject(NO_RIGHT);
  });

  it('список действий: достаточно одного из них', async () => {
    await expect(run({ resource: 'Receiving', action: ['cancel:own', 'cancel:own-KU'] }, operator)).resolves.toBeDefined();
  });

  it('server-secret пропускает требование и отдаёт охват «весь кооператив»', async () => {
    const { granted } = makeScopeGuard();
    await expect(
      granted({ resource: 'KU', action: 'manage' }, orderer, {}, { 'server-secret': 'svc-secret' })
    ).resolves.toEqual({ scopes: ['all'], kus: null });
  });

  it('операция без требования права проходит (членство проверяет гард членства)', async () => {
    const { granted } = makeScopeGuard();
    await expect(granted(undefined, orderer)).resolves.toBeUndefined();
  });
});

describe('условия строк таблицы', () => {
  // mkt.rights.side.01
  it('заказчик без оферты и пункта выдачи: корзина и каталог закрыты кодом подключения', async () => {
    for (const access of [
      { resource: 'Cart', action: 'manage:own' },
      { resource: 'Offer', action: 'read' },
      { resource: 'Order', action: 'create' },
    ]) {
      await expect(run(access, orderer, { onboarded: false })).rejects.toMatchObject(NOT_ONBOARDED);
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
      await expect(run(access, orderer, { onboarded: false })).resolves.toBeDefined();
    }
  });

  // mkt.rights.side.02
  it('оператор без подключения заказчика читает каталог по своей роли, корзина закрыта', async () => {
    await expect(run({ resource: 'Offer', action: 'read' }, operator, { onboarded: false })).resolves.toBeDefined();
    await expect(run({ resource: 'Cart', action: 'manage:own' }, operator, { onboarded: false })).rejects.toMatchObject(
      NOT_ONBOARDED
    );
  });

  // mkt.rights.side.09
  it('член совета без подключения заказчика открывает карточку предложения и витрину, корзина закрыта', async () => {
    for (const access of [
      { resource: 'Offer', action: 'read' },
      { resource: 'Offer', action: 'read:all' },
      { resource: 'Vitrine', action: 'read' },
      { resource: 'Economy', action: 'read' },
    ]) {
      await expect(run(access, council, { onboarded: false })).resolves.toBeDefined();
    }
    await expect(run({ resource: 'Cart', action: 'manage:own' }, council, { onboarded: false })).rejects.toMatchObject(
      NOT_ONBOARDED
    );
  });

  // mkt.rights.side.10
  it('оператор без подключения заказчика читает ход выдач и предложения докладки своего участка', async () => {
    // Страница выдачи оператора зовёт три операции, которые отвечают и заказчику
    // (своё), и оператору (свой участок). Требование называет оба охвата: с одним
    // охватом заказчика оператор без оферты и пункта выдачи получал отказ.
    const { granted } = makeScopeGuard({
      onboarded: false,
      branches: { krg: { trustee: 'oleg' } },
      objects: { IssuanceSaga: { o1: { member_account: 'ivan', braname: 'krg' } } },
    });
    await expect(
      granted(requirementOf('marketplace-issuance.resolver.ts', 'marketplaceIssuanceSaga'), operator, { data: { order_id: 'o1' } })
    ).resolves.toMatchObject({ scopes: ['own-KU'] });
    for (const [file, operation] of [
      ['marketplace-issuance.resolver.ts', 'marketplaceListIssuanceSagas'],
      ['marketplace-stock.resolver.ts', 'marketplaceListStockProposals'],
    ]) {
      await expect(granted(requirementOf(file, operation), operator, { data: { braname: 'krg' } })).resolves.toMatchObject({
        kus: ['krg'],
      });
    }
  });

  // mkt.rights.side.03
  it('до решения совета действует только подключение кооператива', async () => {
    const world = { accepted: false };
    await expect(run({ resource: 'Extension', action: 'configure' }, chairman, world)).resolves.toBeDefined();
    await expect(run({ resource: 'Extension', action: 'read' }, orderer, world)).resolves.toBeDefined();
    await expect(run({ resource: 'Membership', action: 'read:own' }, orderer, world)).resolves.toBeDefined();
    await expect(run({ resource: 'KU', action: 'manage' }, chairman, world)).rejects.toMatchObject({
      code: 'MARKETPLACE_COOP_NOT_CONNECTED',
    });
    await expect(run({ resource: 'Onboarding', action: 'sign:own' }, orderer, world)).rejects.toMatchObject({
      code: 'MARKETPLACE_COOP_NOT_CONNECTED',
    });
  });

  // mkt.rights.side.04
  it('боксы и ячейки отвечают только при включённом хранении', async () => {
    const off = { containers: false, cells: false };
    await expect(run({ resource: 'Container', action: 'manage:own-KU' }, operator, off)).rejects.toMatchObject({
      code: 'MARKETPLACE_CONTAINERS_DISABLED',
    });
    await expect(run({ resource: 'StorageCell', action: 'read:own-KU' }, operator, off)).rejects.toMatchObject({
      code: 'MARKETPLACE_STORAGE_CELLS_DISABLED',
    });
    await expect(run({ resource: 'Container', action: 'manage:own-KU' }, operator, { ...off, containers: true })).resolves.toBeDefined();
    await expect(run({ resource: 'StorageCell', action: 'read:own-KU' }, chairman, { ...off, cells: true })).resolves.toBeDefined();
  });

  // mkt.rights.side.05
  it('подключение заказчика читается, только когда без него право не складывается', async () => {
    const { granted, onboarding } = makeScopeGuard({ onboarded: false });
    await granted({ resource: 'Offer', action: 'read' }, operator);
    expect(onboarding.getOnboardingState).not.toHaveBeenCalled();
  });
});
