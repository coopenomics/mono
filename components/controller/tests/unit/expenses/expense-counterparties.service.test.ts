import { ExpenseCounterpartiesService } from '~/extensions/expenses/application/services/expense-counterparties.service';
import { ExpenseCounterpartyKind } from '~/extensions/expenses/domain/enums/expense-counterparty-kind.enum';
import type { ExpenseCounterpartyRecord } from '~/extensions/expenses/infrastructure/entities/expense-counterparty.record';

/**
 * Реестр контрагентов шасси расходов (задача 99D-35, решение владельца
 * 11.11.2026; реестр expenses.counterparties, случаи exp.cp.*).
 *
 * Совет ведёт всех контрагентов; операторы участка видят всех, добавляют и
 * правят только контрагентов своего участка; прочим пайщикам реестр закрыт.
 * Реквизиты проверяются правилами страны кооператива (пакет юрисдикций).
 */

const COOP = 'voskhod';
const LEGAL = {
  inn: '7707083893',
  kpp: '773601001',
  ogrn: '1027700132195',
  account: '40702810938000000001',
  bank_name: 'ПАО Сбербанк',
  bik: '044525225',
  corr_account: '30101810400000000225',
};

const chairman = { username: 'chair', role: 'chairman' } as any;
const councilMember = { username: 'member1', role: 'member' } as any;
const krgOperator = { username: 'krgboss', role: 'user' } as any;
const mskOperator = { username: 'mskboss', role: 'user' } as any;
const outsider = { username: 'ivan', role: 'user' } as any;

const BRANCHES = [
  { braname: 'krg', trustee: 'krgboss', trusted: ['krghelper'] },
  { braname: 'msk', trustee: 'mskboss', trusted: [] },
];

/** Хранилище в памяти: равенство по полям; условия-помощники (ilike, isNull, oneOf) не применяются. */
function memoryStore<T extends { id?: number }>(rows: T[] = []) {
  let nextId = rows.length + 1;
  const plain = (where: Record<string, unknown>) =>
    Object.entries(where).filter(([, v]) => v === null || typeof v !== 'object');
  const matches = (r: any, where: any) =>
    (Array.isArray(where) ? where : [where]).some((w) => plain(w).every(([k, v]) => r[k] === v));
  return {
    rows,
    create: (x: Partial<T>) => ({ ...x }) as T,
    save: jest.fn(async (x: T) => {
      if (!x.id) x.id = nextId++;
      if (!rows.includes(x)) rows.push(x);
      return x;
    }),
    find: jest.fn(async (where: any = {}, _options?: any) => rows.filter((r) => matches(r, where))),
    findOne: jest.fn(async (where: any) => rows.find((r) => matches(r, where)) ?? null),
    update: jest.fn(async (where: any, patch: Partial<T>) => {
      rows.filter((r) => matches(r, where)).forEach((r) => Object.assign(r, patch));
      return 1;
    }),
    delete: jest.fn(async (where: any) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1);
      return before - rows.length;
    }),
    count: jest.fn(async (where: any) => rows.filter((r) => matches(r, where)).length),
  };
}

function build(opts: { country?: string | null; plans?: any[] } = {}) {
  const store = memoryStore<ExpenseCounterpartyRecord>();
  const plans = memoryStore<any>(opts.plans ?? []);
  const organizations = {
    findByUsername: jest.fn(async () => ({ country: opts.country === undefined ? 'Russia' : opts.country })),
  };
  const branchOperators = {
    isCouncil: (v: any) => v.role === 'chairman' || v.role === 'member',
    operatedBranches: async (_c: string, u: string) =>
      BRANCHES.filter((b) => b.trustee === u || b.trusted.includes(u)).map((b) => b.braname),
    findBranch: async (_c: string, braname: string) => BRANCHES.find((b) => b.braname === braname) ?? null,
    isOperatorOf: (b: any, u: string) => b.trustee === u || b.trusted.includes(u),
  };
  const service = new ExpenseCounterpartiesService(store as any, plans as any, organizations as any, branchOperators as any);
  return { service, store, plans, organizations };
}

