/**
 * Трансляция паевого взноса из Благороста в Цифровой Кошелёк (случаи
 * cap.share-transfer.* в test-registry/capital.share-transfer.yaml).
 *
 * Сервис проверяет правило контракта «не больше остатка» до цепи, сверяет
 * заявление с сохранённым черновиком на ту же сумму, отправляет
 * `capital::wthshare` суммой в виде цепи и пишет историю после факта из цепи.
 */
import { Classes } from '@coopenomics/sdk';
import { ShareTransferService } from '~/extensions/capital/application/services/share-transfer.service';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', blockchain: { rootGovernSymbol: 'RUB', rootGovernPrecision: 4 } }),
}));

const STATEMENT = { hash: 'ABCDEF', doc_hash: 'ABCDEF', meta_hash: 'ABCDEF', version: '1.0', meta: { amount: '1500.0000 RUB' }, signatures: [] };

function make(o: { balance?: string | null; draft?: unknown; comparison?: { isValid: boolean; differences: Record<string, unknown> } } = {}) {
  const chain = { transferShare: jest.fn(async () => ({ response: { transaction_id: 'tx-1' } })) };
  const documents = { getByHash: jest.fn(async () => ('draft' in o ? o.draft : { hash: 'ABCDEF' })) };
  const balanceState = { current: 'balance' in o ? o.balance : '2000.0000 RUB' };
  const wallets = {
    findByWalletAndUsername: jest.fn(async () => (balanceState.current === null ? null : { available: balanceState.current })),
  };
  const contributors = {
    findByUsernameAndCoopname: jest.fn(async (username: string) => (username === 'ivan' ? { display_name: 'Иванов Иван' } : null)),
  };
  const saved: any[] = [];
  const reservedHashes = new Set<string>();
  const transfers = {
    // Как в базе: уникальный индекс по хэшу заявления.
    reserve: jest.fn(async (d: any) => {
      if (reservedHashes.has(d.statement_hash)) throw Object.assign(new Error('CAPITAL_SHARE_TRANSFER_STATEMENT_USED'), { code: 'CAPITAL_SHARE_TRANSFER_STATEMENT_USED' });
      reservedHashes.add(d.statement_hash);
      const row = { ...d, _id: `r${saved.length + 1}`, transaction_id: '', confirmed: false };
      saved.push(row);
      return row;
    }),
    confirm: jest.fn(async (id: string, transactionId: string) => {
      Object.assign(saved.find((r) => r._id === id), { transaction_id: transactionId, confirmed: true });
      // Цепь списала сумму — следующий запрос остатка видит новый.
      balanceState.current = '500.0000 RUB';
    }),
    release: jest.fn(async (id: string) => {
      const i = saved.findIndex((r) => r._id === id && !r.confirmed);
      if (i >= 0) reservedHashes.delete(saved.splice(i, 1)[0].statement_hash);
    }),
    list: jest.fn(async () => ({
      items: [
        { _id: '1', coopname: 'voskhod', username: 'ivan', amount: '100.0000 RUB', statement_hash: 'h1', statement: {}, transaction_id: 't1', created_at: new Date('2026-10-21') },
        { _id: '2', coopname: 'voskhod', username: 'petr', amount: '50.0000 RUB', statement_hash: 'h2', statement: {}, transaction_id: 't2', created_at: new Date('2026-10-20') },
      ],
      totalCount: 2,
      totalPages: 1,
      currentPage: 1,
    })),
  };
  const chainWait = { afterTransact: jest.fn(async () => undefined) };
  const service = new ShareTransferService(chain as any, documents as any, wallets as any, contributors as any, transfers as any, chainWait as any);
  jest.spyOn(Classes.Document, 'compareDocuments').mockResolvedValue((o.comparison ?? { isValid: true, differences: {} }) as any);
  return { service, chain, documents, wallets, transfers, saved, chainWait };
}

const input = (amount: string, meta: Record<string, unknown> = { amount }) => ({
  coopname: 'voskhod',
  username: 'ivan',
  amount,
  statement: { ...STATEMENT, meta } as any,
});

afterEach(() => jest.restoreAllMocks());

describe('трансляция паевого взноса: остаток', () => {
  it('остаток — доступная часть кошелька Благороста пайщика', async () => {
    const { service, wallets } = make();
    await expect(service.state('ivan')).resolves.toEqual({ username: 'ivan', blagorost_balance: '2000.0000 RUB' });
    expect(wallets.findByWalletAndUsername).toHaveBeenCalledWith('voskhod', 'w.cap.blago', 'ivan');
  });

  it('пайщик без кошелька Благороста видит нулевой остаток', async () => {
    const { service } = make({ balance: null });
    await expect(service.state('ivan')).resolves.toEqual({ username: 'ivan', blagorost_balance: '0.0000 RUB' });
  });
});

