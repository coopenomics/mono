/**
 * Unit-тесты топологии склада КУ (Эпик 19, Story 19.1).
 *
 * Проверяем инварианты, которые дороже всего чинить постфактум:
 *   - адрес ячейки выводится из координат и сортируется предсказуемо;
 *   - генерация сетки не пропускает опечатки в диапазоне ярусов и в секциях;
 *   - вывести из оборота можно только пустую ячейку — иначе имущество
 *     осталось бы числиться в месте, которого для оператора больше нет.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { buildStorageCellCode } from '~/extensions/marketplace/domain/entities/marketplace-storage-cell.types';
import { MarketplaceStorageCellService } from '~/extensions/marketplace/application/services/marketplace-storage-cell.service';

const COOPNAME = 'voskhod';
const BRANAME = 'krasnogorsk';

const makeCell = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    id: 'cell-1',
    coopname: COOPNAME,
    braname: BRANAME,
    section: 'A',
    level: 2,
    code: 'A-02',
    label: null,
    is_active: true,
    created_at: new Date('2026-08-06T00:00:00Z'),
    updated_at: new Date('2026-08-06T00:00:00Z'),
    ...over,
  }) as any;

const makeService = (over: { cellRepo?: any; inventoryRepo?: any; containerRepo?: any } = {}) => {
  const cellRepo = {
    create: jest.fn(async (input: any) => makeCell(input)),
    createGrid: jest.fn(async (inputs: any[]) => inputs.map((i, idx) => makeCell({ ...i, id: `cell-${idx}` }))),
    findById: jest.fn(async () => makeCell()),
    findByCode: jest.fn(async () => null),
    list: jest.fn(async () => []),
    update: jest.fn(async (_id: string, patch: any) => makeCell(patch)),
    ...over.cellRepo,
  };
  const inventoryRepo = {
    countOnWarehouseByCell: jest.fn(async () => 0),
    ...over.inventoryRepo,
  };
  const containerRepo = {
    countByCell: jest.fn(async () => 0),
    ...over.containerRepo,
  };
  return {
    service: new MarketplaceStorageCellService(
      cellRepo as any,
      inventoryRepo as any,
      containerRepo as any
    ),
    cellRepo,
    inventoryRepo,
    containerRepo,
  };
};

describe('buildStorageCellCode', () => {
  it('дополняет ярус до двух знаков, чтобы адреса сортировались как числа', () => {
    expect(buildStorageCellCode('A', 2)).toBe('A-02');
    expect(buildStorageCellCode('A', 10)).toBe('A-10');
    expect(['A-10', 'A-02'].sort()).toEqual(['A-02', 'A-10']);
  });

  it('обрезает пробелы вокруг секции', () => {
    expect(buildStorageCellCode('  Холодильник ', 1)).toBe('Холодильник-01');
  });
});

describe('MarketplaceStorageCellService.createGrid', () => {
  it('заводит прямоугольную сетку «секции × ярусы»', async () => {
    const { service, cellRepo } = makeService();

    await service.createGrid({
      coopname: COOPNAME,
      braname: BRANAME,
      sections: ['A', 'B'],
      level_from: 1,
      level_to: 3,
    });

    const inputs = cellRepo.createGrid.mock.calls[0][0];
    expect(inputs).toHaveLength(6);
    expect(inputs.map((i: any) => i.code)).toEqual([
      'A-01',
      'A-02',
      'A-03',
      'B-01',
      'B-02',
      'B-03',
    ]);
  });

  it('отвергает пустой список секций', async () => {
    const { service } = makeService();
    await expect(
      service.createGrid({ coopname: COOPNAME, braname: BRANAME, sections: ['  '], level_from: 1, level_to: 1 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отвергает повторяющиеся секции', async () => {
    const { service } = makeService();
    await expect(
      service.createGrid({ coopname: COOPNAME, braname: BRANAME, sections: ['A', 'A'], level_from: 1, level_to: 1 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отвергает убывающий диапазон ярусов', async () => {
    const { service } = makeService();
    await expect(
      service.createGrid({ coopname: COOPNAME, braname: BRANAME, sections: ['A'], level_from: 5, level_to: 2 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('не даёт завести сетку размером с опечатку', async () => {
    const { service, cellRepo } = makeService();
    await expect(
      service.createGrid({ coopname: COOPNAME, braname: BRANAME, sections: ['A'], level_from: 1, level_to: 10000 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cellRepo.createGrid).not.toHaveBeenCalled();
  });
});

describe('MarketplaceStorageCellService.update', () => {
  it('не даёт вывести из оборота ячейку, в которой лежит имущество', async () => {
    const { service, cellRepo, inventoryRepo } = makeService({
      inventoryRepo: { countOnWarehouseByCell: jest.fn(async () => 3) },
    });

    await expect(
      service.update({ coopname: COOPNAME, id: 'cell-1', is_active: false })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cellRepo.update).not.toHaveBeenCalled();
    expect(inventoryRepo.countOnWarehouseByCell).toHaveBeenCalledWith(COOPNAME, 'cell-1');
  });

  it('выводит из оборота пустую ячейку', async () => {
    const { service, cellRepo } = makeService();

    await service.update({ coopname: COOPNAME, id: 'cell-1', is_active: false });

    expect(cellRepo.update).toHaveBeenCalledWith('cell-1', { label: undefined, is_active: false });
  });

  it('не даёт вывести из оборота ячейку, в которой стоят боксы', async () => {
    const { service, cellRepo } = makeService({
      containerRepo: { countByCell: jest.fn(async () => 2) },
    });

    await expect(
      service.update({ coopname: COOPNAME, id: 'cell-1', is_active: false })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cellRepo.update).not.toHaveBeenCalled();
  });

  it('правит подпись без проверки на пустоту — содержимое ей не мешает', async () => {
    const { service, inventoryRepo } = makeService({
      inventoryRepo: { countOnWarehouseByCell: jest.fn(async () => 7) },
    });

    await service.update({ coopname: COOPNAME, id: 'cell-1', label: 'Холодильник' });

    expect(inventoryRepo.countOnWarehouseByCell).not.toHaveBeenCalled();
  });

  it('не отдаёт ячейку чужого кооператива', async () => {
    const { service } = makeService({
      cellRepo: { findById: jest.fn(async () => makeCell({ coopname: 'other' })) },
    });

    await expect(service.getById(COOPNAME, 'cell-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
