/**
 * Unit-тесты оприходования при закрывающей подписи (Эпик 19, Story 19.5).
 *
 * Главный инвариант — ПОРЯДОК: место проверяется до отправки подписи в цепь.
 * Обратный порядок оставил бы акт подписанным on-chain, а принятое — без
 * места, куда его положить: акт закрыт, имущество физически лежит, а система
 * положить его никуда не может.
 *
 * Проверяем через приватный resolveReceptionPlacements — он и есть та самая
 * проверка, а публичный signAsChairman тянет за собой цепь, выплаты и события.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MarketplaceAplReceptionService } from '~/extensions/marketplace/application/services/marketplace-apl-reception.service';

const COOPNAME = 'voskhod';
const BRANAME = 'krasnogorsk';

const reception = { id: 'apl-1', coopname: COOPNAME, braname: BRANAME } as any;

const order = (id: string, braname = BRANAME) =>
  ({ id, delivery_braname: braname, orderer_account: 'ivanov', quantity: 5 }) as any;

const container = (over: Record<string, unknown> = {}) =>
  ({ id: 'box-1', coopname: COOPNAME, braname: BRANAME, code: 'BX-0001', is_active: true, ...over }) as any;

const cell = (over: Record<string, unknown> = {}) =>
  ({ id: 'cell-1', coopname: COOPNAME, braname: BRANAME, code: 'A-02', is_active: true, ...over }) as any;

/**
 * Сервис приёмки собирается из полутора десятков зависимостей; для проверки
 * размещения значимы только три, остальные подставляем заглушками.
 */
const makeService = (over: {
  required?: boolean;
  containerRepo?: any;
  cellRepo?: any;
} = {}) => {
  const containerRepo = { findById: jest.fn(async () => container()), ...over.containerRepo };
  const cellRepo = { findById: jest.fn(async () => cell()), ...over.cellRepo };
  const warehouseSettings = {
    get: jest.fn(async () => ({
      containers_enabled: true,
      cells_enabled: true,
      posting_on_reception_required: over.required ?? false,
    })),
  };

  const service = Object.create(MarketplaceAplReceptionService.prototype) as any;
  service.containerRepo = containerRepo;
  service.cellRepo = cellRepo;
  service.warehouseSettings = warehouseSettings;

  const resolve = (orders: any[], placements: any[]) =>
    service.resolveReceptionPlacements(reception, orders, placements);

  return { resolve, containerRepo, cellRepo, warehouseSettings };
};

describe('resolveReceptionPlacements — раскладка мест по заказам', () => {
  it('кладёт принятое в бокс', async () => {
    const { resolve } = makeService();

    const map = await resolve([order('o1')], [{ order_id: 'o1', container_id: 'box-1' }]);

    expect(map.get('o1')).toEqual({ container_id: 'box-1', cell_id: null });
  });

  it('кладёт негабарит в ячейку напрямую', async () => {
    const { resolve } = makeService();

    const map = await resolve([order('o1')], [{ order_id: 'o1', cell_id: 'cell-1' }]);

    expect(map.get('o1')).toEqual({ container_id: null, cell_id: 'cell-1' });
  });

  it('складывает разные заказы в один бокс — докладка штатна', async () => {
    const { resolve } = makeService();

    const map = await resolve(
      [order('o1'), order('o2')],
      [
        { order_id: 'o1', container_id: 'box-1' },
        { order_id: 'o2', container_id: 'box-1' },
      ]
    );

    expect(map.get('o1')).toEqual({ container_id: 'box-1', cell_id: null });
    expect(map.get('o2')).toEqual({ container_id: 'box-1', cell_id: null });
  });

  it('отвергает бокс и ячейку одновременно для одного заказа', async () => {
    const { resolve } = makeService();

    await expect(
      resolve([order('o1')], [{ order_id: 'o1', container_id: 'box-1', cell_id: 'cell-1' }])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отвергает место для заказа не из этой приёмки', async () => {
    const { resolve } = makeService();

    await expect(
      resolve([order('o1')], [{ order_id: 'чужой', container_id: 'box-1' }])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отвергает бокс чужого участка', async () => {
    const { resolve } = makeService({
      containerRepo: { findById: jest.fn(async () => container({ braname: 'other-ku' })) },
    });

    await expect(
      resolve([order('o1')], [{ order_id: 'o1', container_id: 'box-1' }])
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('отвергает бокс, выведенный из оборота', async () => {
    const { resolve } = makeService({
      containerRepo: { findById: jest.fn(async () => container({ is_active: false })) },
    });

    await expect(
      resolve([order('o1')], [{ order_id: 'o1', container_id: 'box-1' }])
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('отвергает ячейку чужого кооператива', async () => {
    const { resolve } = makeService({
      cellRepo: { findById: jest.fn(async () => cell({ coopname: 'other' })) },
    });

    await expect(
      resolve([order('o1')], [{ order_id: 'o1', cell_id: 'cell-1' }])
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('resolveReceptionPlacements — требование указывать место', () => {
  it('при включённом требовании не пропускает неразмещённые заказы', async () => {
    const { resolve } = makeService({ required: true });

    await expect(
      resolve([order('o1'), order('o2')], [{ order_id: 'o1', container_id: 'box-1' }])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('при включённом требовании пропускает полностью размещённую приёмку', async () => {
    const { resolve } = makeService({ required: true });

    const map = await resolve(
      [order('o1'), order('o2')],
      [
        { order_id: 'o1', container_id: 'box-1' },
        { order_id: 'o2', cell_id: 'cell-1' },
      ]
    );

    expect(map.size).toBe(2);
  });

  it('при выключенном требовании пустой список — не ошибка', async () => {
    const { resolve } = makeService({ required: false });

    const map = await resolve([order('o1')], []);

    expect(map.size).toBe(0);
  });

  it('требование не распространяется на заказы чужого участка', async () => {
    const { resolve } = makeService({ required: true });

    // Заказ едет на другой КУ — на этой приёмке он не оприходуется,
    // значит и места для него не требуется.
    const map = await resolve(
      [order('o1'), order('o2', 'other-ku')],
      [{ order_id: 'o1', container_id: 'box-1' }]
    );

    expect(map.size).toBe(1);
  });
});
