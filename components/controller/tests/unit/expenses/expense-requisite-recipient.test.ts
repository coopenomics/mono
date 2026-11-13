/**
 * Получатель и назначение платежа в снимке реквизитов служебной записки
 * (test-registry/expenses.proposals.yaml, exp.prop.side.recipient-*).
 *
 * У организации аккаунта в кооперативе нет: строка в цепи несёт пустого
 * получателя, и реестр с кассой видят организацию только по названию, которое
 * автор ввёл при подаче. Аванс пайщику кассир проводит с назначением
 * «Аванс под отчёт №<8 знаков хэша позиции>. НДС не облагается.» — номер
 * совпадает с хэшем платежа в реестре.
 */
import type { InnerExpenseRequisiteItemInput } from '@coopenomics/innercoop';
import { VAT_EXEMPT_NOTE } from '@coopenomics/innercoop';
import { ExpenseRequisiteSnapshotsService } from '~/extensions/expenses/application/services/expense-requisite-snapshots.service';
import { ExpensePaymentsListener } from '~/extensions/expenses/application/services/expense-payments.listener';
import { advancePaymentMemo } from '~/extensions/expenses/domain/expenses-chassis.config';
import { ExpenseProposalStatus } from '~/extensions/expenses/domain/enums/expense-proposal-status.enum';

const COOP = 'voskhod';
const PROPOSAL = 'a'.repeat(64);
const ITEM_ORG = 'B1C2D3E4' + 'b'.repeat(56);
const ITEM_MEMBER = 'c'.repeat(64);

function orgItem(overrides: Partial<InnerExpenseRequisiteItemInput> = {}): InnerExpenseRequisiteItemInput {
  return {
    proposalHash: PROPOSAL,
    itemHash: ITEM_ORG,
    recipient: '',
    recipientName: 'ООО «Хостинг»',
    isOrganization: true,
    mechanics: 'DIRECT',
    requisites: 'ИНН 9719026854, р/с 40702810600810037876',
    paymentPurpose: 'Пополнение лицевого счёта #53144',
    ...overrides,
  };
}

function memberItem(): InnerExpenseRequisiteItemInput {
  return {
    proposalHash: PROPOSAL,
    itemHash: ITEM_MEMBER,
    recipient: 'petrov',
    isOrganization: false,
    mechanics: 'ADVANCE',
    paymentMethodId: 'm1',
  };
}

const CARD_TEXT = 'ИНН 7707083893, КПП 773601001\nРасчётный счёт 40702810938000000001, Банк ПАО Сбербанк, БИК 044525225';

function snapshotService(counterparties: unknown = {}) {
  const saved: Record<string, unknown>[] = [];
  const repository = {
    create: (row: Record<string, unknown>) => ({ ...row }),
    saveMany: jest.fn(async (rows: Record<string, unknown>[]) => {
      saved.push(...rows);
      return rows;
    }),
  };
  const paymentMethods = {
    get: jest.fn().mockResolvedValue({ method_id: 'm1', method_type: 'sbp', data: { phone: '+79990000000' } }),
  };
  const service = new ExpenseRequisiteSnapshotsService(paymentMethods as never, repository as never, counterparties as never);
  return { service, saved };
}

