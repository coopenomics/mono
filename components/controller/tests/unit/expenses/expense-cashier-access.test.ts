/**
 * Авансы пайщика и доступ кассира к расходам (test-registry/cashier.desk.yaml).
 *
 * «Авансы» стола пайщика читают записки, в строках которых пайщик —
 * получатель аванса под отчёт (`expenseAdvancesByMember`); список видят сам
 * пайщик и совет. Кассир и ревизор читают реестр расходов целиком: кассе
 * нужна любая записка с её файлами, загрузка в чужую записку им закрыта.
 */
import { ForbiddenException } from '@nestjs/common';
import { MonoAccountStatus } from '@coopenomics/innercoop';
import { ExpensesRights, expensesRightsTable } from '~/extensions/expenses/application/access/expenses-rights';
import { ExpenseProposalResolver } from '~/extensions/expenses/application/resolvers/expense-proposal.resolver';
import { ExpenseFilesService } from '~/extensions/expenses/application/services/expense-files.service';
import { ExpenseProposalKyselyRepository } from '~/extensions/expenses/infrastructure/repositories/expense-proposal.kysely-repository';
import { EXPENSES_PROPOSAL_STORE, expensesStoreProviders } from '~/extensions/expenses/infrastructure/database/expenses-stores';
import { ExpenseChainMechanics } from '~/extensions/expenses/domain/enums/expense-mechanics.enum';
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
    const resolver = new ExpenseProposalResolver(expenses as any, {} as any, rights as any);
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

describe('авансы пайщика (expenseAdvancesByMember)', () => {
  function resolverWith() {
    const page = { items: [], totalCount: 0, totalPages: 0, currentPage: 1 };
    const expenses = {
      listAdvancesByMemberPaginated: jest.fn().mockResolvedValue(page),
      buildProposalDocumentAggregates: jest.fn().mockResolvedValue({}),
    };
    const resolver = new ExpenseProposalResolver(expenses as any, {} as any, {} as any);
    return { resolver, expenses };
  }

  // exp.adv.happy.01
  it('пайщик читает свои авансы, совет — авансы любого пайщика', async () => {
    const { resolver, expenses } = resolverWith();
    const options = { page: 2, limit: 10, sortOrder: 'DESC' } as any;
    await resolver.listAdvancesByMember(COOP, 'ivan', ivan, options);
    await resolver.listAdvancesByMember(COOP, 'ivan', council, undefined);
    expect(expenses.listAdvancesByMemberPaginated).toHaveBeenNthCalledWith(1, COOP, 'ivan', options);
    expect(expenses.listAdvancesByMemberPaginated).toHaveBeenNthCalledWith(2, COOP, 'ivan', undefined);
  });

  // exp.adv.side.01
  it('чужие авансы пайщику и кассиру закрыты', async () => {
    const { resolver, expenses } = resolverWith();
    for (const user of [mallory, cashier]) {
      await expect(resolver.listAdvancesByMember(COOP, 'ivan', user, undefined)).rejects.toMatchObject({ code: 'EXPENSES_PROPOSAL_ACCESS_DENIED' });
    }
    expect(expenses.listAdvancesByMemberPaginated).not.toHaveBeenCalled();
  });

  function repository(results: ScriptedResult[]) {
    const { db, queries } = recordingKysely(results);
    const store = storeFrom(expensesStoreProviders, EXPENSES_PROPOSAL_STORE, db) as never;
    return { repo: new ExpenseProposalKyselyRepository(store, {} as never), queries };
  }

  // exp.adv.happy.02
  it('отбор — записки кооператива со строкой-авансом на этого получателя', async () => {
    const { repo, queries } = repository([{ rows: [] }, { rows: [{ count: '0' }] }]);
    await expect(repo.findAdvancesByRecipientPaginated(COOP, 'ivan', { page: 2, limit: 10, sortOrder: 'DESC' } as any)).resolves.toEqual({
      items: [],
      totalCount: 0,
    });
    const [select, count] = queries;
    expect(select.sql).toContain('p.coopname = $1');
    expect(select.sql).toContain('p.items @> CAST($2 AS jsonb)');
    expect(select.sql).toContain('ORDER BY p."_created_at" DESC');
    expect(select.sql).toContain('LIMIT 10');
    expect(select.sql).toContain('OFFSET 10');
    expect(select.parameters).toEqual([COOP, JSON.stringify([{ recipient: 'ivan', mechanics: ExpenseChainMechanics.ADVANCE }])]);
    expect(count.sql).toContain('COUNT(DISTINCT');
    expect(count.sql).not.toContain('LIMIT');
    expect(count.parameters).toEqual(select.parameters);
  });

  // exp.adv.side.02
  it('неизвестная колонка сортировки и восходящий порядок по ней уходят в сортировку по умолчанию', async () => {
    const { repo, queries } = repository([{ rows: [] }, { rows: [{ count: '0' }] }]);
    await repo.findAdvancesByRecipientPaginated(COOP, 'ivan', { page: 1, limit: 500, sortBy: 'drop table', sortOrder: 'ASC' } as any);
    expect(queries[0].sql).toContain('ORDER BY p."_created_at" DESC');
    expect(queries[0].sql).toContain('LIMIT 200');
    expect(queries[0].sql).not.toContain('OFFSET');
  });
});
