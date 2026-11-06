/**
 * Коэффициент экономического участия — цикл ИСТОКА по месяцам (задача 99D-22,
 * КЭУ-4; реестр marketplace.order, случаи mkt.order.keu.cycle.*).
 *
 * Настоящие сервисы учёта обеспечительной части и итога месяца работают поверх
 * подставной цепи (`helpers/keu-world.ts`): она считает эталоном контрактов,
 * ведёт кошельки и отвечает отказами с кодами. Тест проходит то, что вручную
 * не проверить: год роста оборота, сбои посреди прогона, повторы, два участка.
 *
 * Что утверждается:
 *  - в расчёт итога передаются суммы всех заказов прогона, списание идёт только
 *    после рассчитанного итога и по его ставкам;
 *  - с ростом оборота коэффициент экономического участия не растёт, пайщик платит не больше
 *    обеспечительной части заказа;
 *  - после прогона кошельки к списанию пусты, списанное и возвращённое по
 *    каждому заказу равны собранному;
 *  - сбой расчёта, сбой записи зеркала и сбой одной строки не ведут ни к
 *    двойному списанию, ни к списанию без итога;
 *  - итог считается по всем созревшим заказам участка, сколько бы их ни было;
 *    строка, созревшая после расчёта, ждёт следующего первого числа;
 *  - строка с отметкой отправки повторно не списывается, пока сверка с
 *    кошельком в цепи не покажет, что списание не прошло.
 */
jest.mock('@coopenomics/extension-kit', () => {
  const actual = jest.requireActual('@coopenomics/extension-kit');
  return {
    ...actual,
    platformSettings: () => ({ coopname: 'voskhod', timezone: 'Europe/Moscow', frontendUrl: 'https://coop.test' }),
  };
});

import { MarketContract } from 'cooptypes';
import { type IssuedOrder, type KeuWorld, createKeuWorld, dayOf, firstOfMonth, periodOf, rub, toUnits } from './helpers/keu-world';
import { useRealCalendar } from './helpers/real-calendar';

const Model = MarketContract.PeriodModel;
const H = Model.HUNDR_PERCENTS;
/** Ставка обеспечительной части заказов теста: 38 %. */
const X = 380_000n;

const hashOf = (n: number): string => n.toString(16).padStart(64, '0');
const hour = 60 * 60 * 1000;

let nextHash = 1;

/** Заказ на участке: обеспечительная часть — 38 % стоимости. */
function order(username: string, baseRub: number, issuedAt: Date, over: Partial<IssuedOrder> = {}): IssuedOrder {
  const base = rub(baseRub);
  return { hash: hashOf(nextHash++), username, braname: 'branch1', base, due: (base * X) / H, issuedAt, ...over };
}

/** Строка учёта закрыта: остатка нет, списанное и возвращённое равны собранному и совпадают с эталоном по ставкам итога. */
function expectSettled(world: KeuWorld, o: IssuedOrder, period: number): void {
  const row = world.dueRow(o.hash);
  const chain = world.chainPeriod(o.braname, period);
  expect(row).toBeDefined();
  expect(chain).toBeDefined();
  const parts = Model.chargeOrder(chain!.totals, o.due, o.base);
  expect(row!.due_amount).toBe('0.0000');
  expect(row!.charged_at).not.toBeNull();
  expect(toUnits(row!.base_amount)).toBe(o.base);
  expect(toUnits(row!.charged_amount)).toBe(parts.charged);
  expect(toUnits(row!.returned_amount)).toBe(parts.returned);
  expect(toUnits(row!.charged_amount) + toUnits(row!.returned_amount)).toBe(o.due);
}

const sum = (values: bigint[]): bigint => values.reduce((a, b) => a + b, 0n);
const walletTotal = (map: Map<string, bigint>): bigint => sum([...map.values()]);

useRealCalendar();

beforeEach(() => {
  nextHash = 1;
});

