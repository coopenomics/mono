/**
 * Журнал операций старого плана счетов отдаёт хэш пакета и пайщика.
 *
 * Поля объявлены в схеме и хранятся в журнале, но до 25.09.2026 сервис их не
 * передавал, и совет всегда видел пустые значения (нашёл внешний слой).
 */
import { LedgerService } from '~/application/ledger/services/ledger.service';

describe('история ledger — хэш и пайщик', () => {
  it('операции списания и перевода несут hash и username', async () => {
    const interactor = {
      getLedgerHistory: jest.fn(async () => ({
        items: [
          { global_sequence: 1, coopname: 'voskhod', action: 'add', account_id: 51, quantity: '10.0000 RUB', comment: 'взнос', hash: 'ab'.repeat(32), username: 'ivanov', created_at: new Date(0) },
          { global_sequence: 2, coopname: 'voskhod', action: 'transfer', from_account_id: 51, to_account_id: 80, quantity: '5.0000 RUB', comment: 'перевод', hash: 'cd'.repeat(32), username: 'petrov', created_at: new Date(0) },
        ],
        totalCount: 2,
        totalPages: 1,
        currentPage: 1,
      })),
    } as any;
    const result = await new LedgerService(interactor).getLedgerHistory({ coopname: 'voskhod' } as any);
    expect(result.items.map((i: any) => [i.hash, i.username])).toEqual([
      ['ab'.repeat(32), 'ivanov'],
      ['cd'.repeat(32), 'petrov'],
    ]);
  });
});