const input = (over: Record<string, unknown> = {}) => ({
  kind: ExpenseCounterpartyKind.LEGAL,
  name: 'ПАО Сбербанк',
  requisites: { ...LEGAL },
  payment_purpose: 'Оплата по договору № 1. Без НДС',
  ...over,
});

describe('Контрагенты — форма по стране кооператива', () => {
  it('у юрлица ИНН из 10 цифр первым полем и КПП, у ИП ИНН из 12 и без КПП', async () => {
    const { service } = build();
    const form = await service.form(COOP);
    expect(form.country).toBe('Russia');
    const legal = form.kinds.find((k) => k.kind === ExpenseCounterpartyKind.LEGAL)!;
    const ip = form.kinds.find((k) => k.kind === ExpenseCounterpartyKind.ENTREPRENEUR)!;
    expect(legal.fields[0]).toMatchObject({ key: 'inn', length: 10, required: true, tax_id: true, group: 'organization' });
    expect(legal.fields.map((f) => f.key)).toContain('kpp');
    // Счета сверяются с БИК — форма называет пару, чтобы ошибка указывала на оба поля.
    expect(legal.fields.find((f) => f.key === 'account')).toMatchObject({ checked_with: 'bik' });
    expect(legal.fields[0]).toMatchObject({ checked_with: null });
    expect(ip.fields[0]).toMatchObject({ key: 'inn', length: 12 });
    expect(ip.fields.map((f) => f.key)).not.toContain('kpp');
  });

  it('страна кооператива неизвестна — отказ, а не приём любых реквизитов', async () => {
    const { service } = build({ country: 'Atlantis' });
    await expect(service.form(COOP)).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_COUNTRY_UNKNOWN' });
    const { service: noCountry } = build({ country: null });
    await expect(noCountry.create(COOP, chairman, input())).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_COUNTRY_UNKNOWN' });
  });
});

describe('Контрагенты — проверка до сохранения', () => {
  it('верные реквизиты — без замечаний; условные номера — контрольная сумма у каждого поля', async () => {
    const { service } = build();
    expect(await service.check(COOP, chairman, ExpenseCounterpartyKind.LEGAL, LEGAL)).toEqual([]);
    const issues = await service.check(COOP, chairman, ExpenseCounterpartyKind.LEGAL, {
      ...LEGAL,
      inn: '1231231231',
      ogrn: '2341231231231',
      account: '12312312312312312312',
      corr_account: '12312312312312312312',
    });
    expect(issues).toEqual([
      { key: 'inn', code: 'CHECKSUM' },
      { key: 'ogrn', code: 'CHECKSUM' },
      { key: 'account', code: 'CHECKSUM' },
      { key: 'corr_account', code: 'CHECKSUM' },
    ]);
  });

  it('проверка закрыта тем, кому закрыт реестр', async () => {
    const { service } = build();
    await expect(service.check(COOP, outsider, ExpenseCounterpartyKind.LEGAL, LEGAL)).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_READ_FORBIDDEN' });
  });

  it('у КПП в форме маска ввода из 9 знаков', async () => {
    const { service } = build();
    const legal = (await service.form(COOP)).kinds.find((k) => k.kind === ExpenseCounterpartyKind.LEGAL)!;
    expect(legal.fields.find((f) => f.key === 'kpp')).toMatchObject({ mask: '####XX###' });
    expect(legal.fields.find((f) => f.key === 'inn')).toMatchObject({ mask: null, length: 10 });
  });
});

