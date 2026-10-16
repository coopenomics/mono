/**
 * Авансы пайщика и доступ кассира к расходам (test-registry/cashier.desk.yaml).
 *
 * «Авансы» стола кассира читают выданные авансы под отчёт по кооперативу
 * (`expenseAdvancesByCooperative`) с отбором по состоянию. Кассир и ревизор
 * читают реестр расходов целиком: кассе нужна любая записка с её файлами,
 * загрузка в чужую записку им закрыта.
 */
import { ForbiddenException } from '@nestjs/common';
import { MonoAccountStatus, PaymentStatus, PaymentType } from '@coopenomics/innercoop';
import { ExpensesRights, expensesRightsTable } from '~/extensions/expenses/application/access/expenses-rights';
import { ExpenseProposalResolver } from '~/extensions/expenses/application/resolvers/expense-proposal.resolver';
import { ExpenseFilesService } from '~/extensions/expenses/application/services/expense-files.service';
import { ExpenseProposalKyselyRepository } from '~/extensions/expenses/infrastructure/repositories/expense-proposal.kysely-repository';
import { EXPENSES_PROPOSAL_STORE, expensesStoreProviders } from '~/extensions/expenses/infrastructure/database/expenses-stores';
import { ExpenseChainMechanics } from '~/extensions/expenses/domain/enums/expense-mechanics.enum';
import { ExpenseChainItemStatus } from '~/extensions/expenses/domain/enums/expense-item-status.enum';
import { ExpenseAdvanceState } from '~/extensions/expenses/domain/enums/expense-advance-state.enum';
import {
  ExpenseAdvancesService,
  queryFor,
  spentOf,
  stateOf,
} from '~/extensions/expenses/application/services/expense-advances.service';
import { recordingKysely, type ScriptedResult } from '../helpers/kysely-recorder';
import { storeFrom } from '../helpers/table-store';

const COOP = 'voskhod';
const PROPOSAL = 'a'.repeat(64);
const ITEM = 'b'.repeat(64);

const ivan = { username: 'ivan', role: 'user', status: MonoAccountStatus.Active } as any;
const cashier = { username: 'kassa', role: 'user', status: MonoAccountStatus.Active } as any;
const auditor = { username: 'olga', role: 'user', status: MonoAccountStatus.Active } as any;
const mallory = { username: 'mallory', role: 'user', status: MonoAccountStatus.Active } as any;
const council = { username: 'petr', role: 'member', status: MonoAccountStatus.Active } as any;
const candidate = { username: 'kassa', role: 'user', status: 'registered' } as any;

const ASSIGNED: Record<string, string[]> = { kassa: ['cashier'], olga: ['auditor'] };

function rightsStand() {
  const grantsRegistry = { register: jest.fn() };
  const roleAssignments = {
    attach: jest.fn(),
    rolesOf: jest.fn(async (_app: string, username: string) => ASSIGNED[username] ?? []),
  };
  const rights = new ExpensesRights(grantsRegistry as any, roleAssignments as any);
  return { rights, grantsRegistry, roleAssignments };
}

describe('права расходов: кассир', () => {
  // cashier.desk.happy.03
  it('кассир читает реестр расходов, оплаты и решения ему не даны', () => {
    const rights = expensesRightsTable.cashier.flatMap((group) => Object.entries(group.rights));
    expect(rights).toEqual([['ExpenseRegistry', ['read']]]);
  });

  // cashier.desk.happy.04
  it('права страниц расходов выдаются столу пайщика и столу кассира; роль кассира дополнена', () => {
    const { rights, grantsRegistry, roleAssignments } = rightsStand();
    rights.onModuleInit();
    const desks = grantsRegistry.register.mock.calls.map(([provider]) => provider.extensionName).sort();
    expect(desks).toEqual(['cashier', 'participant']);
    const attached = roleAssignments.attach.mock.calls[0][1].map((role: { key: string }) => role.key).sort();
    expect(attached).toEqual(['auditor', 'cashier']);
  });

  // cashier.desk.happy.05
  it('реестр целиком читают совет, кассир и ревизор; пайщик без роли и кандидат — нет', async () => {
    const { rights } = rightsStand();
    for (const caller of [council, cashier, auditor]) expect(await rights.readsRegistry(caller)).toBe(true);
    for (const caller of [ivan, candidate]) expect(await rights.readsRegistry(caller)).toBe(false);
  });
});