describe('Снимок реквизитов: получатель-организация', () => {
  it('получатель организации — введённое название, а не пустой аккаунт', async () => {
    const { service, saved } = snapshotService();
    await service.snapshot(COOP, [orgItem()]);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      recipient: 'ООО «Хостинг»',
      requisites: 'ИНН 9719026854, р/с 40702810600810037876',
      payment_purpose: 'Пополнение лицевого счета #53144',
    });
  });

  it('название обрезается по краям', async () => {
    const { service, saved } = snapshotService();
    await service.snapshot(COOP, [orgItem({ recipientName: '  ИП Сидоров  ' })]);
    expect(saved[0].recipient).toBe('ИП Сидоров');
  });

  it('без названия (старый клиент) получатель остаётся прежним — подача не ломается', async () => {
    const { service, saved } = snapshotService();
    await service.snapshot(COOP, [orgItem({ recipientName: undefined })]);
    expect(saved[0].recipient).toBe('');
  });

  it('название из пробелов не затирает получателя', async () => {
    const { service, saved } = snapshotService();
    await service.snapshot(COOP, [orgItem({ recipientName: '   ' })]);
    expect(saved[0].recipient).toBe('');
  });

  it('у пайщика название игнорируется: получатель — его аккаунт', async () => {
    const { service, saved } = snapshotService();
    await service.snapshot(COOP, [{ ...memberItem(), recipientName: 'Чужое имя' }]);
    expect(saved[0].recipient).toBe('petrov');
  });
});

describe('Назначение платежа аванса под отчёт', () => {
  it('номер — первые 8 знаков хэша позиции в нижнем регистре, затем оговорка НДС', () => {
    expect(advancePaymentMemo('ABCDEF1234' + '0'.repeat(54))).toBe(`Аванс под отчет №abcdef12. ${VAT_EXEMPT_NOTE}`);
  });

  it('назначение передаётся в банк — без буквы «ё», банк её не принимает', () => {
    expect(advancePaymentMemo('ABCDEF1234' + '0'.repeat(54))).not.toMatch(/[ёЁ]/);
  });

  it('снимок аванса пайщику хранит то же назначение', async () => {
    const { service, saved } = snapshotService();
    await service.snapshot(COOP, [memberItem()]);
    expect(saved[0].payment_purpose).toBe(advancePaymentMemo(ITEM_MEMBER));
  });

  it('у организации назначение остаётся введённым при подаче, «ё» заменена на «е» — кассир копирует его в банк', async () => {
    const { service, saved } = snapshotService();
    await service.snapshot(COOP, [orgItem()]);
    expect(saved[0].payment_purpose).toBe('Пополнение лицевого счета #53144');
  });
});

describe('Выплата по утверждённой записке', () => {
  function listener(snapshots: Record<string, Record<string, unknown>>) {
    const created: Record<string, unknown>[] = [];
    const payments = {
      findByHash: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (p: Record<string, unknown>) => {
        created.push(p);
        return { ...p, id: created.length };
      }),
    };
    const store = { findOne: jest.fn(async (q: { item_hash: string }) => snapshots[q.item_hash] ?? null) };
    const logger = { setContext: jest.fn(), log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const l = new ExpensePaymentsListener(payments as never, store as never, { find: jest.fn() } as never, logger as never);
    return { l, created };
  }

  const authorized = (items: { item_hash: string; recipient_type: number; recipient: string }[]) => ({
    entity: {
      coopname: COOP,
      proposal_hash: PROPOSAL,
      status: ExpenseProposalStatus.AUTHORIZED,
      items: items.map((i) => ({ ...i, mechanics: i.recipient_type === 2 ? 1 : 0, description: 'Серверы', planned_amount: '100.0000 RUB' })),
    },
    blockNum: 1,
  });

  it('аванс по записке, поданной до правки (в снимке голое «Аванс под отчёт»), получает номер и оговорку НДС', async () => {
    const { l, created } = listener({ [ITEM_MEMBER]: { recipient: 'petrov', payment_purpose: 'Аванс под отчёт', method_id: 'm1', data: {} } });
    await l.handleProposalSynced(authorized([{ item_hash: ITEM_MEMBER, recipient_type: 1, recipient: 'petrov' }]) as never);
    expect(created[0].memo).toBe(advancePaymentMemo(ITEM_MEMBER));
  });

  it('оплата организации: назначение и имя получателя — из снимка', async () => {
    const { l, created } = listener({
      [ITEM_ORG.toLowerCase()]: { recipient: 'ООО «Хостинг»', payment_purpose: 'Пополнение лицевого счёта #53144', requisites: 'ИНН 9719026854', data: null },
    });
    await l.handleProposalSynced(authorized([{ item_hash: ITEM_ORG, recipient_type: 2, recipient: '' }]) as never);
    expect(created[0].memo).toBe('Пополнение лицевого счёта #53144');
    expect((created[0].payment_details as { data: Record<string, unknown> }).data).toMatchObject({ recipient_name: 'ООО «Хостинг»' });
  });

  it('оплата контрагенту из реестра: реквизиты в платеже — строкой из снимка, а не карточкой-объектом', async () => {
    const { l, created } = listener({
      [ITEM_ORG.toLowerCase()]: {
        recipient: 'ПАО Сбербанк',
        payment_purpose: 'Оплата по договору № 1. Без НДС',
        requisites: CARD_TEXT,
        method_type: 'counterparty',
        data: { counterparty_id: 3, kind: 'LEGAL', name: 'ПАО Сбербанк', requisites: { inn: '7707083893' } },
      },
    });
    await l.handleProposalSynced(authorized([{ item_hash: ITEM_ORG, recipient_type: 2, recipient: '' }]) as never);
    const data = (created[0].payment_details as { data: Record<string, unknown> }).data;
    expect(data).toEqual({ recipient_name: 'ПАО Сбербанк', requisites: CARD_TEXT, counterparty_id: 3 });
  });
});