describe('Контрагенты — добавление и проверка реквизитов', () => {
  it('совет добавляет контрагента кооператива: реквизиты строкой как в поручении, налоговый номер — ИНН', async () => {
    const { service, store } = build();
    const cp = await service.create(COOP, chairman, input({ requisites: { ...LEGAL, extra: 'лишнее', ogrn: '  ' } }));
    expect(cp).toMatchObject({ braname: null, name: 'ПАО Сбербанк', tax_id: '7707083893', archived: false, can_manage: true });
    expect(store.rows[0].requisites).not.toHaveProperty('extra');
    expect(store.rows[0].requisites).not.toHaveProperty('ogrn');
    expect(cp.requisites_text).toBe(
      'ИНН 7707083893, КПП 773601001\nРасчётный счёт 40702810938000000001, Банк ПАО Сбербанк, БИК 044525225, Корр. счёт 30101810400000000225'
    );
    expect(cp.requisites.map((r) => r.label)).toEqual(['ИНН', 'КПП', 'Расчётный счёт', 'Банк', 'БИК', 'Корр. счёт']);
  });

  it('член совета тоже добавляет контрагента кооператива', async () => {
    const { service } = build();
    await expect(service.create(COOP, councilMember, input())).resolves.toMatchObject({ braname: null });
  });

  it('опечатка в ИНН или счёте — отказ с названием полей, запись не создаётся', async () => {
    const { service, store } = build();
    const err = await service.create(COOP, chairman, input({ requisites: { ...LEGAL, inn: '7707083894', account: '40702810938000000002' } })).catch((e) => e);
    expect(err).toMatchObject({ code: 'EXPENSES_COUNTERPARTY_REQUISITES_INVALID' });
    expect(JSON.stringify(err)).toContain('ИНН');
    expect(store.rows).toHaveLength(0);
  });

  it('пустое наименование — отказ', async () => {
    const { service } = build();
    await expect(service.create(COOP, chairman, input({ name: '   ' }))).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_NAME_REQUIRED' });
  });

  it('тот же ИНН и тот же счёт — повтор; тот же ИНН с другим счётом — другой контрагент', async () => {
    const { service } = build();
    await service.create(COOP, chairman, input());
    await expect(service.create(COOP, chairman, input({ name: 'Сбер' }))).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_DUPLICATE' });
    // Второй счёт того же банка с верным ключом по БИК 044525225.
    const otherAccount = { ...LEGAL, account: '40702810838000000004' };
    await expect(service.create(COOP, chairman, input({ requisites: otherAccount }))).resolves.toMatchObject({ tax_id: '7707083893' });
  });
});

describe('Контрагенты — участки', () => {
  it('председатель участка добавляет контрагента с пометкой своего участка', async () => {
    const { service } = build();
    await expect(service.create(COOP, krgOperator, input({ braname: 'krg' }))).resolves.toMatchObject({ braname: 'krg', can_manage: true });
  });

  it('оператор участка не добавляет контрагента кооператива и контрагента чужого участка', async () => {
    const { service } = build();
    await expect(service.create(COOP, krgOperator, input())).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN' });
    await expect(service.create(COOP, krgOperator, input({ braname: 'msk' }))).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN' });
    await expect(service.create(COOP, krgOperator, input({ braname: 'nope' }))).rejects.toMatchObject({ code: 'EXPENSES_BRANCH_NOT_FOUND' });
  });

  it('участок видит всех контрагентов кооператива, а править может только своих', async () => {
    const { service } = build();
    const { kpp: _kpp, corr_account: _corr, ogrn: _ogrn, ...ipRequisites } = LEGAL;
    await service.create(COOP, chairman, input());
    await service.create(
      COOP,
      mskOperator,
      input({ braname: 'msk', kind: ExpenseCounterpartyKind.ENTREPRENEUR, name: 'ИП Иванов', requisites: { ...ipRequisites, inn: '500100732259' } })
    );
    await service.create(COOP, krgOperator, input({ braname: 'krg', name: 'Аренда КРГ', requisites: { ...LEGAL, inn: '7736050003' } }));
    const seen = await service.list(COOP, krgOperator);
    expect(seen.map((c) => c.braname).sort()).toEqual(['krg', 'msk', null].sort());
    for (const cp of seen) expect(cp.can_manage).toBe(cp.braname === 'krg');
  });

  it('оператор чужого участка не правит, не архивирует и не удаляет; совет — правит', async () => {
    const { service } = build();
    const cp = await service.create(COOP, krgOperator, input({ braname: 'krg' }));
    await expect(service.update(COOP, mskOperator, cp.id, input())).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN' });
    await expect(service.setArchived(COOP, mskOperator, cp.id, true)).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN' });
    await expect(service.delete(COOP, mskOperator, cp.id)).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_MANAGE_FORBIDDEN' });
    await expect(service.update(COOP, chairman, cp.id, input({ name: 'ПАО Сбербанк России' }))).resolves.toMatchObject({ name: 'ПАО Сбербанк России', braname: 'krg' });
  });

  it('пайщику без участка реестр закрыт', async () => {
    const { service } = build();
    await expect(service.list(COOP, outsider)).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_READ_FORBIDDEN' });
  });
});

