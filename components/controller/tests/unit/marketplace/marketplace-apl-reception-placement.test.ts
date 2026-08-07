/**
 * Unit-тесты оприходования при закрывающей подписи (Эпик 19, Story 19.5).
 *
 * Главный инвариант — ПОРЯДОК: этикетки и места проверяются до отправки подписи
 * в цепь. Обратный порядок оставил бы акт подписанным on-chain, а принятое —
 * без места, куда его положить: акт закрыт, имущество физически лежит, а
 * система положить его никуда не может.
 *
 * Оприходование планируется целиком до подписи — председатель проходит шаги
 * маркировки и раскладки, и всё намеченное уходит вместе с подписью одним
 * пакетом. Поэтому требование «указать место» проверяется именно здесь.
 *
 * Проверяем через приватный resolveReceptionPlacements — он и есть та самая
 * проверка, а публичный signAsChairman тянет за собой цепь, выплаты и события.
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MarketplaceAplReceptionService } from '~/extensions/marketplace/application/services/marketplace-apl-reception.service';

const COOPNAME = 'voskhod';
const BRANAME = 'krasnogorsk';

const reception = {
  id: 'apl-1',
  coopname: COOPNAME,
  braname: BRANAME,
  // Факт приёмки: сколько по каждому заказу реально привезли. От него считается,
  // всё ли разложено и не разложили ли больше, чем приняли.
  fact_quantity_per_order: [
    { order_id: 'o1', fact_quantity: 5 },
    { order_id: 'o2', fact_quantity: 5 },
  ],
} as any;

/** Часть раскладки в том виде, в каком её возвращает разбор входа. */
const part = (over: Record<string, unknown> = {}) => ({
  container_id: null,
  cell_id: null,
  barcode_value: null,
  quantity: null,
  ...over,
});

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
  containersEnabled?: boolean;
  cellsEnabled?: boolean;
  containerRepo?: any;
  cellRepo?: any;
  inventoryRepo?: any;
} = {}) => {
  const containerRepo = { findById: jest.fn(async () => container()), ...over.containerRepo };
  const cellRepo = { findById: jest.fn(async () => cell()), ...over.cellRepo };
  const inventoryRepo = {
    findByBarcode: jest.fn(async () => null),
    ...over.inventoryRepo,
  };
  const warehouseSettings = {
    get: jest.fn(async () => ({
      containers_enabled: over.containersEnabled ?? true,
      cells_enabled: over.cellsEnabled ?? true,
      posting_on_reception_required: over.required ?? false,
    })),
  };

  const service = Object.create(MarketplaceAplReceptionService.prototype) as any;
  service.containerRepo = containerRepo;
  service.cellRepo = cellRepo;
  service.inventoryRepo = inventoryRepo;
  service.warehouseSettings = warehouseSettings;

  const resolve = (orders: any[], placements: any[]) =>
    service.resolveReceptionPlacements(reception, orders, placements);

  return { resolve, containerRepo, cellRepo, inventoryRepo, warehouseSettings };
};

