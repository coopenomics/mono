/** Расходы программы: средства фонда выделяются под расход, записку ведёт общее шасси. */
import { EdubridgeExpenseService } from '~/extensions/edubridge/application/services/edubridge-expense.service';
import { InnerExpenseMechanics, InnerExpenseProposalState, InnerExpenseRecipientType } from '@coopenomics/innercoop';

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), setContext: jest.fn() } as any;

function make(options: { proposals?: any[]; chainFails?: boolean } = {}) {
  const chain = {
    createExpense: jest.fn(async () => {
      if (options.chainFails) throw new Error('Недостаточно средств фонда');
      return { transaction_id: 'TRX' };
    }),
  } as any;
  const expenses = {
    validateRequisites: jest.fn(async () => undefined),
    snapshotRequisites: jest.fn(async () => undefined),
    listProposalsByOwner: jest.fn(async () => ({ items: options.proposals ?? [], totalCount: (options.proposals ?? []).length })),
  } as any;
  const names = { displayNames: jest.fn(async (us: string[]) => new Map(us.map((u) => [u, `ФИО ${u}`]))) } as any;
  return { service: new EdubridgeExpenseService(chain, expenses, names, logger), chain, expenses };
}

const statement = { hash: 'DEADBEEF', meta: {}, public_key: '', signature: '', signer: 'chairman', signatures: [] } as any;

const input = {
  expense_hash: 'ABC123',
  items: [
    {
      item_hash: 'I1',
      mechanics: InnerExpenseMechanics.DIRECT,
      recipient_type: InnerExpenseRecipientType.ORG,
      recipient: 'ООО «Площадка»',
      description: 'Годовой доступ к площадке обучения',
      planned_amount: '50000.0000 RUB',
      requisites: 'ИНН 7700000000',
      payment_purpose: 'Оплата по счёту № 12',
    },
  ],
  statement,
} as any;

describe('EdubridgeExpenseService', () => {
  it('подача расхода: реквизиты проверяются до цепи, снимок — после успешной подачи', async () => {
    const { service, chain, expenses } = make();
    const hash = await service.create('voskhod', 'chairman', input);
    expect(hash).toBe('ABC123');
    expect(expenses.validateRequisites).toHaveBeenCalled();
    const [payload] = chain.createExpense.mock.calls[0];
    expect(payload.creator).toBe('chairman');
    // Организация уходит на цепь без имени получателя: аккаунта у неё нет.
    expect(payload.items[0].recipient).toBe('');
    expect(payload.items[0].mechanics).toBe(1);
    expect(payload.items[0].recipient_type).toBe(2);
    expect(payload.items[0].actual_amount).toBe('0.0000 RUB');
    expect(expenses.snapshotRequisites).toHaveBeenCalled();
  });

  it('цепь отказала — снимок реквизитов не снимается', async () => {
    const { service, expenses } = make({ chainFails: true });
    await expect(service.create('voskhod', 'chairman', input)).rejects.toThrow();
    expect(expenses.snapshotRequisites).not.toHaveBeenCalled();
  });

  it('список расходов: состояние и ФИО подавшего читаются человеком', async () => {
    const proposals = [
      {
        coopname: 'voskhod',
        proposalHash: 'ABC123',
        sourceWalletCode: 'w.edu.expns',
        creator: 'chairman',
        status: 'AUTHORIZED',
        items: [
          {
            itemHash: 'I1',
            mechanics: 0,
            recipientType: 1,
            recipient: 'teach',
            description: 'Методические материалы',
            plannedAmount: '5000.0000 RUB',
            actualAmount: '0.0000 RUB',
            status: 0,
          },
        ],
        totalPlanned: '5000.0000 RUB',
        totalActual: '0.0000 RUB',
        createdAt: '2026-09-19T10:00:00.000Z',
        updatedAt: '2026-09-19T10:00:00.000Z',
      },
    ];
    const { service } = make({ proposals });
    const page = await service.list('voskhod');
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.status).toBe(InnerExpenseProposalState.AUTHORIZED);
    expect(page.items[0]!.creator_name).toBe('ФИО chairman');
    expect(page.items[0]!.items[0]!.recipient_name).toBe('ФИО teach');
    expect(page.items[0]!.items[0]!.mechanics).toBe(InnerExpenseMechanics.ADVANCE);
  });
});