describe('Контрагенты — поиск, архив, удаление, оплата', () => {
  it('поиск — по наименованию или налоговому номеру одним запросом, без архива по умолчанию', async () => {
    const { service, store } = build();
    await service.list(COOP, chairman, { search: 'Сбер%' });
    const [where, options] = store.find.mock.calls[store.find.mock.calls.length - 1];
    expect(Array.isArray(where)).toBe(true);
    expect(where).toHaveLength(2);
    expect(where[0]).toMatchObject({ coopname: COOP, archived: false });
    expect(options).toMatchObject({ limit: 200 });
  });

  it('архив скрывает контрагента из выбора и закрывает новую оплату; возврат из архива открывает', async () => {
    const { service } = build();
    const cp = await service.create(COOP, chairman, input());
    await service.setArchived(COOP, chairman, cp.id, true);
    expect(await service.list(COOP, chairman)).toHaveLength(0);
    expect(await service.list(COOP, chairman, { include_archived: true })).toHaveLength(1);
    await expect(service.forPayment(COOP, cp.id)).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_ARCHIVED' });
    await service.setArchived(COOP, chairman, cp.id, false);
    await expect(service.forPayment(COOP, cp.id)).resolves.toMatchObject({ record: { id: cp.id } });
  });

  it('контрагента из неоплаченного планового расхода удалить нельзя; без таких записей — удаляется', async () => {
    const plans = [{ id: 1, coopname: COOP, counterpartyId: 1, paidAt: null }];
    const { service, store } = build({ plans });
    const cp = await service.create(COOP, chairman, input());
    expect(cp.id).toBe(1);
    // Хранилище в памяти не применяет isNull — неоплаченная запись совпадает по номеру контрагента.
    await expect(service.delete(COOP, chairman, cp.id)).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_IN_USE' });
    plans.length = 0;
    await service.delete(COOP, chairman, cp.id);
    expect(store.rows).toHaveLength(0);
  });

  it('оплата: реквизиты строкой — та же строка, что в реестре', async () => {
    const { service } = build();
    const cp = await service.create(COOP, chairman, input());
    const { requisitesText } = await service.forPayment(COOP, cp.id);
    expect(requisitesText).toBe(cp.requisites_text);
  });

  it('чужой кооператив и несуществующий номер — «не найден»', async () => {
    const { service } = build();
    const cp = await service.create(COOP, chairman, input());
    await expect(service.forPayment('other', cp.id)).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_NOT_FOUND' });
    await expect(service.get(COOP, chairman, 999)).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_NOT_FOUND' });
  });

  it('наименования по номерам — одним запросом', async () => {
    const { service, store } = build();
    const cp = await service.create(COOP, chairman, input());
    const names = await service.namesByIds(COOP, [cp.id]);
    expect(names.get(cp.id)).toBe('ПАО Сбербанк');
    expect(await service.namesByIds(COOP, [])).toEqual(new Map());
    expect(store.find).toHaveBeenCalledTimes(2); // повтор при создании + namesByIds
  });
});
