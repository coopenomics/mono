/**
 * Коэффициент экономического участия — цикл ИСТОКА по периодам (задачи 99D-22,
 * 99D-33; реестр marketplace.order, случаи mkt.order.keu.cycle.*).
 *
 * Настоящие сервисы учёта обеспечительной части и итога периода работают поверх
 * подставной цепи (`helpers/keu-world.ts`): она ведёт счётчики списания, как
 * контракт, считает итог и деление эталоном контрактов, ведёт кошельки и
 * отвечает отказами с кодами. Тест проходит то, что вручную не проверить: год
 * роста оборота, сбои посреди прогона, повторы, два участка.
 *
 * Что утверждается:
 *  - итог считается по счётчику участка в цепи (все выданные заказы периода),
 *    узел не передаёт в цепь ни одной суммы; списание идёт только после
 *    рассчитанного итога и по его ставкам, одной транзакцией на пайщика;
 *  - с ростом оборота коэффициент экономического участия не растёт, пайщик
 *    платит не больше обеспечительной части заказа;
 *  - после прогона кошельки к списанию пусты, списанное и возвращённое по
 *    каждому заказу равны собранному;
 *  - сбой расчёта, сбой записи зеркала и сбой одной строки не ведут ни к
 *    двойному списанию, ни к списанию без итога: строка счётчика в цепи либо
 *    есть, либо списана — повторить списание нечем;
 *  - заказ пайщика с открытым гарантийным возвратом ждёт решения совета и
 *    списывается по ставкам своего периода.
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

/** Строка зеркала закрыта: остатка нет, списанное и возвращённое вместе равны собранному. */
function expectSettled(world: KeuWorld, o: IssuedOrder): void {
  const row = world.dueRow(o.hash);
  expect(row).toBeDefined();
  expect(row!.due_amount).toBe('0.0000');
  expect(row!.charged_at).not.toBeNull();
  expect(toUnits(row!.base_amount)).toBe(o.base);
  expect(toUnits(row!.charged_amount) + toUnits(row!.returned_amount)).toBe(o.due);
}

/**
 * Заказы пайщика на участке за период списаны одной строкой счётчика: строки в
 * цепи нет, сумма списанного по заказам равна делению строки эталоном по
 * ставкам итога.
 */
function expectMemberSettled(world: KeuWorld, orders: IssuedOrder[], period: number): void {
  const { username, braname } = orders[0];
  expect(world.chainDue(username, braname, period)).toBeUndefined();
  const chain = world.chainPeriod(braname, period)!;
  expect(chain).toBeDefined();
  const parts = Model.chargeRow(chain.totals, sum(orders.map((o) => o.due)), sum(orders.map((o) => o.base)), 0n);
  const rows = orders.map((o) => world.dueRow(o.hash)!);
  expect(sum(rows.map((r) => toUnits(r.charged_amount)))).toBe(parts.charged);
  expect(sum(rows.map((r) => toUnits(r.returned_amount)))).toBe(parts.returned);
  for (const o of orders) expectSettled(world, o);
}

