/**
 * Unit-тесты реестра боксов (Эпик 19, Story 19.2).
 *
 * Ключевые инварианты:
 *   - коды выдаются последовательно от текущего максимума;
 *   - объём типа считается из габаритов, но задаётся вручную для тары
 *     неправильной формы;
 *   - бокс и ячейка обязаны быть на одном участке — иначе имущество
 *     «переехало» бы между КУ мимо процесса передачи;
 *   - отсутствие адреса у бокса штатно, а непустой бокс не выводится.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  buildContainerCode,
  computeVolumeLiters,
  parseContainerCodeSequence,
} from '~/extensions/marketplace/domain/entities/marketplace-container.types';
import { MarketplaceContainerService } from '~/extensions/marketplace/application/services/marketplace-container.service';

const COOPNAME = 'voskhod';
const BRANAME = 'krasnogorsk';

const makeContainer = (over: Record<string, unknown> = {}) =>
  ({
    id: 'box-1',
    coopname: COOPNAME,
    braname: BRANAME,
    code: 'BX-0001',
    label: null,
    container_type_id: 'type-1',
    cell_id: null,
    is_active: true,
    created_at: new Date('2026-08-06T00:00:00Z'),
    updated_at: new Date('2026-08-06T00:00:00Z'),
    ...over,
  }) as any;

const makeCell = (over: Record<string, unknown> = {}) =>
  ({
    id: 'cell-1',
    coopname: COOPNAME,
    braname: BRANAME,
    section: 'A',
    level: 1,
    code: 'A-01',
    label: null,
    is_active: true,
    created_at: new Date('2026-08-06T00:00:00Z'),
    updated_at: new Date('2026-08-06T00:00:00Z'),
    ...over,
  }) as any;

const makeType = (over: Record<string, unknown> = {}) =>
  ({
    id: 'type-1',
    coopname: COOPNAME,
    name: 'Ящик 600×400×300',
    length_mm: 600,
    width_mm: 400,
    height_mm: 300,
    volume_liters: '72.000',
    max_weight_kg: null,
    is_active: true,
    created_at: new Date('2026-08-06T00:00:00Z'),
    updated_at: new Date('2026-08-06T00:00:00Z'),
    ...over,
  }) as any;

const makeService = (over: {
  containerRepo?: any;
  typeRepo?: any;
  cellRepo?: any;
  inventoryRepo?: any;
} = {}) => {
  const containerRepo = {
    createBatch: jest.fn(async (inputs: any[]) => inputs.map((i, idx) => makeContainer({ ...i, id: `box-${idx}` }))),
    findById: jest.fn(async () => makeContainer()),
    findByCode: jest.fn(async () => makeContainer()),
    list: jest.fn(async () => []),
    update: jest.fn(async (_id: string, patch: any) => makeContainer(patch)),
    countByCell: jest.fn(async () => 0),
    maxCodeSequence: jest.fn(async () => 0),
    ...over.containerRepo,
  };
  const typeRepo = {
    create: jest.fn(async (input: any) => makeType(input)),
    findById: jest.fn(async () => makeType()),
    list: jest.fn(async () => [makeType()]),
    update: jest.fn(async () => makeType()),
    ...over.typeRepo,
  };
  const cellRepo = {
    findById: jest.fn(async () => makeCell()),
    ...over.cellRepo,
  };
  const inventoryRepo = {
    countOnWarehouseByContainer: jest.fn(async () => 0),
    ...over.inventoryRepo,
  };
  return {
    service: new MarketplaceContainerService(
      containerRepo as any,
      typeRepo as any,
      cellRepo as any,
      inventoryRepo as any
    ),
    containerRepo,
    typeRepo,
    cellRepo,
    inventoryRepo,
  };
};

describe('коды и объём боксов', () => {
  it('код собирается с префиксом и разбирается обратно', () => {
    expect(buildContainerCode(1)).toBe('BX-0001');
    expect(buildContainerCode(137)).toBe('BX-0137');
    expect(parseContainerCodeSequence('BX-0137')).toBe(137);
  });

  it('код, заведённый не по схеме, не участвует в нумерации', () => {
    expect(parseContainerCodeSequence('Коробка Маши')).toBeNull();
  });

  it('объём считается из габаритов в литрах', () => {
    expect(computeVolumeLiters(600, 400, 300)).toBe('72.000');
  });
});

describe('MarketplaceContainerService.createContainers', () => {
  it('выдаёт коды подряд от текущего максимума', async () => {
    const { service, containerRepo } = makeService({
      containerRepo: { maxCodeSequence: jest.fn(async () => 7) },
    });

    await service.createContainers({
      coopname: COOPNAME,
      braname: BRANAME,
      container_type_id: 'type-1',
      count: 3,
    });

    const batch = containerRepo.createBatch.mock.calls[0][0];
    expect(batch.map((c: any) => c.code)).toEqual(['BX-0008', 'BX-0009', 'BX-0010']);
    expect(batch.every((c: any) => c.cell_id === null)).toBe(true);
  });

  it('отвергает партию размером с опечатку', async () => {
    const { service, containerRepo } = makeService();
    await expect(
      service.createContainers({ coopname: COOPNAME, braname: BRANAME, container_type_id: 'type-1', count: 5000 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(containerRepo.createBatch).not.toHaveBeenCalled();
  });

  it('не заводит боксы под чужой тип', async () => {
    const { service } = makeService({
      typeRepo: { findById: jest.fn(async () => makeType({ coopname: 'other' })) },
    });
    await expect(
      service.createContainers({ coopname: COOPNAME, braname: BRANAME, container_type_id: 'type-1', count: 1 })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MarketplaceContainerService.moveToCell', () => {
  it('ставит бокс в ячейку своего участка', async () => {
    const { service, containerRepo } = makeService();

    await service.moveToCell({ coopname: COOPNAME, container_id: 'box-1', cell_id: 'cell-1' });

    expect(containerRepo.update).toHaveBeenCalledWith('box-1', { cell_id: 'cell-1' });
  });

  it('снимает бокс с адреса — состояние «стоит без адреса» штатно', async () => {
    const { service, containerRepo, cellRepo } = makeService();

    await service.moveToCell({ coopname: COOPNAME, container_id: 'box-1', cell_id: null });

    expect(cellRepo.findById).not.toHaveBeenCalled();
    expect(containerRepo.update).toHaveBeenCalledWith('box-1', { cell_id: null });
  });

  it('не даёт поставить бокс в ячейку чужого участка', async () => {
    const { service, containerRepo } = makeService({
      cellRepo: { findById: jest.fn(async () => makeCell({ braname: 'other-ku' })) },
    });

    await expect(
      service.moveToCell({ coopname: COOPNAME, container_id: 'box-1', cell_id: 'cell-1' })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(containerRepo.update).not.toHaveBeenCalled();
  });

  it('не даёт поставить бокс в выведенную из оборота ячейку', async () => {
    const { service } = makeService({
      cellRepo: { findById: jest.fn(async () => makeCell({ is_active: false })) },
    });

    await expect(
      service.moveToCell({ coopname: COOPNAME, container_id: 'box-1', cell_id: 'cell-1' })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('MarketplaceContainerService.update', () => {
  it('не даёт вывести из оборота непустой бокс', async () => {
    const { service, containerRepo } = makeService({
      inventoryRepo: { countOnWarehouseByContainer: jest.fn(async () => 4) },
    });

    await expect(
      service.update({ coopname: COOPNAME, container_id: 'box-1', is_active: false })
    ).rejects.toBeInstanceOf(ConflictException);
    expect(containerRepo.update).not.toHaveBeenCalled();
  });

  it('выводит из оборота пустой бокс', async () => {
    const { service, containerRepo } = makeService();

    await service.update({ coopname: COOPNAME, container_id: 'box-1', is_active: false });

    expect(containerRepo.update).toHaveBeenCalledWith('box-1', {
      label: undefined,
      is_active: false,
    });
  });
});

describe('MarketplaceContainerService.sumVolumeLiters', () => {
  it('складывает объём по типам боксов', async () => {
    const { service } = makeService({
      typeRepo: {
        list: jest.fn(async () => [
          makeType({ id: 'type-1', volume_liters: '72.000' }),
          makeType({ id: 'type-2', volume_liters: '10.500' }),
        ]),
      },
    });

    const total = await service.sumVolumeLiters(COOPNAME, [
      makeContainer({ container_type_id: 'type-1' }),
      makeContainer({ container_type_id: 'type-2' }),
      makeContainer({ container_type_id: 'type-2' }),
    ]);

    expect(total).toBe('93.000');
  });

  it('пустая выборка — нулевой объём без запроса типов', async () => {
    const { service, typeRepo } = makeService();
    expect(await service.sumVolumeLiters(COOPNAME, [])).toBe('0.000');
    expect(typeRepo.list).not.toHaveBeenCalled();
  });
});
