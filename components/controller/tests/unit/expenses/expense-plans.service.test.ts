import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { ExpensePlansService } from '~/extensions/expenses/application/services/expense-plans.service';
import { ExpensePlanRecurrence } from '~/extensions/expenses/domain/expense-plan.types';
import type { ExpensePlanEntity } from '~/extensions/expenses/infrastructure/entities/expense-plan.entity';
import { ExpensesInnercoopExpenseChassisAdapter } from '~/extensions/expenses/infrastructure/innercoop/expenses-innercoop-expense-chassis.adapter';

/**
 * Реестр плановых расходов: показ серии до добавления и продолжение серии
 * (задача 99D-34, решение владельца 11.11.2026; реестр expenses.plans, случаи
 * exp.plan.schedule.*).
 *
 * Председатель видит в диалоге сроки платежей и резерв в месяц. Эти сроки
 * обязаны совпасть с записями, которые воркер реестра заведёт по мере
 * наступления сроков, — иначе экран обещает одно, а реестр делает другое.
 */

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const day = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : null);

beforeAll(() => {
  configurePlatformSettings({
    coopname: 'voskhod',
    frontendUrl: 'http://localhost',
    backendUrl: 'http://localhost',
    timezone: 'Europe/Moscow',
    environment: 'test',
    blockchain: { rootGovernSymbol: 'RUB', rootGovernPrecision: 4, rootSymbol: 'AXON', rootPrecision: 4, chainId: 'test' },
  });
});

/** Хранилище реестра в памяти: create/save/update/find — то, чем пользуется сервис. */
function memoryStore() {
  const rows: ExpensePlanEntity[] = [];
  let nextId = 1;
  return {
    rows,
    create: (x: Partial<ExpensePlanEntity>) => ({ ...x }) as ExpensePlanEntity,
    save: jest.fn(async (x: ExpensePlanEntity) => {
      if (!x.id) x.id = nextId++;
      if (!rows.includes(x)) rows.push(x);
      return x;
    }),
    update: jest.fn(async (where: { id: number }, patch: Partial<ExpensePlanEntity>) => {
      const row = rows.find((r) => r.id === where.id);
      if (row) Object.assign(row, patch);
    }),
    find: jest.fn(async () => [...rows]),
  };
}

function build() {
  const store = memoryStore();
  const service = new ExpensePlansService(store as any, {} as any);
  return { store, service };
}

function seedRow(over: Partial<ExpensePlanEntity>): ExpensePlanEntity {
  return {
    coopname: 'voskhod',
    braname: 'krg',
    title: 'Аренда',
    amount: '1000.0000',
    dueDate: utc(2026, 11, 11),
    recurrence: ExpensePlanRecurrence.NONE,
    nextSpawned: false,
    payTo: 'ООО «Арендодатель»',
    creator: 'chair',
    createdAt: utc(2026, 11, 1),
    proposalHash: null,
    paidAt: null,
    ...over,
  } as ExpensePlanEntity;
}

describe('Показ серии планового расхода до добавления', () => {
  it('квартал 1 000 ₽ от 11.11.2026: четыре срока, резерв копится три месяца по 333,3333 ₽', () => {
    const { service } = build();
    const view = service.previewSchedule({ amount: 1000, due_date: utc(2026, 11, 11), recurrence: ExpensePlanRecurrence.QUARTERLY });
    expect(view.due_dates.map(day)).toEqual(['2026-11-11', '2027-02-11', '2027-05-11', '2027-08-11']);
    expect(view.reserve_months).toBe(3);
    expect(view.reserve_per_month).toBe('333.3333 RUB');
  });

  it('год 12 000 ₽: сроки раз в год, резерв копится двенадцать месяцев по 1 000 ₽', () => {
    const { service } = build();
    const view = service.previewSchedule({ amount: 12_000, due_date: utc(2026, 11, 11), recurrence: ExpensePlanRecurrence.YEARLY });
    expect(view.due_dates.map(day)).toEqual(['2026-11-11', '2027-11-11', '2028-11-11', '2029-11-11']);
    expect(view.reserve_months).toBe(12);
    expect(view.reserve_per_month).toBe('1000.0000 RUB');
  });

  it('каждый месяц: резерв собирает платёж целиком за один месяц', () => {
    const { service } = build();
    const view = service.previewSchedule({ amount: 500, due_date: utc(2027, 1, 31), recurrence: ExpensePlanRecurrence.MONTHLY });
    expect(view.due_dates.map(day)).toEqual(['2027-01-31', '2027-02-28', '2027-03-28', '2027-04-28']);
    expect(view.reserve_months).toBe(1);
    expect(view.reserve_per_month).toBe('500.0000 RUB');
  });

  it('разовый расход и расход без периодичности: один срок, вся сумма за один месяц', () => {
    const { service } = build();
    for (const recurrence of [ExpensePlanRecurrence.NONE, null, undefined]) {
      const view = service.previewSchedule({ amount: 700, due_date: utc(2026, 12, 5), recurrence });
      expect(view.due_dates.map(day)).toEqual(['2026-12-05']);
      expect(view.reserve_months).toBe(1);
      expect(view.reserve_per_month).toBe('700.0000 RUB');
    }
  });

  it('пустая, нулевая и отрицательная сумма — резерв ноль, сроки показываются', () => {
    const { service } = build();
    for (const amount of [0, -10, Number.NaN]) {
      const view = service.previewSchedule({ amount, due_date: utc(2026, 12, 5), recurrence: ExpensePlanRecurrence.QUARTERLY });
      expect(view.reserve_per_month).toBe('0.0000 RUB');
      expect(view.due_dates).toHaveLength(4);
    }
  });

  it('большая сумма делится без потери точности: 123 456 789,1234 ₽ за квартал — 41 152 263,0411 ₽ в месяц', () => {
    const { service } = build();
    const view = service.previewSchedule({ amount: 123_456_789.1234, due_date: utc(2026, 12, 5), recurrence: ExpensePlanRecurrence.QUARTERLY });
    expect(view.reserve_per_month).toBe('41152263.0411 RUB');
  });
});