/** Заказы по пайщикам и участкам: сколько строк счётчиков (транзакций списания) предстоит. */
function byMember(orders: IssuedOrder[]): IssuedOrder[][] {
  const groups = new Map<string, IssuedOrder[]>();
  for (const o of orders) {
    const key = `${o.username}/${o.braname}`;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  return [...groups.values()];
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

  it('двенадцать прогонов: итог по счётчику участка, ставка не растёт, кошельки пусты, деньги сходятся', async () => {
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
      const groups = byMember(orders);

      const next = month === 12 ? firstOfMonth(2028, 1) : firstOfMonth(2027, month + 1);
      const result = await world.run(next);
      expect(result).toEqual({ charged: groups.length, failed: 0 });

      const period = periodOf(2027, month);
      const chain = world.chainPeriod('branch1', period)!;
      expect(chain.facts.turnover).toBe(turnover);
      expect(chain.facts.secured).toBe(secured);
      expect(chain.facts.planned).toBe(rub(20_000));
      expect(chain.facts.aidPaid).toBe(rub(10_000));
      expect(chain.totals.expenses).toBe(rub(30_000));
      // Узел не передал в цепь ни стоимости, ни собранного — только факты о расходах.
      expect(Object.keys(world.calls.closePeriod[world.calls.closePeriod.length - 1]).sort()).toEqual(['aid_paid', 'braname', 'coopname', 'memos', 'period', 'planned']);

      for (const group of groups) expectMemberSettled(world, group, period);
      expect(walletTotal(world.wallets.due)).toBe(0n);
      expect(world.chainCounter('branch1', period)).toBeUndefined();

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
      expect(mirror).toMatchObject({ rows_total: groups.length, rows_charged: groups.length });
      expect(world.periods.filter((p) => p.braname === 'branch1').length).toBeLessThanOrEqual(2);
      expect(world.notifications.notifyUser).toHaveBeenCalledTimes(groups.length);
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
  it('выдача: стоимость и постановка к списанию одним блоком — строка получает обе суммы, счётчики цепи пополнены', async () => {
    const world = createKeuWorld();
    const o = order('anna', 10_000, dayOf(2027, 1, 5));
    await world.issue(o);
    const row = world.dueRow(o.hash)!;
    expect(toUnits(row.base_amount)).toBe(o.base);
    expect(toUnits(row.due_amount)).toBe(o.due);
    expect(world.chainDue('anna', 'branch1', periodOf(2027, 1))).toMatchObject({ turnover: o.base, due: o.due, orders: 1 });
    expect(world.chainCounter('branch1', periodOf(2027, 1))).toMatchObject({ turnover: o.base, secured: o.due, members: 1 });
    expect(world.logger.error).not.toHaveBeenCalled();
  });

  it('списание строки счётчика: списанная и возвращённая части одним блоком закрывают все заказы пайщика за период', async () => {
    const world = createKeuWorld();
    const orders = [order('anna', 10_000, dayOf(2027, 1, 5)), order('anna', 20_000, dayOf(2027, 1, 9)), order('boris', 500_000, dayOf(2027, 1, 6))];
    world.settings.plans.push({ branchName: 'branch1', dueDate: dayOf(2027, 1, 20), amount: '30000.0000 RUB' });
    for (const o of orders) await world.issue(o);
    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 2, failed: 0 });
    expectMemberSettled(world, orders.slice(0, 2), periodOf(2027, 1));
    expectMemberSettled(world, orders.slice(2), periodOf(2027, 1));
    expect(toUnits(world.dueRow(orders[0].hash)!.returned_amount) > 0n).toBe(true);
    // Одна транзакция на пайщика, не на заказ.
    expect(world.calls.chargePeriod).toHaveLength(2);
    expect(world.calls.chargePeriod[0]).toEqual({ coopname: 'voskhod', username: 'anna', braname: 'branch1', period: periodOf(2027, 1) });
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

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 0, failed: 2 });
    expect(world.calls.chargePeriod).toHaveLength(0);
    expect(walletTotal(world.wallets.due)).toBe(collected);
    expect(world.periods).toHaveLength(0);
    expect(world.notifications.notifyUser).not.toHaveBeenCalled();

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 2, failed: 0 });
    for (const group of byMember(orders)) expectMemberSettled(world, group, periodOf(2027, 1));
    expect(world.calls.closePeriod).toHaveLength(2);
    expect(world.periods).toHaveLength(1);
  });

  it('факты месяца не собраны (реестр плановых расходов недоступен): расчёт в цепь не отправляется, списания нет', async () => {
    const { world, collected } = await monthWithThreeOrders();
    world.faults.plans.push(new Error('expense chassis timeout'));

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 0, failed: 2 });
    expect(world.calls.closePeriod).toHaveLength(0);
    expect(world.calls.chargePeriod).toHaveLength(0);
    expect(walletTotal(world.wallets.due)).toBe(collected);

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 2, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 1))!.facts.planned).toBe(rub(5_000));
  });

  it('итог рассчитан в цепи, а зеркало не записалось: строки списываются по строке цепи в том же проходе, второго расчёта нет', async () => {
    const { world, orders } = await monthWithThreeOrders();
    world.periodStore.failNextInsert = new Error('connection terminated');

    // Цепь — источник истины: итог в ней есть, списание идёт по его ставкам, зеркало дописывается по строке цепи.
    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 2, failed: 0 });
    expect(world.periods).toHaveLength(1);
    expect(world.calls.closePeriod).toHaveLength(1);
    const ratesBefore = { ...world.periods[0].totals };
    for (const group of byMember(orders)) expectMemberSettled(world, group, periodOf(2027, 1));
    expect(await world.periodService.findOne('voskhod', 'branch1', periodOf(2027, 1))).toMatchObject({ rows_charged: 2 });

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 0, failed: 0 });
    expect(world.periods).toHaveLength(1);
    expect(world.calls.closePeriod).toHaveLength(1);
    expect(world.periods[0].totals).toEqual(ratesBefore);
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
    expect(await world.run(dayOf(2027, 2, 4))).toEqual({ charged: 2, failed: 0 });
    for (const group of byMember(orders)) expectMemberSettled(world, group, periodOf(2027, 1));
  });

  it('до конца периода контракт не считает и не списывает: проход в последний день месяца пуст', async () => {
    const { world, collected } = await monthWithThreeOrders();
    expect(await world.run(new Date('2027-01-31T23:30:00.000Z'))).toEqual({ charged: 0, failed: 0 });
    expect(world.calls.closePeriod).toHaveLength(0);
    expect(world.calls.chargePeriod).toHaveLength(0);
    expect(walletTotal(world.wallets.due)).toBe(collected);
  });
});