describe('трансляция паевого взноса: отправка', () => {
  it('сумма уходит в цепь в виде цепи, строка резервируется до цепи и подтверждается после, ответ — новый остаток', async () => {
    const { service, chain, transfers, saved, chainWait } = make();
    const result = await service.transfer(input('1500 RUB', { amount: '1500.00 RUB' }));
    expect(chain.transferShare).toHaveBeenCalledWith(expect.objectContaining({ coopname: 'voskhod', username: 'ivan', amount: '1500.0000 RUB' }));
    expect(transfers.reserve.mock.invocationCallOrder[0]).toBeLessThan(chain.transferShare.mock.invocationCallOrder[0]);
    expect(chainWait.afterTransact).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([
      expect.objectContaining({ username: 'ivan', amount: '1500.0000 RUB', statement_hash: 'abcdef', transaction_id: 'tx-1', confirmed: true }),
    ]);
    expect(result).toEqual({ username: 'ivan', blagorost_balance: '500.0000 RUB' });
  });

  it('повтор того же подписанного заявления отклоняется до цепи — второго списания нет', async () => {
    const { service, chain } = make({ balance: '5000.0000 RUB' });
    await service.transfer(input('1500 RUB'));
    await expect(service.transfer(input('1500 RUB'))).rejects.toMatchObject({ code: 'CAPITAL_SHARE_TRANSFER_STATEMENT_USED' });
    expect(chain.transferShare).toHaveBeenCalledTimes(1);
  });

  it('весь остаток транслируется целиком', async () => {
    const { service, chain } = make();
    await service.transfer(input('2000.0000 RUB'));
    expect(chain.transferShare).toHaveBeenCalledWith(expect.objectContaining({ amount: '2000.0000 RUB' }));
  });

  it.each(['0 RUB', '-5 RUB', 'abc', '100 USD'])('сумма «%s» отклоняется до цепи', async (amount) => {
    const { service, chain, transfers } = make();
    await expect(service.transfer(input(amount))).rejects.toMatchObject({ code: 'CAPITAL_SHARE_TRANSFER_AMOUNT_INVALID' });
    expect(chain.transferShare).not.toHaveBeenCalled();
    expect(transfers.reserve).not.toHaveBeenCalled();
  });

  it('сумма больше остатка отклоняется до цепи', async () => {
    const { service, chain } = make({ balance: '1000.0000 RUB' });
    await expect(service.transfer(input('1000.0001 RUB'))).rejects.toMatchObject({ code: 'CAPITAL_SHARE_TRANSFER_INSUFFICIENT' });
    expect(chain.transferShare).not.toHaveBeenCalled();
  });

  it('без кошелька Благороста транслировать нечего', async () => {
    const { service, chain } = make({ balance: null });
    await expect(service.transfer(input('1 RUB'))).rejects.toMatchObject({ code: 'CAPITAL_SHARE_TRANSFER_INSUFFICIENT' });
    expect(chain.transferShare).not.toHaveBeenCalled();
  });

  it('заявление на другую сумму отклоняется до цепи', async () => {
    const { service, chain } = make();
    await expect(service.transfer(input('1500 RUB', { amount: '1000.00 RUB' }))).rejects.toMatchObject({ code: 'KIT_DOCUMENT_FIELD_MISMATCH' });
    expect(chain.transferShare).not.toHaveBeenCalled();
  });

  it('заявление, которого сервер не генерировал, отклоняется до цепи', async () => {
    const { service, chain } = make({ draft: null });
    await expect(service.transfer(input('1500 RUB'))).rejects.toMatchObject({ code: 'KIT_GENERATED_DOCUMENT_NOT_FOUND' });
    expect(chain.transferShare).not.toHaveBeenCalled();
  });

  it('отказ цепи доходит до пайщика, резерв снимается — то же заявление можно отправить снова', async () => {
    const { service, chain, transfers, saved } = make();
    chain.transferShare.mockRejectedValueOnce(new Error('CAPITAL_SHARE_INSUFFICIENT: Паевого взноса по программе недостаточно'));
    await expect(service.transfer(input('1500 RUB'))).rejects.toThrow('CAPITAL_SHARE_INSUFFICIENT');
    expect(transfers.release).toHaveBeenCalledTimes(1);
    expect(transfers.confirm).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
    await expect(service.transfer(input('1500 RUB'))).resolves.toEqual({ username: 'ivan', blagorost_balance: '500.0000 RUB' });
  });
});

describe('трансляция паевого взноса: история', () => {
  it('строки истории несут имя пайщика, без карточки Благороста — учётное имя', async () => {
    const { service, transfers } = make();
    const page = await service.list(undefined);
    expect(transfers.list).toHaveBeenCalledWith('voskhod', undefined, undefined);
    expect(page.items.map((i) => [i.username, i.display_name])).toEqual([
      ['ivan', 'Иванов Иван'],
      ['petr', 'petr'],
    ]);
    expect(page.items[0]).not.toHaveProperty('statement');
  });
});