describe('записка по хешу: читатели реестра', () => {
  function build(readsRegistry: boolean) {
    const expenses = {
      getProposalByHash: jest.fn().mockResolvedValue({ proposal_hash: PROPOSAL, username: 'petr', items: [{ item_hash: ITEM, recipient: 'ivan' }] }),
      buildProposalDocumentAggregates: jest.fn().mockResolvedValue({}),
    };
    const rights = { readsRegistry: jest.fn().mockResolvedValue(readsRegistry) };
    const resolver = new ExpenseProposalResolver(expenses as any, {} as any, rights as any, {} as any);
    return { resolver, rights };
  }

  // cashier.desk.happy.06
  it('кассир открывает чужую записку с кассы', async () => {
    const { resolver } = build(true);
    await expect(resolver.getExpenseProposal(PROPOSAL, cashier)).resolves.toBeTruthy();
  });

  // cashier.desk.side.05
  it('пайщик без роли чужую записку не читает', async () => {
    const { resolver } = build(false);
    await expect(resolver.getExpenseProposal(PROPOSAL, mallory)).rejects.toMatchObject({ code: 'EXPENSES_PROPOSAL_ACCESS_DENIED' });
  });

  it('получателю строки роль читателя реестра не нужна', async () => {
    const { resolver, rights } = build(false);
    await expect(resolver.getExpenseProposal(PROPOSAL, ivan)).resolves.toBeTruthy();
    expect(rights.readsRegistry).not.toHaveBeenCalled();
  });
});