describe('mkt.order.keu.cycle.04 — сбой списания одной строки', () => {
  async function threeOrders() {
    const world = createKeuWorld();
    world.settings.plans.push({ branchName: 'branch1', dueDate: dayOf(2027, 1, 20), amount: '5000.0000 RUB' });
    const orders = [order('anna', 10_000, dayOf(2027, 1, 5)), order('boris', 20_000, dayOf(2027, 1, 6)), order('vera', 30_000, dayOf(2027, 1, 7))];
    for (const o of orders) await world.issue(o);
    return { world, orders };
  }

  it('узел цепи не ответил на списание строки: остальные списаны; следующий проход списывает строку по тем же ставкам, без повторного расчёта', async () => {
    const { world, orders } = await threeOrders();
    world.faults.chargePeriod.set('boris', [new Error('transaction net usage is too high')]);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 2, failed: 1 });
    expect(world.wallets.due.get('boris')).toBe(orders[1].due);
    expect(world.chainDue('boris', 'branch1', periodOf(2027, 1))).toBeDefined();
    expect(world.dueRow(orders[1].hash)).toMatchObject({ due_amount: '7600.0000' });
    expect(world.notifications.notifyUser).toHaveBeenCalledTimes(2);

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 1, failed: 0 });
    for (const group of byMember(orders)) expectMemberSettled(world, group, periodOf(2027, 1));
    expect(world.calls.closePeriod).toHaveLength(1);
    expect(walletTotal(world.wallets.due)).toBe(0n);
    expect(await world.periodService.findOne('voskhod', 'branch1', periodOf(2027, 1))).toMatchObject({ rows_total: 3, rows_charged: 3 });
  });

  it('контракт отклонил списание строки: строка остаётся в цепи, следующий проход повторяет', async () => {
    const { world, orders } = await threeOrders();
    world.faults.chargePeriod.set('boris', [new Error('assertion failure with message: MARKETPLACE_PERIOD_NOT_CLOSED: Итог участка за период не рассчитан')]);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 2, failed: 1 });
    expect(world.logger.warn).toHaveBeenCalledWith(expect.stringContaining('итога в цепи нет'));

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 1, failed: 0 });
    for (const group of byMember(orders)) expectMemberSettled(world, group, periodOf(2027, 1));
  });

  it('операции списания не дошли до зеркала: строки счётчика в цепи уже нет, повторного списания нет, деньги распределены один раз', async () => {
    const world = createKeuWorld();
    const o = order('anna', 10_000, dayOf(2027, 1, 5));
    await world.issue(o);
    world.faults.lostEvents.add('anna');

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 1, failed: 0 });
    const afterFirst = { branch: walletTotal(world.wallets.branch), share: walletTotal(world.wallets.share) };
    expect(world.wallets.due.get('anna')).toBe(0n);
    // Зеркало заказа отстало: цепь — источник истины, письмо и итог считаются по её операциям.
    expect(world.dueRow(o.hash)!.due_amount).toBe('3800.0000');
    expect(world.notifications.notifyUser).toHaveBeenCalledTimes(1);

    for (let i = 1; i <= 3; i++) {
      expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + i * hour))).toEqual({ charged: 0, failed: 0 });
    }
    expect(world.calls.chargePeriod.filter((c) => c.username === 'anna')).toHaveLength(1);
    expect(walletTotal(world.wallets.branch)).toBe(afterFirst.branch);
    expect(walletTotal(world.wallets.share)).toBe(afterFirst.share);
  });

  it('у пайщика есть второй заказ следующего периода: списание первого его не трогает, второй списывается в свой период', async () => {
    const world = createKeuWorld();
    const ripe = order('anna', 10_000, dayOf(2027, 1, 5));
    const later = order('anna', 50_000, dayOf(2027, 2, 2));
    await world.issue(ripe);
    await world.issue(later);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 1, failed: 0 });
    expect(world.wallets.due.get('anna')).toBe(later.due);
    expect(world.chainDue('anna', 'branch1', periodOf(2027, 2))).toMatchObject({ due: later.due });
    expectMemberSettled(world, [ripe], periodOf(2027, 1));

    expect(await world.run(firstOfMonth(2027, 3))).toEqual({ charged: 1, failed: 0 });
    expectMemberSettled(world, [later], periodOf(2027, 2));
    expect(world.wallets.due.get('anna')).toBe(0n);
  });
});