describe('resolveReceptionPlacements — раскладка мест по заказам', () => {
  it('кладёт принятое в бокс', async () => {
    const { resolve } = makeService();

    const map = await resolve([order('o1')], [{ order_id: 'o1', container_id: 'box-1' }]);

    expect(map.get('o1')).toEqual([part({ container_id: 'box-1' })]);
  });

  it('кладёт негабарит в ячейку напрямую', async () => {
    const { resolve } = makeService();

    const map = await resolve([order('o1')], [{ order_id: 'o1', cell_id: 'cell-1' }]);

    expect(map.get('o1')).toEqual([part({ cell_id: 'cell-1' })]);
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

    expect(map.get('o1')).toEqual([part({ container_id: 'box-1' })]);
    expect(map.get('o2')).toEqual([part({ container_id: 'box-1' })]);
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

  it('одна этикетка без места требование не удовлетворяет', async () => {
    // Маркировка и раскладка независимы: наклеить этикетку — не значит положить.
    const { resolve } = makeService({ required: true });

    await expect(
      resolve([order('o1')], [{ order_id: 'o1', barcode_value: '4600000000001' }])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('при выключенном требовании пустой список — не ошибка', async () => {
    const { resolve } = makeService({ required: false });

    const map = await resolve([order('o1')], []);

    expect(map.size).toBe(0);
  });

  it('требование не действует, когда класть некуда — ни боксов, ни ячеек', async () => {
    // Флаг обязательности, включённый в одиночку, иначе заблокировал бы приёмку
    // намертво: председатель видит отказ, а положить имущество физически некуда.
    const { resolve } = makeService({
      required: true,
      containersEnabled: false,
      cellsEnabled: false,
    });

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

describe('resolveReceptionPlacements — этикетки', () => {
  it('принимает этикетку вместе с местом', async () => {
    const { resolve } = makeService();

    const map = await resolve(
      [order('o1')],
      [{ order_id: 'o1', container_id: 'box-1', barcode_value: '4600000000001' }]
    );

    expect(map.get('o1')).toEqual([
      part({ container_id: 'box-1', barcode_value: '4600000000001' }),
    ]);
  });

  it('сохраняет этикетку и без места — маркировка от раскладки не зависит', async () => {
    const { resolve } = makeService();

    const map = await resolve([order('o1')], [{ order_id: 'o1', barcode_value: '4600000000001' }]);

    expect(map.get('o1')).toEqual([part({ barcode_value: '4600000000001' })]);
  });

  it('не даёт наклеить один номер на две единицы одной приёмки', async () => {
    // Два одинаковых номера на складе делают поиск сканером бессмысленным.
    const { resolve } = makeService();

    await expect(
      resolve(
        [order('o1'), order('o2')],
        [
          { order_id: 'o1', barcode_value: '4600000000001' },
          { order_id: 'o2', barcode_value: '4600000000001' },
        ]
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('не даёт занять номер, уже привязанный к позиции склада', async () => {
    const { resolve } = makeService({
      inventoryRepo: { findByBarcode: jest.fn(async () => ({ id: 'inv-9' })) },
    });

    await expect(
      resolve([order('o1')], [{ order_id: 'o1', barcode_value: '4600000000001' }])
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('отвергает код, не похожий на этикетку, до отправки подписи в цепь', async () => {
    // Сканер ловит и QR тары, и служебные коды. Если пропустить такой номер
    // дальше, подпись уйдёт на цепь, а позиция склада не создастся — приёмка
    // останется закрытой без оприходования, и повторить её будет нечем.
    const { resolve } = makeService();

    await expect(
      resolve(
        [order('o1')],
        [{ order_id: 'o1', container_id: 'box-1', barcode_value: '000000000000000000000000' }]
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отвергает буквенный код', async () => {
    const { resolve } = makeService();

    await expect(
      resolve([order('o1')], [{ order_id: 'o1', container_id: 'box-1', barcode_value: 'BX-0001' }])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('пустую строку номером не считает', async () => {
    const { resolve, inventoryRepo } = makeService();

    const map = await resolve(
      [order('o1')],
      [{ order_id: 'o1', container_id: 'box-1', barcode_value: '   ' }]
    );

    expect(map.get('o1')?.[0].barcode_value).toBeNull();
    expect(inventoryRepo.findByBarcode).not.toHaveBeenCalled();
  });
});

describe('resolveReceptionPlacements — раскладка по нескольким местам', () => {
  // Триста литровых упаковок в один бокс не помещаются: принятое по заказу
  // разносят по нескольким местам, указывая количество в каждом.

  it('делит принятое между двумя боксами', async () => {
    const { resolve } = makeService();

    const map = await resolve(
      [order('o1')],
      [
        { order_id: 'o1', container_id: 'box-1', quantity: 3 },
        { order_id: 'o1', cell_id: 'cell-1', quantity: 2 },
      ]
    );

    expect(map.get('o1')).toEqual([
      part({ container_id: 'box-1', quantity: 3 }),
      part({ cell_id: 'cell-1', quantity: 2 }),
    ]);
  });

  it('отвергает раскладку сверх принятого', async () => {
    const { resolve } = makeService();

    await expect(
      resolve(
        [order('o1')],
        [
          { order_id: 'o1', container_id: 'box-1', quantity: 4 },
          { order_id: 'o1', cell_id: 'cell-1', quantity: 4 },
        ]
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('требует количество у каждого места, когда мест несколько', async () => {
    const { resolve } = makeService();

    await expect(
      resolve(
        [order('o1')],
        [
          { order_id: 'o1', container_id: 'box-1', quantity: 3 },
          { order_id: 'o1', cell_id: 'cell-1' },
        ]
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отвергает нулевое и отрицательное количество', async () => {
    const { resolve } = makeService();

    await expect(
      resolve([order('o1')], [{ order_id: 'o1', container_id: 'box-1', quantity: 0 }])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('при включённом требовании частичная раскладка не проходит', async () => {
    // Разложили три из пяти — два литра остались бы без места.
    const { resolve } = makeService({ required: true });

    await expect(
      resolve([order('o1')], [{ order_id: 'o1', container_id: 'box-1', quantity: 3 }])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('при включённом требовании полное покрытие частями проходит', async () => {
    const { resolve } = makeService({ required: true });

    const map = await resolve(
      [order('o1')],
      [
        { order_id: 'o1', container_id: 'box-1', quantity: 3 },
        { order_id: 'o1', cell_id: 'cell-1', quantity: 2 },
      ]
    );

    expect(map.get('o1')).toHaveLength(2);
  });
});

describe('splitOrderIntoParts — из чего родятся позиции склада', () => {
  const split = (parts: any[], fact: number) => {
    const service = Object.create(MarketplaceAplReceptionService.prototype) as any;
    return service.splitOrderIntoParts(parts, fact);
  };

  it('без плана — одна позиция на всё принятое', () => {
    expect(split([], 5)).toEqual([
      { container_id: null, cell_id: null, barcode_value: null, quantity: 5 },
    ]);
  });

  it('часть без количества занимает весь заказ', () => {
    expect(split([{ container_id: 'box-1', cell_id: null, barcode_value: null, quantity: null }], 5))
      .toEqual([{ container_id: 'box-1', cell_id: null, barcode_value: null, quantity: 5 }]);
  });

  it('неразложенный остаток становится позицией без места', () => {
    const out = split(
      [{ container_id: 'box-1', cell_id: null, barcode_value: 'L1', quantity: 3 }],
      5
    );

    expect(out).toEqual([
      { container_id: 'box-1', cell_id: null, barcode_value: 'L1', quantity: 3 },
      { container_id: null, cell_id: null, barcode_value: null, quantity: 2 },
    ]);
  });

  it('полное покрытие остатка не порождает', () => {
    const out = split(
      [
        { container_id: 'box-1', cell_id: null, barcode_value: null, quantity: 3 },
        { container_id: null, cell_id: 'cell-1', barcode_value: null, quantity: 2 },
      ],
      5
    );

    expect(out).toHaveLength(2);
  });
});
