import { configurePlatformSettings } from '@coopenomics/extension-kit';
import { ExpensePlansService } from '~/extensions/expenses/application/services/expense-plans.service';
import { ExpensePlanRecurrence } from '~/extensions/expenses/domain/expense-plan.types';
import { ExpenseRecipientType } from '~/extensions/expenses/domain/enums/expense-recipient-type.enum';
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

const KRG_BRANCH = { braname: 'krg', trustee: 'chair', trusted: [] as string[] };

function build(proposalRows: { proposal_hash: string; status: string }[] = []) {
  const store = memoryStore();
  const branchOperators = {
    isCouncil: (v: any) => v.role === 'chairman' || v.role === 'member',
    operatedBranches: async (_c: string, u: string) => (u === 'chair' ? ['krg'] : []),
    findBranch: async (_c: string, b: string) => (b === 'krg' ? KRG_BRANCH : null),
    isOperatorOf: (b: any, u: string) => b.trustee === u || b.trusted.includes(u),
  };
  const counterparties = {
    forPayment: jest.fn(async (_c: string, id: number) => {
      if (id === 404) throw Object.assign(new Error('nf'), { code: 'EXPENSES_COUNTERPARTY_NOT_FOUND' });
      return { record: { id, name: 'ООО «Энергосбыт»', payment_purpose: 'Оплата электроэнергии. Без НДС' }, requisitesText: 'ИНН 7707083893' };
    }),
    namesByIds: jest.fn(async (_c: string, ids: number[]) => new Map(ids.map((id) => [id, 'ООО «Энергосбыт»']))),
  };
  const paymentMethods = {
    get: jest.fn(async ({ username, method_id }: { username: string; method_id: string }) => {
      if (method_id === 'alien') throw Object.assign(new Error('nf'), { code: 'PAYMENT_METHOD_NOT_FOUND' });
      return { username, method_id, method_type: 'sbp' };
    }),
  };
  const accounts = { getDisplayName: jest.fn(async (u: string) => (u === 'petrov' ? 'Петров Пётр' : u)) };
  // Расходы шасси: по ссылке записи реестр показывает их состояние.
  const proposals = {
    find: jest.fn(async (where: { proposal_hash: { value?: string[] } | string }) => {
      const wanted = typeof where.proposal_hash === 'string' ? [where.proposal_hash] : where.proposal_hash.value ?? [];
      return proposalRows.filter((r) => wanted.includes(r.proposal_hash));
    }),
  };
  const service = new ExpensePlansService(
    store as any,
    branchOperators as any,
    counterparties as any,
    paymentMethods as any,
    accounts as any,
    proposals as any
  );
  return { store, service, counterparties, paymentMethods, proposals };
}

const base = { braname: 'krg', title: 'Электроэнергия', amount: 1000, due_date: utc(2026, 12, 11) };

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

