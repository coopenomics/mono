/** Взнос в программу Благороста отвечает после факта из цепи (ADR-009). */
jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  verifySignedDocumentAgainstStoredDraft: jest.fn(async () => undefined),
}));
import { InvestsManagementService } from '~/extensions/capital/application/services/invests-management.service';

const data = { coopname: 'voskhod', username: 'ant', amount: '1000.0000 RUB', statement: {} } as any;
const tx = { response: { processed: { block_num: 777 } } };

describe('InvestsManagementService.createProgramInvest — ответ после изменения из цепи', () => {
  it('ждёт кошельки пайщика в ledger2 и его взносы в Благоросте из блока транзакции, потом отвечает', async () => {
    const order: string[] = [];
    const interactor = { createProgramInvest: jest.fn(async () => (order.push('tx'), tx)) } as any;
    const chainWait = { afterTransact: jest.fn(async () => (order.push('wait'), true)) } as any;
    const service = new InvestsManagementService(interactor, {} as any, chainWait);

    await expect(service.createProgramInvest(data, {} as any)).resolves.toBe(tx);

    expect(order).toEqual(['tx', 'wait']);
    const [passedTx, waits] = chainWait.afterTransact.mock.calls[0];
    expect(passedTx).toBe(tx);
    expect(waits).toEqual([
      expect.objectContaining({ code: 'ledger2', table: 'userwallets', scope: 'voskhod' }),
      expect.objectContaining({ code: 'capital', table: 'contributors', scope: 'voskhod' }),
    ]);
    expect(waits[0].match({ value: { username: 'ant' } })).toBe(true);
    expect(waits[1].match({ value: { username: 'bob' } })).toBe(false);
  });

  it('без порта ожидания — ответ сразу, как раньше', async () => {
    const interactor = { createProgramInvest: jest.fn(async () => tx) } as any;
    await expect(new InvestsManagementService(interactor, {} as any).createProgramInvest(data, {} as any)).resolves.toBe(tx);
  });
});