describe('Снимок реквизитов: организация из реестра контрагентов (99D-35)', () => {
  const card = {
    forPayment: jest.fn(async (_coop: string, id: number) => {
      if (id === 9) throw Object.assign(new Error('archived'), { code: 'EXPENSES_COUNTERPARTY_ARCHIVED' });
      return {
        record: { id, kind: 'LEGAL', name: 'ПАО Сбербанк', payment_purpose: 'Оплата по договору № 1. Без НДС', requisites: { inn: '7707083893' } },
        requisitesText: CARD_TEXT,
      };
    }),
  };

  it('наименование и реквизиты — из карточки контрагента, а не из текста формы', async () => {
    const { service, saved } = snapshotService(card);
    await service.snapshot(COOP, [orgItem({ counterpartyId: 3, recipientName: 'что угодно', requisites: undefined, paymentPurpose: undefined })]);
    expect(saved[0]).toMatchObject({
      recipient: 'ПАО Сбербанк',
      requisites: CARD_TEXT,
      method_type: 'counterparty',
      method_id: '3',
      payment_purpose: 'Оплата по договору № 1. Без НДС',
    });
    expect(saved[0].data).toMatchObject({ counterparty_id: 3, name: 'ПАО Сбербанк' });
  });

  it('назначение платежа из записки важнее назначения по умолчанию', async () => {
    const { service, saved } = snapshotService(card);
    await service.snapshot(COOP, [orgItem({ counterpartyId: 3, requisites: CARD_TEXT, paymentPurpose: 'Счёт № 77' })]);
    expect(saved[0].payment_purpose).toBe('Счет № 77');
  });

  it('реквизиты в подписанной записке разошлись с карточкой — отказ, снимок не сохраняется', async () => {
    const { service, saved } = snapshotService(card);
    await expect(service.validate(COOP, [orgItem({ counterpartyId: 3, requisites: 'ИНН 0000000000' })])).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_CHANGED' });
    expect(saved).toHaveLength(0);
  });

  it('контрагент в архиве — отказ ещё до цепи', async () => {
    const { service } = snapshotService(card);
    await expect(service.validate(COOP, [orgItem({ counterpartyId: 9 })])).rejects.toMatchObject({ code: 'EXPENSES_COUNTERPARTY_ARCHIVED' });
  });

  it('без контрагента организация снимается по тексту формы, как прежде', async () => {
    const { service, saved } = snapshotService(card);
    await service.snapshot(COOP, [orgItem()]);
    expect(saved[0]).toMatchObject({ recipient: 'ООО «Хостинг»', method_type: null });
  });
});