describe('Способ оплаты записи плана (99D-35)', () => {
  it('организация: контрагент и назначение платежа; назначение по умолчанию — из карточки', async () => {
    const { service, store } = build();
    const plan = await service.createPlan('voskhod', 'chair', { ...base, recipient_type: ExpenseRecipientType.ORG, counterparty_id: 7 });
    expect(plan).toMatchObject({
      recipient_type: ExpenseRecipientType.ORG,
      counterparty_id: 7,
      counterparty_name: 'ООО «Энергосбыт»',
      payment_purpose: 'Оплата электроэнергии. Без НДС',
      pay_to: null,
      recipient: null,
      payment_method_id: null,
    });
    expect(store.rows[0]).toMatchObject({ recipientType: 'ORG', counterpartyId: 7, payTo: null });
    const own = await service.createPlan('voskhod', 'chair', { ...base, recipient_type: ExpenseRecipientType.ORG, counterparty_id: 7, payment_purpose: 'Счёт № 5' });
    expect(own.payment_purpose).toBe('Счёт № 5');
  });

  it('организация без контрагента — отказ; несуществующий или архивный контрагент — отказ сервиса контрагентов', async () => {
    const { service } = build();
    await expect(service.createPlan('voskhod', 'chair', { ...base, recipient_type: ExpenseRecipientType.ORG })).rejects.toMatchObject({ code: 'EXPENSES_PLAN_RECIPIENT_REQUIRED' });
    await expect(service.createPlan('voskhod', 'chair', { ...base, recipient_type: ExpenseRecipientType.ORG, counterparty_id: 404 })).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_NOT_FOUND' });
  });

  it('аванс себе: получатель — добавляющий, способ получения средств обязателен и проверяется у него', async () => {
    const { service, paymentMethods } = build();
    await expect(service.createPlan('voskhod', 'chair', { ...base, recipient_type: ExpenseRecipientType.SELF })).rejects.toMatchObject({ code: 'EXPENSES_PLAN_PAYMENT_METHOD_REQUIRED' });
    const plan = await service.createPlan('voskhod', 'chair', { ...base, recipient_type: ExpenseRecipientType.SELF, payment_method_id: 'm1', recipient: 'petrov' });
    expect(plan).toMatchObject({ recipient_type: ExpenseRecipientType.SELF, recipient: 'chair', payment_method_id: 'm1', counterparty_id: null, payment_purpose: null });
    expect(paymentMethods.get).toHaveBeenCalledWith({ username: 'chair', method_id: 'm1' });
  });

  it('аванс другому пайщику: пайщик обязателен, чужой способ получения средств не принимается', async () => {
    const { service } = build();
    await expect(service.createPlan('voskhod', 'chair', { ...base, recipient_type: ExpenseRecipientType.MEMBER, payment_method_id: 'm1' })).rejects.toMatchObject({ code: 'EXPENSES_PLAN_RECIPIENT_REQUIRED' });
    await expect(service.createPlan('voskhod', 'chair', { ...base, recipient_type: ExpenseRecipientType.MEMBER, recipient: 'petrov', payment_method_id: 'alien' })).rejects.toMatchObject({ code: 'PAYMENT_METHOD_NOT_FOUND' });
    const plan = await service.createPlan('voskhod', 'chair', { ...base, recipient_type: ExpenseRecipientType.MEMBER, recipient: 'petrov', payment_method_id: 'm2' });
    expect(plan).toMatchObject({ recipient: 'petrov', recipient_name: 'Петров Пётр', payment_method_id: 'm2' });
  });

  it('без способа оплаты принимается только прежний текст реквизитов', async () => {
    const { service } = build();
    await expect(service.createPlan('voskhod', 'chair', { ...base })).rejects.toMatchObject({ code: 'EXPENSES_PLAN_RECIPIENT_REQUIRED' });
    await expect(service.createPlan('voskhod', 'chair', { ...base, pay_to: '  ' })).rejects.toMatchObject({ code: 'EXPENSES_PLAN_RECIPIENT_REQUIRED' });
    const plan = await service.createPlan('voskhod', 'chair', { ...base, pay_to: 'ООО «Арендодатель», р/с …' });
    expect(plan).toMatchObject({ recipient_type: null, pay_to: 'ООО «Арендодатель», р/с …' });
  });

  it('оператор чужого участка запись не заводит', async () => {
    const { service } = build();
    await expect(service.createPlan('voskhod', 'stranger', { ...base, pay_to: 'x' })).rejects.toMatchObject({ code: 'EXPENSES_PLAN_BRANCH_MANAGE_FORBIDDEN' });
  });

  it('следующий платёж серии наследует способ оплаты', async () => {
    const { service, store } = build();
    const head = seedRow({
      dueDate: utc(2025, 1, 11),
      recurrence: ExpensePlanRecurrence.QUARTERLY,
      recipientType: 'ORG',
      counterpartyId: 7,
      paymentPurpose: 'Оплата электроэнергии',
      payTo: null,
    } as any);
    await store.save(head);
    await (service as any).spawnSeriesFrom(head);
    expect(store.rows.length).toBeGreaterThan(1);
    for (const row of store.rows) {
      expect(row).toMatchObject({ recipientType: 'ORG', counterpartyId: 7, paymentPurpose: 'Оплата электроэнергии' });
    }
  });

  it('реестр показывает наименование контрагента и имя пайщика-получателя', async () => {
    const { service, store } = build();
    store.rows.push(
      seedRow({ id: 1, recipientType: 'ORG', counterpartyId: 7, payTo: null } as any),
      seedRow({ id: 2, recipientType: 'MEMBER', recipient: 'petrov', paymentMethodId: 'm2', payTo: null } as any)
    );
    const views = await service.listPlansFor('voskhod', { username: 'chair', role: 'chairman' } as any, 'krg');
    expect(views.find((v) => v.id === 1)?.counterparty_name).toBe('ООО «Энергосбыт»');
    expect(views.find((v) => v.id === 2)?.recipient_name).toBe('Петров Пётр');
  });
});

describe('Состояние расхода в записи реестра (12.11.2026)', () => {
  it('запись показывает состояние своего расхода: совет утвердил — не «на рассмотрении»', async () => {
    const { store, service, proposals } = build([
      { proposal_hash: 'aa11', status: 'AUTHORIZED' },
      { proposal_hash: 'bb22', status: 'CREATED' },
    ]);
    store.rows.push(
      seedRow({ id: 1, proposalHash: 'aa11' }),
      seedRow({ id: 2, proposalHash: 'bb22' }),
      seedRow({ id: 3, proposalHash: null })
    );
    const views = await service.listPlansFor('voskhod', { username: 'chair', role: 'chairman' } as any, 'krg');
    const byId = new Map(views.map((v) => [v.id, v.proposal_status]));
    expect(byId.get(1)).toBe('AUTHORIZED');
    expect(byId.get(2)).toBe('CREATED');
    expect(byId.get(3)).toBeNull();
    // Один запрос на весь реестр, только по записям с расходом.
    expect(proposals.find).toHaveBeenCalledTimes(1);
  });

  it('без запущенных расходов таблицу расходов не спрашивает', async () => {
    const { store, service, proposals } = build();
    store.rows.push(seedRow({ id: 1, proposalHash: null }));
    await service.listPlansFor('voskhod', { username: 'chair', role: 'chairman' } as any, 'krg');
    expect(proposals.find).not.toHaveBeenCalled();
  });
});