describe('Следующий срок в записи реестра', () => {
  it('повторяющаяся запись показывает срок следующего платежа, разовая и без срока — пусто', async () => {
    const { store, service } = build();
    store.rows.push(
      seedRow({ id: 1, recurrence: ExpensePlanRecurrence.QUARTERLY, dueDate: utc(2026, 11, 30) }),
      seedRow({ id: 2, recurrence: ExpensePlanRecurrence.YEARLY, dueDate: utc(2028, 2, 29) }),
      seedRow({ id: 3, recurrence: ExpensePlanRecurrence.NONE }),
      seedRow({ id: 4, recurrence: ExpensePlanRecurrence.MONTHLY, dueDate: null })
    );
    const views = await service.listPlans('voskhod', 'krg');
    const byId = new Map(views.map((v) => [v.id, v]));
    expect(day(byId.get(1)?.next_due_date)).toBe('2027-02-28');
    expect(day(byId.get(2)?.next_due_date)).toBe('2029-02-28');
    expect(byId.get(3)?.next_due_date).toBeNull();
    expect(byId.get(4)?.next_due_date).toBeNull();
  });
});

describe('Продолжение серии совпадает с показом', () => {
  it.each([
    [ExpensePlanRecurrence.MONTHLY, 1],
    [ExpensePlanRecurrence.QUARTERLY, 3],
    [ExpensePlanRecurrence.YEARLY, 12],
  ])('%s: записи, которые заводит воркер, идут по срокам из показа', async (recurrence, months) => {
    const { store, service } = build();
    // Первый срок в прошлом: воркер догоняет серию до ближайшего будущего срока.
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months * 3, 31));
    const head = seedRow({ dueDate: first, recurrence });
    await store.save(head);
    await (service as any).spawnSeriesFrom(head);

    const spawned = store.rows.map((r) => r.dueDate as Date);
    const shown = service.previewSchedule({ amount: 1000, due_date: first, recurrence }).due_dates;
    expect(spawned.length).toBeGreaterThanOrEqual(2);
    const common = Math.min(spawned.length, shown.length);
    expect(spawned.slice(0, common).map(day)).toEqual(shown.slice(0, common).map(day));
    // Серия догнана: последний срок в будущем, у прежних записей отметка «следующая заведена».
    expect(spawned[spawned.length - 1].getTime()).toBeGreaterThan(now.getTime());
    expect(store.rows.slice(0, -1).every((r) => r.nextSpawned)).toBe(true);
    expect(store.rows[store.rows.length - 1].nextSpawned).toBe(false);
  });

  it('разовый расход воркер не продолжает', async () => {
    const { store, service } = build();
    const head = seedRow({ dueDate: utc(2025, 1, 1), recurrence: ExpensePlanRecurrence.NONE });
    await store.save(head);
    await (service as any).spawnSeriesFrom(head);
    expect(store.rows).toHaveLength(1);
  });
});

describe('Запись реестра для Стола заказов', () => {
  it('несёт шаг серии в месяцах: разовый 0, месяц 1, квартал 3, год 12 — по нему итог месяца копит резерв', async () => {
    const { store, service } = build();
    store.rows.push(
      seedRow({ id: 1, recurrence: ExpensePlanRecurrence.NONE }),
      seedRow({ id: 2, recurrence: ExpensePlanRecurrence.MONTHLY }),
      seedRow({ id: 3, recurrence: ExpensePlanRecurrence.QUARTERLY }),
      seedRow({ id: 4, recurrence: ExpensePlanRecurrence.YEARLY })
    );
    const adapter = new ExpensesInnercoopExpenseChassisAdapter({} as any, {} as any, service, {} as any, {} as any);
    const plans = await adapter.listPlans('voskhod', 'krg');
    expect(plans.map((p) => [p.id, p.recurrenceMonths])).toEqual([
      [1, 0],
      [2, 1],
      [3, 3],
      [4, 12],
    ]);
    expect(plans[2]).toMatchObject({ branchName: 'krg', amount: '1000.0000 RUB', proposalHash: null, paidAt: null });
  });
});