describe('mkt.order.keu.cycle.01 — год роста оборота участка при неизменных расходах', () => {
  // Расходы участка 30 000 ₽ в месяц: план 20 000 ₽ и резерв 10 000 ₽, который выплачивается целиком.
  const ORDERS_PER_MONTH = [1, 2, 3, 4, 6, 8, 10, 12, 15, 18, 22, 26];

  it('двенадцать прогонов: суммы всех заказов в расчёте, ставка не растёт, кошельки пусты, деньги сходятся', async () => {
    const world = createKeuWorld();
    world.settings.reserve.set('branch1', rub(10_000));
    for (let month = 1; month <= 12; month++) {
      world.settings.plans.push({ branchName: 'branch1', dueDate: dayOf(2027, month, 20), amount: '20000.0000 RUB' });
      world.settings.aidPaid.set(`branch1/${periodOf(2027, month)}`, rub(10_000));
    }

    let collected = 0n;
    let prevRate = X;
    let economyMonths = 0;

    for (let month = 1; month <= 12; month++) {
      const count = ORDERS_PER_MONTH[month - 1];
      const orders = Array.from({ length: count }, (_, i) => order(`member${(i % 7) + 1}`, 5_000 + 1_000 * i, dayOf(2027, month, 1 + (i % 25))));
      for (const o of orders) await world.issue(o);
      const turnover = sum(orders.map((o) => o.base));
      const secured = sum(orders.map((o) => o.due));
      collected += secured;
      world.notifications.notifyUser.mockClear();

      const next = month === 12 ? firstOfMonth(2028, 1) : firstOfMonth(2027, month + 1);
      const result = await world.run(next);
      expect(result).toEqual({ charged: count, failed: 0 });

      const period = periodOf(2027, month);
      const chain = world.chainPeriod('branch1', period)!;
      expect(chain.facts.turnover).toBe(turnover);
      expect(chain.facts.secured).toBe(secured);
      expect(chain.facts.planned).toBe(rub(20_000));
      expect(chain.facts.aidPaid).toBe(rub(10_000));
      expect(chain.totals.expenses).toBe(rub(30_000));

      for (const o of orders) expectSettled(world, o, period);
      expect(walletTotal(world.wallets.due)).toBe(0n);

      const rate = Model.chargeRate(chain.totals);
      expect(rate <= X).toBe(true);
      expect(rate <= prevRate).toBe(true);
      if (chain.totals.deficit > 0n) {
        expect(rate).toBe(X);
      } else {
        economyMonths++;
        expect(chain.totals.branch).toBe(rub(30_000));
        expect(rate < X).toBe(true);
      }
      prevRate = rate;

      const mirror = await world.periodService.findOne('voskhod', 'branch1', period);
      expect(mirror).toMatchObject({ rows_total: count, rows_charged: count });
      expect(world.periods.filter((p) => p.braname === 'branch1').length).toBeLessThanOrEqual(2);
      expect(world.notifications.notifyUser).toHaveBeenCalledTimes(new Set(orders.map((o) => o.username)).size);
    }

    expect(economyMonths).toBeGreaterThanOrEqual(5);
    expect(prevRate < 300_000n).toBe(true);
    // Собранное за год разошлось без остатка: участку, в фонды, инициатору и обратно пайщикам.
    const distributed = walletTotal(world.wallets.branch) + world.wallets.funds + walletTotal(world.wallets.invest) + walletTotal(world.wallets.share);
    expect(distributed).toBe(collected);
    expect(walletTotal(world.wallets.share) > 0n).toBe(true);
    expect(world.logger.error).not.toHaveBeenCalled();
  });

  it('пайщик с одинаковым заказом в малом и в большом месяце: во втором списано меньше, возврат больше', async () => {
    const world = createKeuWorld();
    world.settings.plans.push(
      { branchName: 'branch1', dueDate: dayOf(2027, 1, 20), amount: '30000.0000 RUB' },
      { branchName: 'branch1', dueDate: dayOf(2027, 2, 20), amount: '30000.0000 RUB' }
    );
    const small = [order('anna', 10_000, dayOf(2027, 1, 5)), order('boris', 90_000, dayOf(2027, 1, 6))];
    for (const o of small) await world.issue(o);
    await world.run(firstOfMonth(2027, 2));

    const large = [order('anna', 10_000, dayOf(2027, 2, 5)), ...Array.from({ length: 9 }, (_, i) => order(`m${i}`, 100_000, dayOf(2027, 2, 7 + i)))];
    for (const o of large) await world.issue(o);
    await world.run(firstOfMonth(2027, 3));

    const january = world.dueRow(small[0].hash)!;
    const february = world.dueRow(large[0].hash)!;
    expect(toUnits(february.charged_amount) < toUnits(january.charged_amount)).toBe(true);
    expect(toUnits(february.returned_amount) > toUnits(january.returned_amount)).toBe(true);
    expect(toUnits(january.charged_amount) <= small[0].due).toBe(true);
  });
});

