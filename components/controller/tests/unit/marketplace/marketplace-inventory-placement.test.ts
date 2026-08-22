/**
 * Unit-тесты размещения имущества (Эпик 19, Story 19.3).
 *
 * Инвариант размещения: место — ровно одно из двух, бокс либо ячейка
 * напрямую. Цель обязана существовать, быть в обороте и относиться к тому же
 * участку, что и сама позиция: иначе имущество «переехало» бы между КУ мимо
 * процесса передачи, а учёт разошёлся бы с физикой.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MarketplaceInventoryLabelService } from '~/extensions/marketplace/application/services/marketplace-inventory-label.service';

const COOPNAME = 'voskhod';
const BRANAME = 'krasnogorsk';

const makeItem = (over: Record<string, unknown> = {}) =>
  ({
    id: 'inv-1',
    coopname: COOPNAME,
    braname: BRANAME,
    order_id: 'order-1',
    shipment_id: 'ship-1',
    status: 'RECEIVED',
    barcode_value: null,
    quantity_per_label: 10,
    cell_id: null,
    container_id: null,
    ...over,
  }) as any;

const makeContainer = (over: Record<string, unknown> = {}) =>
  ({
    id: 'box-1',
    coopname: COOPNAME,
    braname: BRANAME,
    code: 'BX-0001',
    cell_id: 'cell-1',
    is_active: true,
    ...over,
  }) as any;

const makeCell = (over: Record<string, unknown> = {}) =>
  ({
    id: 'cell-1',
    coopname: COOPNAME,
    braname: BRANAME,
    code: 'A-02',
    is_active: true,
    ...over,
  }) as any;

const makeService = (over: { inventoryRepo?: any; containerRepo?: any; cellRepo?: any } = {}) => {
  const inventoryRepo = {
    findById: jest.fn(async () => makeItem()),
    assignPlacement: jest.fn(async (id: string, placement: any) => makeItem({ id, ...placement })),
    list: jest.fn(async () => []),
    resize: jest.fn(async () => makeItem()),
    create: jest.fn(async (input: any) => makeItem(input)),
    deleteById: jest.fn(async () => undefined),
    ...over.inventoryRepo,
  };
  const containerRepo = {
    findById: jest.fn(async () => makeContainer()),
    ...over.containerRepo,
  };
  const cellRepo = {
    findById: jest.fn(async () => makeCell()),
    ...over.cellRepo,
  };
  const logger = { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any;
  return {
    service: new MarketplaceInventoryLabelService(
      inventoryRepo as any,
      containerRepo as any,
      cellRepo as any,
      logger
    ),
    inventoryRepo,
    containerRepo,
    cellRepo,
  };
};

const assign = (service: MarketplaceInventoryLabelService, over: Record<string, unknown> = {}) =>
  service.assignPlacement({
    coopname: COOPNAME,
    operator_account: 'chairman',
    inventory_id: 'inv-1',
    ...over,
  } as any);

describe('MarketplaceInventoryLabelService.assignPlacement', () => {
  it('кладёт позицию в бокс', async () => {
    const { service, inventoryRepo } = makeService();

    await assign(service, { container_id: 'box-1' });

    expect(inventoryRepo.assignPlacement).toHaveBeenCalledWith('inv-1', {
      container_id: 'box-1',
      cell_id: null,
    });
  });

  it('кладёт негабарит в ячейку напрямую', async () => {
    const { service, inventoryRepo } = makeService();

    await assign(service, { cell_id: 'cell-1' });

    expect(inventoryRepo.assignPlacement).toHaveBeenCalledWith('inv-1', {
      container_id: null,
      cell_id: 'cell-1',
    });
  });

  it('снимает позицию с места, когда оба адреса пусты', async () => {
    const { service, inventoryRepo, containerRepo, cellRepo } = makeService();

    await assign(service);

    expect(containerRepo.findById).not.toHaveBeenCalled();
    expect(cellRepo.findById).not.toHaveBeenCalled();
    expect(inventoryRepo.assignPlacement).toHaveBeenCalledWith('inv-1', {
      container_id: null,
      cell_id: null,
    });
  });

  it('отвергает попытку задать сразу и бокс, и ячейку', async () => {
    const { service, inventoryRepo } = makeService();

    await expect(assign(service, { container_id: 'box-1', cell_id: 'cell-1' })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(inventoryRepo.assignPlacement).not.toHaveBeenCalled();
  });

  it('не кладёт имущество в бокс чужого участка', async () => {
    const { service, inventoryRepo } = makeService({
      containerRepo: { findById: jest.fn(async () => makeContainer({ braname: 'other-ku' })) },
    });

    await expect(assign(service, { container_id: 'box-1' })).rejects.toBeInstanceOf(ConflictException);
    expect(inventoryRepo.assignPlacement).not.toHaveBeenCalled();
  });

  it('не кладёт имущество в выведенный из оборота бокс', async () => {
    const { service } = makeService({
      containerRepo: { findById: jest.fn(async () => makeContainer({ is_active: false })) },
    });

    await expect(assign(service, { container_id: 'box-1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('не кладёт имущество в ячейку чужого кооператива', async () => {
    const { service } = makeService({
      cellRepo: { findById: jest.fn(async () => makeCell({ coopname: 'other' })) },
    });

    await expect(assign(service, { cell_id: 'cell-1' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('докладка в занятый бокс проходит штатно — занятость не проверяется', async () => {
    const { service, inventoryRepo } = makeService();

    await assign(service, { container_id: 'box-1' });
    await assign(service, { container_id: 'box-1' });

    expect(inventoryRepo.assignPlacement).toHaveBeenCalledTimes(2);
  });
});