describe('mkt.order.keu.cycle.05 — какие строки входят в прогон', () => {
  it('два участка: у каждого свой итог по своему счётчику и свои ставки; пайщик с заказами на обоих списан по ставке каждого', async () => {
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
    for (const group of [...byMember(first), ...byMember(second)]) expectMemberSettled(world, group, p);
    // Одинаковые заказы одной пайщицы: на участке с экономией возврат есть, на участке с дефицитом — нет.
    expect(toUnits(world.dueRow(first[0].hash)!.returned_amount) > 0n).toBe(true);
    expect(toUnits(world.dueRow(second[0].hash)!.returned_amount)).toBe(0n);
    expect(world.wallets.branch.get('branch2')).toBe(sum(second.map((o) => o.due)));
  });

  it('заказ с гарантией до следующего месяца стоит в счётчике своего периода и списывается в его прогоне', async () => {
    const world = createKeuWorld();
    const ripe = order('anna', 10_000, dayOf(2027, 1, 5));
    const guarded = order('boris', 20_000, dayOf(2027, 1, 20), { warrantyUntil: dayOf(2027, 2, 3) });
    await world.issue(ripe);
    await world.issue(guarded);
    expect(world.chainCounter('branch1', periodOf(2027, 2))).toMatchObject({ turnover: guarded.base, members: 1 });

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 1, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 1))!.facts.turnover).toBe(ripe.base);
    expect(world.wallets.due.get('boris')).toBe(guarded.due);
    // Весь февраль строка ждёт: гарантия кончилась, но период ещё не сменился.
    expect(await world.run(dayOf(2027, 2, 15))).toEqual({ charged: 0, failed: 0 });

    expect(await world.run(firstOfMonth(2027, 3))).toEqual({ charged: 1, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 2))!.facts.turnover).toBe(guarded.base);
    expectMemberSettled(world, [guarded], periodOf(2027, 2));
  });

  it('пайщик с открытым гарантийным возвратом: его заказ в итоге участка, но строка ждёт решения совета и списывается по ставкам своего периода', async () => {
    const world = createKeuWorld();
    const plain = order('anna', 10_000, dayOf(2027, 1, 5));
    const disputed = order('boris', 20_000, dayOf(2027, 1, 6));
    await world.issue(plain);
    await world.issue(disputed);
    world.settings.openClaims.add(disputed.hash);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 1, failed: 1 });
    const chain = world.chainPeriod('branch1', periodOf(2027, 1))!;
    expect(chain.facts.turnover).toBe(plain.base + disputed.base);
    expect(chain.facts.secured).toBe(plain.due + disputed.due);
    expect(world.wallets.due.get('boris')).toBe(disputed.due);
    expect(world.logger.info).toHaveBeenCalledWith(expect.stringContaining('открыт гарантийный возврат'));

    // Совет отклонил возврат 10 февраля: строка списывается по ставкам января, итог января не пересчитывается.
    world.settings.openClaims.delete(disputed.hash);
    expect(await world.run(dayOf(2027, 2, 10))).toEqual({ charged: 1, failed: 0 });
    expectMemberSettled(world, [disputed], periodOf(2027, 1));
    expect(world.calls.closePeriod).toHaveLength(1);
    expect((await world.periodService.findOne('voskhod', 'branch1', periodOf(2027, 1)))).toMatchObject({ rows_total: 2, rows_charged: 2 });
  });

  it('возврат по заказу другого периода строку пайщика не держит: январская строка списывается, мартовская ждёт решения совета', async () => {
    const world = createKeuWorld();
    const january = order('boris', 10_000, dayOf(2027, 1, 5));
    const march = order('boris', 20_000, dayOf(2027, 1, 6), { warrantyUntil: dayOf(2027, 3, 3) });
    await world.issue(january);
    await world.issue(march);
    world.settings.openClaims.add(march.hash);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 1, failed: 0 });
    expectMemberSettled(world, [january], periodOf(2027, 1));
    // На кошельке к списанию — только заказ под возвратом.
    expect(world.wallets.due.get('boris')).toBe(march.due);
    expect(world.chainDue('boris', 'branch1', periodOf(2027, 3))).toBeDefined();
  });

  it('удержание при отказе: в итог участка не входит, строка без стоимости списывается целиком участку и итога не ждёт', async () => {
    const world = createKeuWorld();
    const o = order('anna', 10_000, dayOf(2027, 1, 5));
    await world.issue(o);
    await world.penalize({ hash: hashOf(900), username: 'boris', braname: 'branch1', due: rub(500), issuedAt: dayOf(2027, 1, 9) });
    expect(world.chainCounter('branch1', periodOf(2027, 1))).toMatchObject({ turnover: o.base, retained: rub(500), members: 2 });

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 2, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 1))!.facts.turnover).toBe(o.base);
    expect(world.calls.chargePeriod).toContainEqual({ coopname: 'voskhod', username: 'boris', braname: 'branch1', period: periodOf(2027, 1) });
    expect(world.dueRow(hashOf(900))).toMatchObject({ due_amount: '0.0000', charged_amount: '500.0000', returned_amount: '0.0000' });
    expect(world.wallets.branch.get('branch1')! >= rub(500)).toBe(true);
  });

  it('только удержания за месяц: итога нет, участок получает удержания целиком', async () => {
    const world = createKeuWorld();
    await world.penalize({ hash: hashOf(901), username: 'boris', braname: 'branch1', due: rub(500), issuedAt: dayOf(2027, 1, 9) });
    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 1, failed: 0 });
    expect(world.calls.closePeriod).toHaveLength(0);
    expect(world.chainPeriod('branch1', periodOf(2027, 1))).toBeUndefined();
    expect(world.wallets.branch.get('branch1')).toBe(rub(500));
    expect(world.notifications.notifyUser).toHaveBeenCalledWith('boris', expect.any(String), expect.objectContaining({ ratePercent: '100.00' }));
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
    expectMemberSettled(world, [march], periodOf(2027, 3));
    expect(world.periods.filter((p) => p.braname === 'branch1').length).toBeLessThanOrEqual(2);
  });

  it('строка не списалась за весь месяц: её итог не стирается, пока она в цепи; первого числа следующего месяца она списана по своим ставкам', async () => {
    const world = createKeuWorld();
    const stuck = order('anna', 10_000, dayOf(2027, 1, 5));
    await world.issue(stuck);
    world.faults.chargePeriod.set('anna', Array.from({ length: 3 }, () => new Error('assertion failure with message: MARKETPLACE_DUE_AMOUNT_INVALID: проверка')));
    for (let i = 0; i < 3; i++) await world.run(new Date(firstOfMonth(2027, 2).getTime() + i * hour));
    expect(world.chainDue('anna', 'branch1', periodOf(2027, 1))).toBeDefined();

    const february = order('boris', 20_000, dayOf(2027, 2, 12));
    await world.issue(february);
    // Первого марта: итог февраля считается, январская строка списывается по ставкам января —
    // итог января не стёрт, пока строка в цепи.
    expect(await world.run(firstOfMonth(2027, 3))).toEqual({ charged: 2, failed: 0 });
    expect(world.chainPeriod('branch1', periodOf(2027, 1))).toBeDefined();
    expectMemberSettled(world, [stuck], periodOf(2027, 1));
    expectMemberSettled(world, [february], periodOf(2027, 2));
    expect(world.wallets.due.get('anna')).toBe(0n);

    // Строк января в цепи больше нет — следующий проход с новым итогом стирает его как позапрошлый.
    await world.issue(order('boris', 20_000, dayOf(2027, 3, 12)));
    await world.run(firstOfMonth(2027, 4));
    expect(world.chainPeriod('branch1', periodOf(2027, 1))).toBeUndefined();
    expect(world.periods.filter((p) => p.braname === 'branch1').length).toBeLessThanOrEqual(2);
  });

  it('двести пятьдесят пайщиков: итог по всем, проход отправляет двести списаний, следующий — остальные по тем же ставкам', async () => {
    const world = createKeuWorld();
    const orders = Array.from({ length: 250 }, (_, i) => order(`member${i}`, 1_000 + i, dayOf(2027, 1, 1 + (i % 28))));
    for (const o of orders) await world.issue(o);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 200, failed: 0 });
    expect(world.calls.closePeriod).toHaveLength(1);
    expect(world.chainPeriod('branch1', periodOf(2027, 1))!.facts.turnover).toBe(sum(orders.map((o) => o.base)));
    expect((await world.periodService.findOne('voskhod', 'branch1', periodOf(2027, 1)))!.rows_total).toBe(250);

    expect(await world.run(new Date(firstOfMonth(2027, 2).getTime() + hour))).toEqual({ charged: 50, failed: 0 });
    expect(world.calls.closePeriod).toHaveLength(1);
    for (const o of orders) expectMemberSettled(world, [o], periodOf(2027, 1));
    expect(walletTotal(world.wallets.due)).toBe(0n);
    expect(await world.periodService.findOne('voskhod', 'branch1', periodOf(2027, 1))).toMatchObject({ rows_total: 250, rows_charged: 250 });
  });
});

