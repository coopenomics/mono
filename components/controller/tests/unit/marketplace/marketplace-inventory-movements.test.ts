/**
 * Журнал движения позиции склада и архив склада (решение владельца 19.11.2026).
 *
 * Записи журнала ведёт триггер базы (миграция `*-inventory-movement`), резолвер
 * только читает и дополняет показ:
 *   - выдача — кто выдал и кому — из акта выдачи по заказу;
 *   - место — коды бокса и ячейки;
 *   - исполнитель и получатель — ФИО по аккаунтам, участок — по имени участка.
 * Архив — выданное и списанное, постранично и только по участкам от гарда.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import type { IGrantedScope } from '@coopenomics/extension-kit';
import { MarketplaceInventoryResolver } from '~/extensions/marketplace/application/resolvers/marketplace-inventory.resolver';
import type { MarketplaceInventoryMovement } from '~/extensions/marketplace/domain/repositories/marketplace-inventory.repository';

const at = new Date('2026-11-19T10:00:00Z');

const step = (patch: Partial<MarketplaceInventoryMovement>): MarketplaceInventoryMovement => ({
  id: '1',
  inventory_id: 'inv-1',
  kind: 'RECEIVED',
  status: 'RECEIVED',
  braname: 'krg',
  container_id: null,
  cell_id: null,
  quantity: 5,
  barcode_value: null,
  order_id: 'ord-1',
  actor_account: 'oper1',
  at,
  ...patch,
});

const makeResolver = (movements: MarketplaceInventoryMovement[]) => {
  const inventoryRepo = {
    listMovements: jest.fn().mockResolvedValue(movements),
    listArchive: jest.fn().mockResolvedValue({ items: [], totalCount: 0 }),
  } as any;
  const orderDisplay = {
    resolveAccountNames: jest.fn(async (accounts: string[]) => {
      const names: Record<string, string> = {
        oper1: 'Иванов И. И.',
        oper2: 'Петров П. П.',
        member1: 'Сидорова А. А.',
        krg: 'ПВЗ Красногорск',
      };
      return new Map(accounts.filter((a) => names[a]).map((a) => [a, names[a]]));
    }),
    enrichByOrderIds: jest.fn().mockResolvedValue(new Map()),
  } as any;
  const sagaRepo = {
    findByOrderHash: jest.fn().mockResolvedValue({ operator_account: 'oper2', member_account: 'member1' }),
  } as any;
  const orderRepo = { findById: jest.fn().mockResolvedValue({ order_hash: 'h1' }) } as any;
  const containerRepo = { findById: jest.fn().mockResolvedValue({ code: 'BOX-7' }) } as any;
  const cellRepo = { findById: jest.fn().mockResolvedValue({ code: 'A-1-2' }) } as any;
  const resolver = new MarketplaceInventoryResolver(
    {} as any,
    inventoryRepo,
    orderDisplay,
    sagaRepo,
    orderRepo,
    containerRepo,
    cellRepo
  );
  return { resolver, inventoryRepo, sagaRepo, orderRepo, containerRepo };
};

describe('marketplaceInventoryMovements: журнал движения позиции', () => {
  it('приёмка: исполнитель и участок — именами', async () => {
    const { resolver } = makeResolver([step({})]);
    const [received] = await resolver.marketplaceInventoryMovements('inv-1');
    expect(received).toMatchObject({
      kind: 'RECEIVED',
      actor_account: 'oper1',
      actor_name: 'Иванов И. И.',
      branch_name: 'ПВЗ Красногорск',
      recipient_account: null,
    });
  });

  it('размещение: место — кодами бокса и ячейки', async () => {
    const { resolver } = makeResolver([step({ kind: 'PLACED', container_id: 'c1', cell_id: 'cell1' })]);
    const [placed] = await resolver.marketplaceInventoryMovements('inv-1');
    expect(placed.place_label).toBe('BOX-7 · A-1-2');
  });

  it('снятие с места: место пустое', async () => {
    const { resolver, containerRepo } = makeResolver([step({ kind: 'PLACED' })]);
    const [placed] = await resolver.marketplaceInventoryMovements('inv-1');
    expect(placed.place_label).toBeNull();
    expect(containerRepo.findById).not.toHaveBeenCalled();
  });

  it('выдача без исполнителя в записи: выдал и получил — из акта выдачи по заказу', async () => {
    const { resolver, orderRepo, sagaRepo } = makeResolver([step({ kind: 'ISSUED', actor_account: null })]);
    const [issued] = await resolver.marketplaceInventoryMovements('inv-1');
    expect(orderRepo.findById).toHaveBeenCalledWith('ord-1');
    expect(sagaRepo.findByOrderHash).toHaveBeenCalledWith('voskhod', 'h1');
    expect(issued).toMatchObject({
      actor_account: 'oper2',
      actor_name: 'Петров П. П.',
      recipient_account: 'member1',
      recipient_name: 'Сидорова А. А.',
    });
  });

  it('акт выдачи по заказу читается один раз на заказ', async () => {
    const { resolver, orderRepo } = makeResolver([
      step({ id: '1', kind: 'ISSUED', actor_account: null }),
      step({ id: '2', kind: 'ISSUED', actor_account: null }),
    ]);
    await resolver.marketplaceInventoryMovements('inv-1');
    expect(orderRepo.findById).toHaveBeenCalledTimes(1);
  });

  it('получатель указывается только у выдачи', async () => {
    const { resolver } = makeResolver([step({ kind: 'LABELED', barcode_value: 'MKT-1' })]);
    const [labeled] = await resolver.marketplaceInventoryMovements('inv-1');
    expect(labeled.recipient_account).toBeNull();
    expect(labeled.barcode_value).toBe('MKT-1');
  });

  it('пустой журнал → пустой ответ без чтения актов и справочников', async () => {
    const { resolver, orderRepo, containerRepo } = makeResolver([]);
    expect(await resolver.marketplaceInventoryMovements('inv-1')).toEqual([]);
    expect(orderRepo.findById).not.toHaveBeenCalled();
    expect(containerRepo.findById).not.toHaveBeenCalled();
  });
});

const branches = (...kus: string[]): IGrantedScope => ({ scopes: ['own-KU'], kus });

describe('marketplaceListInventoryArchive: архив склада', () => {
  it('страница → смещение и предел в хранилище, число страниц по итогу', async () => {
    const { resolver, inventoryRepo } = makeResolver([]);
    inventoryRepo.listArchive.mockResolvedValue({ items: [], totalCount: 120 });
    const res = await resolver.marketplaceListInventoryArchive(branches('krg'), undefined, { page: 3, limit: 50 } as any);
    expect(inventoryRepo.listArchive).toHaveBeenCalledWith(
      { coopname: 'voskhod', braname: ['krg'] },
      { limit: 50, offset: 100 }
    );
    expect(res).toMatchObject({ totalCount: 120, totalPages: 3, currentPage: 3 });
  });

  it('предел страницы не больше 100', async () => {
    const { resolver, inventoryRepo } = makeResolver([]);
    await resolver.marketplaceListInventoryArchive(branches('krg'), undefined, { page: 1, limit: 5000 } as any);
    expect(inventoryRepo.listArchive).toHaveBeenCalledWith(expect.anything(), { limit: 100, offset: 0 });
  });

  it('весь кооператив → отбора по участкам нет', async () => {
    const { resolver, inventoryRepo } = makeResolver([]);
    await resolver.marketplaceListInventoryArchive({ scopes: ['all'], kus: null }, undefined, undefined);
    expect(inventoryRepo.listArchive).toHaveBeenCalledWith(
      { coopname: 'voskhod', braname: undefined },
      { limit: 50, offset: 0 }
    );
  });

  it('участков нет → пустая страница, хранилище не читается', async () => {
    const { resolver, inventoryRepo } = makeResolver([]);
    const res = await resolver.marketplaceListInventoryArchive(branches(), undefined, undefined);
    expect(res).toEqual({ items: [], totalCount: 0, totalPages: 0, currentPage: 1 });
    expect(inventoryRepo.listArchive).not.toHaveBeenCalled();
  });
});