describe('mkt.order.keu.cycle.02 — операции одной транзакции приходят слушателю разом', () => {
  it('выдача: стоимость и постановка к списанию одним блоком — строка получает обе суммы', async () => {
    const world = createKeuWorld();
    const o = order('anna', 10_000, dayOf(2027, 1, 5));
    await world.issue(o);
    const row = world.dueRow(o.hash)!;
    expect(toUnits(row.base_amount)).toBe(o.base);
    expect(toUnits(row.due_amount)).toBe(o.due);
    expect(world.logger.error).not.toHaveBeenCalled();
  });

  it('списание по итогу: списанная и возвращённая части одним блоком — остаток ноль, обе части учтены', async () => {
    const world = createKeuWorld();
    const orders = [order('anna', 10_000, dayOf(2027, 1, 5)), order('boris', 500_000, dayOf(2027, 1, 6))];
    world.settings.plans.push({ branchName: 'branch1', dueDate: dayOf(2027, 1, 20), amount: '30000.0000 RUB' });
    for (const o of orders) await world.issue(o);
    await world.run(firstOfMonth(2027, 2));
    for (const o of orders) expectSettled(world, o, periodOf(2027, 1));
    expect(toUnits(world.dueRow(orders[0].hash)!.returned_amount) > 0n).toBe(true);
  });
});

describe('mkt.order.keu.cycle.03 — сбой расчёта итога: списания без итога нет', () => {
  async function monthWithThreeOrders() {
    const world = createKeuWorld();
    world.settings.plans.push({ branchName: 'branch1', dueDate: dayOf(2027, 1, 20), amount: '5000.0000 RUB' });
    const orders = [order('anna', 10_000, dayOf(2027, 1, 5)), order('boris', 20_000, dayOf(2027, 1, 6)), order('anna', 30_000, dayOf(2027, 1, 7))];
    for (const o of orders) await world.issue(o);
    return { world, orders, collected: sum(orders.map((o) => o.due)) };
  }

  it('цепь отказала в расчёте: ни одна строка не списана, кошельки целы; следующий проход считает и списывает всё', async () => {
    const { world, orders, collected } = await monthWithThreeOrders();
    world.faults.closePeriod.push(new Error('connect ECONNREFUSED'));

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 0, failed: 3 });
    expect(world.calls.chargePeriod).toHaveLength(0);
    expect(walletTotal(world.wallets.due)).toBe(collected);
    expect(world.periods).toHaveLength(0);
    expect(world.notifications.notifyUser).not.toHaveBeenCalled();

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 3, failed: 0 });
    for (const o of orders) expectSettled(world, o, periodOf(2027, 1));
    expect(world.calls.closePeriod).toHaveLength(2);
    expect(world.periods).toHaveLength(1);
  });

  it('факты месяца не собраны (реестр плановых расходов недоступен): расчёт в цепь не отправляется, списания нет', async () => {
    const { world, collected } = await monthWithThreeOrders();
    world.faults.plans.push(new Error('expense chassis timeout'));

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 0, failed: 3 });
    expect(world.calls.closePeriod).toHaveLength(0);
    expect(world.calls.chargePeriod).toHaveLength(0);
    expect(walletTotal(world.wallets.due)).toBe(collected);

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 3, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 1))!.facts.planned).toBe(rub(5_000));
  });

  it('итог рассчитан в цепи, а зеркало не записалось: следующий проход читает строку цепи, второго расчёта нет', async () => {
    const { world, orders } = await monthWithThreeOrders();
    world.periodStore.failNextInsert = new Error('connection terminated');

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 0, failed: 3 });
    expect(world.periods).toHaveLength(1);
    const ratesBefore = { ...world.periods[0].totals };

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 3, failed: 0 });
    expect(world.periods).toHaveLength(1);
    expect(world.periods[0].totals).toEqual(ratesBefore);
    for (const o of orders) expectSettled(world, o, periodOf(2027, 1));
  });

  it('повторный проход в том же месяце: расчёта и списаний больше нет', async () => {
    const { world } = await monthWithThreeOrders();
    await world.run(firstOfMonth(2027, 2));
    const closes = world.calls.closePeriod.length;
    const charges = world.calls.chargePeriod.length;
    for (let i = 1; i <= 5; i++) {
      expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + i * hour))).toEqual({ charged: 0, failed: 0 });
    }
    expect(world.calls.closePeriod).toHaveLength(closes);
    expect(world.calls.chargePeriod).toHaveLength(charges);
  });

  it('первый проход опоздал на трое суток: итог считается за закончившийся месяц, все заказы списаны', async () => {
    const { world, orders } = await monthWithThreeOrders();
    expect(await world.run(dayOf(2027, 2, 4))).toEqual({ charged: 3, failed: 0 });
    for (const o of orders) expectSettled(world, o, periodOf(2027, 1));
  });
});