describe('mkt.order.keu.cycle.09 — переходный перенос зеркала в счётчики при первом старте (задача 99D-33)', () => {
  it('строки зеркала без счётчиков переносятся в цепь: выданный заказ — в период конца гарантии, удержание — целиком участку; списание идёт как обычно', async () => {
    const world = createKeuWorld();
    world.settings.plans.push({ branchName: 'branch1', dueDate: dayOf(2027, 1, 20), amount: '5000.0000 RUB' });
    world.seedMirrorRow({ order_hash: hashOf(1), username: 'anna', base_amount: '10000.0000', due_amount: '3800.0000', due_from: dayOf(2027, 1, 5) });
    world.seedMirrorRow({ order_hash: hashOf(2), username: 'anna', base_amount: '20000.0000', due_amount: '7600.0000', due_from: dayOf(2027, 1, 9) });
    world.seedMirrorRow({ order_hash: hashOf(3), username: 'boris', base_amount: '0.0000', due_amount: '500.0000', due_from: dayOf(2027, 1, 9) });
    world.fundDueWallet('anna', rub(11_400));
    world.fundDueWallet('boris', rub(500));

    expect(await world.migrate()).toEqual({ moved: 3, failed: 0 });
    expect(world.calls.migrateDue).toHaveLength(3);
    expect(world.chainDue('anna', 'branch1', periodOf(2027, 1))).toMatchObject({ turnover: rub(30_000), due: rub(11_400), retained: 0n, orders: 2 });
    expect(world.chainDue('boris', 'branch1', periodOf(2027, 1))).toMatchObject({ turnover: 0n, due: 0n, retained: rub(500) });
    expect(world.chainCounter('branch1', periodOf(2027, 1))).toMatchObject({ turnover: rub(30_000), secured: rub(11_400), retained: rub(500), members: 2 });

    // Повторный старт: счётчики уже есть — переноса нет.
    expect(await world.migrate()).toEqual({ moved: 0, failed: 0 });
    expect(world.calls.migrateDue).toHaveLength(3);

    expect(await world.run(firstOfMonth(2027, 2))).toEqual({ charged: 2, failed: 0 });
    expect(world.dueRow(hashOf(1))!.due_amount).toBe('0.0000');
    expect(world.dueRow(hashOf(3))).toMatchObject({ charged_amount: '500.0000' });
    expect(walletTotal(world.wallets.due)).toBe(0n);
  });

  it('строка, вошедшая в рассчитанный итог, переносится в его период; перенос сверх кошелька отклоняется и не роняет остальные', async () => {
    const world = createKeuWorld();
    world.settings.plans.push({ branchName: 'branch1', dueDate: dayOf(2027, 1, 20), amount: '5000.0000 RUB' });
    // Итог января уже рассчитан прежним узлом.
    await world.issue(order('vera', 10_000, dayOf(2027, 1, 5)));
    await world.run(firstOfMonth(2027, 2));
    world.calls.closePeriod.length = 0;

    world.seedMirrorRow({ order_hash: hashOf(10), username: 'anna', base_amount: '10000.0000', due_amount: '3800.0000', due_from: dayOf(2027, 1, 5), run_period: periodOf(2027, 1) });
    world.seedMirrorRow({ order_hash: hashOf(11), username: 'boris', base_amount: '10000.0000', due_amount: '3800.0000', due_from: dayOf(2027, 1, 6) });
    world.fundDueWallet('anna', rub(3_800));
    // У Бориса на кошельке меньше, чем числится в зеркале: контракт перенос отклоняет.
    world.fundDueWallet('boris', rub(100));

    expect(await world.migrate()).toEqual({ moved: 1, failed: 1 });
    expect(world.logger.error).toHaveBeenCalledWith(expect.stringContaining(hashOf(11)));
    // Строка Анны — в периоде рассчитанного итога, счётчик участка за него не заводится: ставки уже зафиксированы.
    expect(world.chainDue('anna', 'branch1', periodOf(2027, 1))).toMatchObject({ turnover: rub(10_000), due: rub(3_800) });
    expect(world.chainCounter('branch1', periodOf(2027, 1))).toBeUndefined();

    expect(await world.run(dayOf(2027, 2, 3))).toEqual({ charged: 1, failed: 0 });
    expect(world.calls.closePeriod).toHaveLength(0);
    expect(world.dueRow(hashOf(10))).toMatchObject({ due_amount: '0.0000' });
    expect(world.wallets.due.get('anna')).toBe(0n);
  });
});