describe('файлы записки: читатели реестра', () => {
  function build() {
    const bucket = { getReadUrl: jest.fn().mockResolvedValue('https://files/x'), put: jest.fn() };
    const files = {
      findById: jest.fn(async () => ({ id: 1, proposal_hash: PROPOSAL, item_hash: ITEM, storage_key: 'k' })),
      findByProposal: jest.fn().mockResolvedValue([]),
      findByItem: jest.fn().mockResolvedValue([]),
      findByChecksum: jest.fn().mockResolvedValue(null),
    };
    const proposals = { findByProposalHash: jest.fn().mockResolvedValue({ username: 'petr', items: [{ item_hash: ITEM, recipient: 'ivan' }] }) };
    const rights = { readsRegistry: jest.fn(async (user: { username: string }) => user.username === 'kassa') };
    const service = new ExpenseFilesService(bucket as any, files as any, {} as any, proposals as any, rights as any);
    return { service, bucket };
  }

  // cashier.desk.happy.07
  it('кассир читает файлы чужой записки и получает ссылку', async () => {
    const { service } = build();
    await expect(service.getReadUrl(1, cashier)).resolves.toMatchObject({ readUrl: 'https://files/x' });
    await expect(service.listByProposal(COOP, PROPOSAL, cashier)).resolves.toEqual([]);
    await expect(service.listByItem(COOP, PROPOSAL, ITEM, cashier)).resolves.toEqual([]);
  });

  // cashier.desk.side.06
  it('кассир не загружает файл в чужую записку', async () => {
    const { service, bucket } = build();
    const input = {
      coopname: COOP,
      proposal_hash: PROPOSAL,
      item_hash: ITEM,
      kind: 'PAYMENT_PROOF',
      mime_type: 'image/png',
      size_bytes: 1,
      checksum_sha256: 'd'.repeat(64),
      content_base64: 'AA==',
    } as any;
    await expect(service.uploadFile(input, cashier)).rejects.toBeInstanceOf(ForbiddenException);
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('посторонний пайщик файлы не читает', async () => {
    const { service, bucket } = build();
    await expect(service.getReadUrl(1, mallory)).rejects.toBeInstanceOf(ForbiddenException);
    expect(bucket.getReadUrl).not.toHaveBeenCalled();
  });
});

describe('авансы кооператива на кассе (expenseAdvancesByCooperative)', () => {
  const advanceItem = (status: number, over: Record<string, unknown> = {}) => ({
    item_hash: ITEM.toUpperCase(),
    mechanics: ExpenseChainMechanics.ADVANCE,
    recipient_type: 1,
    recipient: 'ivan',
    description: 'Закупка воды и бумаги',
    planned_amount: '1500.0000 RUB',
    actual_amount: '1500.0000 RUB',
    status,
    ...over,
  });

  function paymentsStand(settlements: Record<string, unknown>[] = [], advance: Record<string, unknown> | null = null) {
    return {
      list: jest.fn(async (filters: { type: PaymentType }) => {
        const items = settlements.filter((p) => p.type === filters.type);
        return { items, totalCount: items.length, totalPages: items.length ? 1 : 0, currentPage: 1 };
      }),
      findByHash: jest.fn(async () => advance),
    };
  }

  function service(rows: unknown[], payments = paymentsStand()) {
    const proposals = { findAdvances: jest.fn(async () => ({ items: rows, totalCount: rows.length })) };
    const accounts = { getDisplayName: jest.fn(async (u: string) => (u === 'ivan' ? 'Петров Иван Сергеевич' : '')) };
    return { svc: new ExpenseAdvancesService(proposals as any, payments as any, accounts as any), proposals, accounts, payments };
  }

  // exp.adv.happy.01
  it('выданный аванс отдаётся строкой: получатель по ФИО, записка, сумма, состояние и дата выдачи', async () => {
    const issued = new Date('2026-10-16T10:00:00Z');
    const { svc } = service([{ proposal_hash: PROPOSAL.toUpperCase(), item: advanceItem(ExpenseChainItemStatus.PAID) }], paymentsStand([], { completed_at: issued }));
    const page = await svc.list(COOP, undefined, { page: 1, limit: 10 } as any);
    expect(page).toMatchObject({ totalCount: 1, totalPages: 1, currentPage: 1 });
    expect(page.items[0]).toEqual({
      proposal_hash: PROPOSAL,
      item_hash: ITEM,
      recipient: 'ivan',
      recipient_name: 'Петров Иван Сергеевич',
      description: 'Закупка воды и бумаги',
      advance_amount: '1500.0000 RUB',
      spent_amount: null,
      state: ExpenseAdvanceState.AWAITING_REPORT,
      issued_at: issued,
    });
  });

  // exp.adv.happy.02
  it('состояние строки: оплачен — ждёт отчёта; с открытой платёжкой расчёта — возврат или доплата; отчитан — по цепи', () => {
    expect(stateOf(ExpenseChainItemStatus.PAID, false)).toBe(ExpenseAdvanceState.AWAITING_REPORT);
    expect(stateOf(ExpenseChainItemStatus.PAID, true)).toBe(ExpenseAdvanceState.SETTLEMENT);
    expect(stateOf(ExpenseChainItemStatus.REPORTED, true)).toBe(ExpenseAdvanceState.REPORTED);
    expect(spentOf(ExpenseAdvanceState.REPORTED, '1200.0000 RUB', null)).toBe('1200.0000 RUB');
    expect(spentOf(ExpenseAdvanceState.SETTLEMENT, '1500.0000 RUB', { blockchain_data: { reported_amount: '1300.0000 RUB' } } as any)).toBe('1300.0000 RUB');
    expect(spentOf(ExpenseAdvanceState.AWAITING_REPORT, '1500.0000 RUB', null)).toBeNull();
  });

  // exp.adv.happy.03
  it('отбор по состоянию переводится в отбор строк: статус в цепи и строки с открытой платёжкой расчёта', () => {
    const settling = new Set(['x']);
    expect(queryFor(ExpenseAdvanceState.AWAITING_REPORT, settling)).toEqual({ statuses: [ExpenseChainItemStatus.PAID], exceptItems: ['x'] });
    expect(queryFor(ExpenseAdvanceState.SETTLEMENT, settling)).toEqual({ statuses: [ExpenseChainItemStatus.PAID], onlyItems: ['x'] });
    expect(queryFor(ExpenseAdvanceState.REPORTED, settling)).toEqual({ statuses: [ExpenseChainItemStatus.REPORTED] });
    // Без отбора — все выданные: не выданные авансы (APPROVED) на кассе не стоят.
    expect(queryFor(undefined, settling)).toEqual({ statuses: [ExpenseChainItemStatus.PAID, ExpenseChainItemStatus.REPORTED] });
  });

  // exp.adv.side.01
  it('открытой считается только непроведённая платёжка расчёта: проведённая и отменённая строку не держат', async () => {
    const payments = paymentsStand([
      { type: PaymentType.EXPENSE_RETURN, status: PaymentStatus.PENDING, blockchain_data: { item_hash: 'AA' } },
      { type: PaymentType.EXPENSE_OVERSPEND, status: PaymentStatus.PAID, blockchain_data: { item_hash: 'bb' } },
      { type: PaymentType.EXPENSE_RETURN, status: PaymentStatus.COMPLETED, blockchain_data: { item_hash: 'cc' } },
      { type: PaymentType.EXPENSE_RETURN, status: PaymentStatus.CANCELLED, blockchain_data: { item_hash: 'dd' } },
    ]);
    const { svc } = service([], payments);
    expect([...(await svc.settlingItems(COOP))].sort()).toEqual(['aa', 'bb']);
    expect(payments.list.mock.calls.map(([filters]) => filters)).toEqual([
      { coopname: COOP, type: PaymentType.EXPENSE_RETURN },
      { coopname: COOP, type: PaymentType.EXPENSE_OVERSPEND },
    ]);
  });

  // exp.adv.side.02
  it('пайщик без ФИО показывается учётным именем, сбой справочника строку не роняет; без платежа выдачи даты нет', async () => {
    const rows = [
      { proposal_hash: PROPOSAL, item: advanceItem(ExpenseChainItemStatus.REPORTED, { recipient: 'nofio', actual_amount: '900.0000 RUB' }) },
      { proposal_hash: PROPOSAL, item: advanceItem(ExpenseChainItemStatus.PAID, { recipient: 'broken', item_hash: 'c'.repeat(64) }) },
    ];
    const { svc, accounts } = service(rows);
    accounts.getDisplayName.mockImplementation(async (u: string) => {
      if (u === 'broken') throw new Error('нет связи');
      return '';
    });
    const page = await svc.list(COOP, { state: undefined } as any, undefined);
    expect(page.items.map((r) => [r.recipient_name, r.state, r.spent_amount, r.issued_at])).toEqual([
      ['nofio', ExpenseAdvanceState.REPORTED, '900.0000 RUB', null],
      ['broken', ExpenseAdvanceState.AWAITING_REPORT, null, null],
    ]);
  });

  it('резолвер передаёт отбор и страницу сервису', async () => {
    const advances = { list: jest.fn().mockResolvedValue({ items: [], totalCount: 0, totalPages: 0, currentPage: 1 }) };
    const resolver = new ExpenseProposalResolver({} as any, {} as any, {} as any, advances as any);
    const filter = { state: ExpenseAdvanceState.SETTLEMENT } as any;
    await resolver.listAdvancesByCooperative(COOP, filter, { page: 2, limit: 10 } as any);
    expect(advances.list).toHaveBeenCalledWith(COOP, filter, { page: 2, limit: 10 });
  });

  function repository(results: ScriptedResult[]) {
    const { db, queries } = recordingKysely(results);
    const store = storeFrom(expensesStoreProviders, EXPENSES_PROPOSAL_STORE, db) as never;
    return { repo: new ExpenseProposalKyselyRepository(store, {} as never), queries };
  }

  // exp.adv.happy.04
  it('хранилище разворачивает строки записок кооператива и берёт только авансы нужных статусов', async () => {
    const item = advanceItem(ExpenseChainItemStatus.PAID);
    const { repo, queries } = repository([{ rows: [{ proposal_hash: PROPOSAL, item }] }, { rows: [{ count: '1' }] }]);
    const result = await repo.findAdvances(COOP, { statuses: [1, 2], exceptItems: ['x'] }, { page: 2, limit: 10 } as any);
    expect(result).toEqual({ items: [{ proposal_hash: PROPOSAL, item }], totalCount: 1 });
    const [select, count] = queries;
    expect(select.sql).toContain('INNER JOIN jsonb_array_elements(p.items) i ON true');
    expect(select.sql).toContain('p.coopname = $1');
    expect(select.sql).toContain("CAST(i.value->>'mechanics' AS integer) = $2");
    expect(select.sql).toContain("CAST(i.value->>'status' AS integer) IN ($3, $4)");
    expect(select.sql).toContain("LOWER(i.value->>'item_hash') NOT IN ($5)");
    expect(select.sql).toContain('ORDER BY p.created_at DESC');
    expect(select.sql).toContain('LIMIT 10');
    expect(select.sql).toContain('OFFSET 10');
    expect(select.parameters).toEqual([COOP, ExpenseChainMechanics.ADVANCE, 1, 2, 'x']);
    expect(count.sql).toContain('COUNT(*)');
    expect(count.sql).not.toContain('LIMIT');
    expect(count.sql).not.toContain('ORDER BY');
    expect(count.parameters).toEqual(select.parameters);
  });

  // exp.adv.side.03
  it('пустой перечень исключений не пишется (иначе NOT IN (NULL) отсёк бы все строки), пустой «только» не даёт строк', async () => {
    const { repo, queries } = repository([{ rows: [] }, { rows: [{ count: '0' }] }, { rows: [] }, { rows: [{ count: '0' }] }]);
    await repo.findAdvances(COOP, { statuses: [1], exceptItems: [] }, undefined);
    expect(queries[0].sql).not.toContain('NOT IN');
    await repo.findAdvances(COOP, { statuses: [1], onlyItems: [] }, undefined);
    expect(queries[2].sql).toContain("LOWER(i.value->>'item_hash') IN (NULL)");
  });

  // exp.adv.side.04
  it('лимит страницы ограничен 200', async () => {
    const { repo, queries } = repository([{ rows: [] }, { rows: [{ count: '0' }] }]);
    await repo.findAdvances(COOP, { statuses: [1] }, { page: 1, limit: 500 } as any);
    expect(queries[0].sql).toContain('LIMIT 200');
    expect(queries[0].sql).not.toContain('OFFSET');
  });
});