describe('mkt.order.keu.cycle.04 — сбой списания одной строки и отметка отправки', () => {
  async function threeOrders() {
    const world = createKeuWorld();
    world.settings.plans.push({ branchName: 'branch1', dueDate: dayOf(2027, 1, 20), amount: '5000.0000 RUB' });
    const orders = [order('anna', 10_000, dayOf(2027, 1, 5)), order('boris', 20_000, dayOf(2027, 1, 6)), order('vera', 30_000, dayOf(2027, 1, 7))];
    for (const o of orders) await world.issue(o);
    return { world, orders };
  }

  it('узел цепи не ответил на списание строки: остальные списаны; сверка видит деньги на кошельке, и следующий проход списывает строку по тем же ставкам', async () => {
    const { world, orders } = await threeOrders();
    world.faults.chargePeriod.set(orders[1].hash, [new Error('transaction net usage is too high')]);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 2, failed: 1 });
    expect(world.wallets.due.get('boris')).toBe(orders[1].due);
    // Исход отправки неизвестен: отметка остаётся до сверки.
    expect(world.dueRow(orders[1].hash)).toMatchObject({ due_amount: '7600.0000' });
    expect(world.dueRow(orders[1].hash)!.charge_sent_at).toBeInstanceOf(Date);
    expect(world.notifications.notifyUser).toHaveBeenCalledTimes(2);

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 1, failed: 0 });
    for (const o of orders) expectSettled(world, o, periodOf(2027, 1));
    expect(world.calls.closePeriod).toHaveLength(1);
    expect(walletTotal(world.wallets.due)).toBe(0n);
    expect(await world.periodService.findOne('voskhod', 'branch1', periodOf(2027, 1))).toMatchObject({ rows_total: 3, rows_charged: 3 });
  });

  it('контракт отклонил списание строки: отметка снимается сразу, сверка с цепью не нужна, следующий проход повторяет', async () => {
    const { world, orders } = await threeOrders();
    world.faults.chargePeriod.set(orders[1].hash, [new Error('assertion failure with message: MARKETPLACE_PERIOD_NOT_CLOSED: Итог участка за период не рассчитан')]);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 2, failed: 1 });
    expect(world.dueRow(orders[1].hash)!.charge_sent_at ?? null).toBeNull();

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 1, failed: 0 });
    expect(world.calls.getUserWallet).toHaveLength(0);
    for (const o of orders) expectSettled(world, o, periodOf(2027, 1));
  });

  it('операции списания не дошли до учёта, других заказов у пайщика нет: повторной отправки нет, в журнале тревога о расхождении с кошельком', async () => {
    const world = createKeuWorld();
    const o = order('anna', 10_000, dayOf(2027, 1, 5));
    await world.issue(o);
    world.faults.lostEvents.add(o.hash);

    await world.run(firstOfMonth(2027, 2));
    const afterFirst = { branch: walletTotal(world.wallets.branch), share: walletTotal(world.wallets.share) };
    expect(world.wallets.due.get('anna')).toBe(0n);

    for (let i = 1; i <= 3; i++) {
      expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + i * hour))).toEqual({ charged: 0, failed: 0 });
    }
    expect(world.calls.chargePeriod.filter((c) => c.order_hash === o.hash)).toHaveLength(1);
    expect(walletTotal(world.wallets.branch)).toBe(afterFirst.branch);
    expect(walletTotal(world.wallets.share)).toBe(afterFirst.share);
    expect(world.logger.error).toHaveBeenCalledWith(expect.stringContaining('разошёлся с кошельком в цепи'));
  });

  it('операции списания не дошли до учёта, у пайщика есть второй заказ: заказ не списывается дважды, деньги второго заказа целы', async () => {
    const world = createKeuWorld();
    const ripe = order('anna', 10_000, dayOf(2027, 1, 5));
    const later = order('anna', 50_000, dayOf(2027, 2, 2));
    await world.issue(ripe);
    await world.issue(later);
    world.faults.lostEvents.add(ripe.hash);

    await world.run(firstOfMonth(2027, 2));
    expect(world.wallets.due.get('anna')).toBe(later.due);

    await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour));
    expect(world.calls.chargePeriod.filter((c) => c.order_hash === ripe.hash)).toHaveLength(1);
    expect(world.wallets.due.get('anna')).toBe(later.due);
    expect(world.logger.error).toHaveBeenCalledWith(expect.stringContaining('разошёлся с кошельком в цепи'));
    // Второй заказ в свой месяц списывается целиком из своей обеспечительной части.
    await world.run(firstOfMonth(2027, 3));
    expect(world.calls.chargePeriod.filter((c) => c.order_hash === later.hash)).toHaveLength(1);
    expectSettled(world, later, periodOf(2027, 2));
    expect(world.wallets.due.get('anna')).toBe(0n);
  });

  it('кошелёк в цепи при сверке не прочитан: отметка остаётся, строка ждёт следующей сверки', async () => {
    const { world, orders } = await threeOrders();
    world.faults.chargePeriod.set(orders[0].hash, [new Error('socket hang up')]);
    await world.run(firstOfMonth(2027, 2));
    world.faults.walletRead.push(new Error('connect ECONNREFUSED'));

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 0, failed: 0 });
    expect(world.dueRow(orders[0].hash)!.charge_sent_at).toBeInstanceOf(Date);

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + 2 * hour))).toEqual({ charged: 1, failed: 0 });
    for (const o of orders) expectSettled(world, o, periodOf(2027, 1));
  });
});