describe('mkt.order.invest.cycle.01 — год прогонов участка с паевыми взносами инициаторов', () => {
  // Расходы 30 000 ₽ в месяц, как в годе роста оборота; инициаторы внесли имущество
  // 60 000 ₽ (в базе возврата сразу) и в первом месяце оплатили записку 5 000 ₽ из своих средств.
  const ORDERS_PER_MONTH = [1, 2, 3, 4, 6, 8, 10, 12, 15, 18, 22, 26];

  it('фаза каждого месяца — по формуле, возмещение за прогон сходится с цепью, записка из средств инициаторов — в фактах месяца, деньги сходятся', async () => {
    const world = createKeuWorld();
    world.settings.reserve.set('branch1', rub(10_000));
    world.investProperty('branch1', rub(60_000));
    const base = rub(60_000);
    for (let month = 1; month <= 12; month++) {
      world.settings.plans.push({ branchName: 'branch1', dueDate: dayOf(2027, month, 20), amount: '20000.0000 RUB' });
      world.settings.aidPaid.set(`branch1/${periodOf(2027, month)}`, rub(10_000));
    }
    // Записка участка, оплаченная из средств инициаторов, и выделение под помощь (не записка).
    world.settings.ledger.push(
      { operationCode: 'o.mkt.ipool', username: 'branch1', quantity: '5000.0000 RUB', processHash: hashOf(9001), createdAt: dayOf(2027, 1, 10) },
      { operationCode: 'o.mkt.ipool', username: 'branch1', quantity: '3000.0000 RUB', processHash: hashOf(9002), createdAt: dayOf(2027, 1, 12) },
    );
    world.settings.aidHashes.add(hashOf(9002));

    let collected = 0n;
    let repaidSum = 0n;
    const phases: string[] = [];

    for (let month = 1; month <= 12; month++) {
      const count = ORDERS_PER_MONTH[month - 1];
      const orders = Array.from({ length: count }, (_, i) => order(`member${(i % 7) + 1}`, 5_000 + 1_000 * i, dayOf(2027, month, 1 + (i % 25))));
      for (const o of orders) await world.issue(o);
      collected += sum(orders.map((o) => o.due));
      // Итог месяца считается в начале прохода, до списаний: остаток к возврату на этот момент.
      const outstandingAtClose = world.investOutstanding('branch1');
      const repaidBefore = world.investRepaid('branch1');

      const next = month === 12 ? firstOfMonth(2028, 1) : firstOfMonth(2027, month + 1);
      expect(await world.run(next)).toEqual({ charged: byMember(orders).length, failed: 0 });

      const period = periodOf(2027, month);
      const chain = world.chainPeriod('branch1', period)!;
      // Записка из средств инициаторов — в служебных записках месяца; выделение под помощь — нет.
      if (month === 1) expect(chain.facts.memos).toBe(rub(5_000));
      const expectedPhase = chain.totals.deficit > 0n ? 'DEFICIT' : outstandingAtClose > 0n ? 'REPAYING' : 'BRANCH';
      const mirror = (await world.periodService.findOne('voskhod', 'branch1', period))!;
      expect({ month, phase: mirror.invest_phase }).toEqual({ month, phase: expectedPhase });
      phases.push(mirror.invest_phase);

      const repaidMonth = world.investRepaid('branch1') - repaidBefore;
      // Возмещение за прогон в зеркале = рост счётчика участка в цепи.
      expect(toUnits(mirror.investor_repaid)).toBe(repaidMonth);
      // Доля инициаторов возмещает не больше их доли за месяц и не больше остатка.
      expect(repaidMonth <= chain.totals.initiator).toBe(true);
      expect(repaidMonth <= outstandingAtClose).toBe(true);
      if (expectedPhase === 'DEFICIT') expect(repaidMonth).toBe(0n);
      repaidSum += repaidMonth;
    }

    // Фазы идут по порядку: дефицит → возмещение → доля участку; назад не возвращаются при росте оборота.
    const order_ = ['DEFICIT', 'REPAYING', 'BRANCH'];
    for (let i = 1; i < phases.length; i++) expect({ phases, ok: order_.indexOf(phases[i]) >= order_.indexOf(phases[i - 1]) }).toEqual({ phases, ok: true });
    expect(phases).toContain('REPAYING');
    expect(repaidSum).toBe(world.investRepaid('branch1'));
    // Счётчик возврата округляется вниз, поэтому возмещено может превысить базу
    // на единицу актива за прогон; контракт переводит такую переплату участку при
    // завершении возврата (o.mkt.rpsurp).
    expect(repaidSum - base <= 12n).toBe(true);
    if (repaidSum >= base) expect(world.investOutstanding('branch1') <= 12n).toBe(true);
    // Собранное разошлось без остатка: участку, в фонды, инициатору, на возмещение паевых взносов и пайщикам.
    const distributed =
      walletTotal(world.wallets.branch) + world.wallets.funds + walletTotal(world.wallets.invest) + walletTotal(world.wallets.repay) + walletTotal(world.wallets.share);
    expect(distributed).toBe(collected);
    // Пока паевые взносы не возвращены, доля инициатора возмещает их, а не начисляется инициатору.
    expect(walletTotal(world.wallets.invest)).toBe(0n);
    expect(world.logger.error).not.toHaveBeenCalled();
  });
});