describe('mkt.order.keu.cycle.05 — какие строки входят в прогон', () => {
  it('два участка: у каждого свой итог по своим заказам и свои ставки; пайщик с заказами на обоих списан по ставке каждого', async () => {
    const world = createKeuWorld();
    world.settings.plans.push(
      { branchName: 'branch1', dueDate: dayOf(2027, 1, 20), amount: '1000.0000 RUB' },
      { branchName: 'branch2', dueDate: dayOf(2027, 1, 20), amount: '900000.0000 RUB' }
    );
    const first = [order('anna', 100_000, dayOf(2027, 1, 5)), order('boris', 200_000, dayOf(2027, 1, 6))];
    const second = [order('anna', 100_000, dayOf(2027, 1, 7), { braname: 'branch2' }), order('vera', 50_000, dayOf(2027, 1, 8), { braname: 'branch2' })];
    for (const o of [...first, ...second]) await world.issue(o);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 4, failed: 0 });
    const p = periodOf(2027, 1);
    expect(world.chainPeriod('branch1', p)!.facts.turnover).toBe(sum(first.map((o) => o.base)));
    expect(world.chainPeriod('branch2', p)!.facts.turnover).toBe(sum(second.map((o) => o.base)));
    expect(world.chainPeriod('branch1', p)!.totals.deficit).toBe(0n);
    expect(world.chainPeriod('branch2', p)!.totals.deficit > 0n).toBe(true);
    for (const o of [...first, ...second]) expectSettled(world, o, p);
    // Одинаковые заказы одной пайщицы: на участке с экономией возврат есть, на участке с дефицитом — нет.
    expect(toUnits(world.dueRow(first[0].hash)!.returned_amount) > 0n).toBe(true);
    expect(toUnits(world.dueRow(second[0].hash)!.returned_amount)).toBe(0n);
    expect(world.wallets.branch.get('branch2')).toBe(sum(second.map((o) => o.due)));
  });

  it('заказ с гарантией до следующего месяца в прогон не входит и списывается в прогоне своего месяца', async () => {
    const world = createKeuWorld();
    const ripe = order('anna', 10_000, dayOf(2027, 1, 5));
    const guarded = order('boris', 20_000, dayOf(2027, 1, 20), { warrantyUntil: dayOf(2027, 2, 3) });
    await world.issue(ripe);
    await world.issue(guarded);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 1, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 1))!.facts.turnover).toBe(ripe.base);
    expect(world.wallets.due.get('boris')).toBe(guarded.due);
    // Весь февраль строка ждёт: гарантия кончилась, но месяц ещё не сменился.
    expect(await world.run(dayOf(2027, 2, 15))).toEqual({ charged: 0, failed: 0 });

    expect(await world.run(firstOfMonth(2027, 3))).toEqual({ charged: 1, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 2))!.facts.turnover).toBe(guarded.base);
    expectSettled(world, guarded, periodOf(2027, 2));
  });

  it('заказ с открытым гарантийным возвратом в расчёт итога не входит и не списывается', async () => {
    const world = createKeuWorld();
    const plain = order('anna', 10_000, dayOf(2027, 1, 5));
    const disputed = order('boris', 20_000, dayOf(2027, 1, 6));
    await world.issue(plain);
    await world.issue(disputed);
    world.settings.openClaims.add(disputed.hash);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 1, failed: 0 });
    const chain = world.chainPeriod('branch1', periodOf(2027, 1))!;
    expect(chain.facts.turnover).toBe(plain.base);
    expect(chain.facts.secured).toBe(plain.due);
    expect(world.wallets.due.get('boris')).toBe(disputed.due);
    expect(world.calls.chargePeriod.some((c) => c.order_hash === disputed.hash)).toBe(false);
  });

  it('удержание при отказе: в расчёт итога не входит, списывается целиком участку прежним действием', async () => {
    const world = createKeuWorld();
    const o = order('anna', 10_000, dayOf(2027, 1, 5));
    await world.issue(o);
    await world.penalize({ hash: hashOf(900), username: 'boris', braname: 'branch1', due: rub(500), issuedAt: dayOf(2027, 1, 9) });

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 2, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 1))!.facts.turnover).toBe(o.base);
    expect(world.calls.chargeDue).toEqual([expect.objectContaining({ order_hash: hashOf(900), amount: '500.0000 RUB' })]);
    expect(world.dueRow(hashOf(900))).toMatchObject({ due_amount: '0.0000', charged_amount: '500.0000', returned_amount: '0.0000' });
  });

  it('месяц без заказов: расчёта нет; следующий месяц с заказами считается, в цепи не больше двух строк участка', async () => {
    const world = createKeuWorld();
    await world.issue(order('anna', 10_000, dayOf(2027, 1, 5)));
    await world.run(firstOfMonth(2027, 2));
    expect(await world.run(firstOfMonth(2027, 3))).toEqual({ charged: 0, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 2))).toBeUndefined();

    const march = order('anna', 10_000, dayOf(2027, 3, 5));
    await world.issue(march);
    expect(await world.run(firstOfMonth(2027, 4))).toEqual({ charged: 1, failed: 0 });
    expectSettled(world, march, periodOf(2027, 3));
    expect(world.periods.filter((p) => p.braname === 'branch1').length).toBeLessThanOrEqual(2);
  });

  it('гарантийный возврат закрыт в середине месяца: заказ ждёт следующего первого числа и входит в расчёт того итога, по которому списывается', async () => {
    const world = createKeuWorld();
    const plain = order('anna', 10_000, dayOf(2027, 1, 5));
    const disputed = order('boris', 20_000, dayOf(2027, 1, 6));
    await world.issue(plain);
    await world.issue(disputed);
    world.settings.openClaims.add(disputed.hash);
    await world.run(firstOfMonth(2027, 2));

    // Совет отклонил возврат 10 февраля: итог января уже рассчитан без этого заказа.
    world.settings.openClaims.delete(disputed.hash);
    expect(await world.run(dayOf(2027, 2, 10))).toEqual({ charged: 0, failed: 0 });
    expect(await world.run(dayOf(2027, 2, 27))).toEqual({ charged: 0, failed: 0 });
    expect(world.wallets.due.get('boris')).toBe(disputed.due);
    expect(world.chainPeriod('branch1', periodOf(2027, 1))!.facts.turnover).toBe(plain.base);
    expect((await world.periodService.findOne('voskhod', 'branch1', periodOf(2027, 1)))!.rows_total).toBe(1);

    // Первого марта заказ входит в прогон февраля вместе с февральскими заказами.
    const february = order('vera', 30_000, dayOf(2027, 2, 12));
    await world.issue(february);
    expect(await world.run(firstOfMonth(2027, 3))).toEqual({ charged: 2, failed: 0 });
    const chain = world.chainPeriod('branch1', periodOf(2027, 2))!;
    expect(chain.facts.turnover).toBe(disputed.base + february.base);
    expect(chain.facts.secured).toBe(disputed.due + february.due);
    expectSettled(world, disputed, periodOf(2027, 2));
    expectSettled(world, february, periodOf(2027, 2));
  });

  it('гарантийный возврат открыт после неудачного расчёта итога: при повторе расчёта заказ из списка прогона исключается', async () => {
    const world = createKeuWorld();
    const plain = order('anna', 10_000, dayOf(2027, 1, 5));
    const disputed = order('boris', 20_000, dayOf(2027, 1, 6));
    await world.issue(plain);
    await world.issue(disputed);
    world.faults.closePeriod.push(new Error('connect ECONNREFUSED'));
    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 0, failed: 2 });

    world.settings.openClaims.add(disputed.hash);
    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 1, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 1))!.facts.turnover).toBe(plain.base);
    expect(world.dueRow(disputed.hash)!.run_period ?? null).toBeNull();
    expect(world.wallets.due.get('boris')).toBe(disputed.due);
  });

  it('строка не списалась за весь месяц: первого числа следующего месяца она входит в новый прогон и его расчёт', async () => {
    const world = createKeuWorld();
    const stuck = order('anna', 10_000, dayOf(2027, 1, 5));
    await world.issue(stuck);
    world.faults.chargePeriod.set(stuck.hash, Array.from({ length: 3 }, () => new Error('assertion failure with message: MARKETPLACE_DUE_AMOUNT_INVALID: проверка')));
    for (let i = 0; i < 3; i++) await world.run(new Date(firstOfMonth(2027, 2).getTime() + i * hour));
    expect(world.dueRow(stuck.hash)!.run_period).toBe(periodOf(2027, 1));

    const february = order('boris', 20_000, dayOf(2027, 2, 12));
    await world.issue(february);
    expect(await world.run(firstOfMonth(2027, 3))).toEqual({ charged: 2, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 2))!.facts.turnover).toBe(stuck.base + february.base);
    expectSettled(world, stuck, periodOf(2027, 2));
  });

  it('двести пятьдесят созревших заказов: итог считается по всем, проход отправляет двести списаний, следующий — остальные по тем же ставкам', async () => {
    const world = createKeuWorld();
    const orders = Array.from({ length: 250 }, (_, i) => order(`member${i % 40}`, 1_000 + i, dayOf(2027, 1, 1 + (i % 28))));
    for (const o of orders) await world.issue(o);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 200, failed: 0 });
    expect(world.calls.closePeriod).toHaveLength(1);
    expect(toUnits(world.calls.closePeriod[0].turnover)).toBe(sum(orders.map((o) => o.base)));
    expect(toUnits(world.calls.closePeriod[0].secured)).toBe(sum(orders.map((o) => o.due)));
    expect((await world.periodService.findOne('voskhod', 'branch1', periodOf(2027, 1)))!.rows_total).toBe(250);

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 50, failed: 0 });
    expect(world.calls.closePeriod).toHaveLength(1);
    for (const o of orders) expectSettled(world, o, periodOf(2027, 1));
    expect(walletTotal(world.wallets.due)).toBe(0n);
    expect(await world.periodService.findOne('voskhod', 'branch1', periodOf(2027, 1))).toMatchObject({ rows_total: 250, rows_charged: 250 });
  });
});
