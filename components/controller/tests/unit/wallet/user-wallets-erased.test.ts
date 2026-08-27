import { WalletInteractor } from '~/application/wallet/interactors/wallet.interactor';

/**
 * Стёртый кошелёк (present=false) — обнулённый: контракт удаляет запись из
 * chain-RAM, когда баланс дошёл до нуля, а проекция хранит последнее известное
 * значение как след истории. Наружу оно уходить не должно.
 */
describe('WalletInteractor.getUserWallets — стёртые кошельки', () => {
  const build = (rows: any[]) => {
    const userWalletRepository = { findByUsername: jest.fn().mockResolvedValue(rows) };
    const interactor = Object.create(WalletInteractor.prototype) as WalletInteractor;
    (interactor as any).userWalletRepository = userWalletRepository;
    return interactor;
  };

  it('break: present=false → остаток ноль в том же символе, а не последнее значение из истории', async () => {
    // Ровно этот случай: кооператив видел 3 660 ₽ на членском кошельке,
    // которых в цепи давно не было, и не понимал, почему списание не идёт.
    const interactor = build([
      {
        id: '1',
        coopname: 'voskhod',
        wallet_name: 'w.wal.bill',
        username: 'partner1',
        available: '3660.0000 RUB',
        blocked: '0.0000 RUB',
        present: false,
      },
    ]);

    const [wallet] = await interactor.getUserWallets('partner1', 'voskhod');

    expect(wallet.available).toBe('0.0000 RUB');
    expect(wallet.blocked).toBe('0.0000 RUB');
  });

  it('happy: живой кошелёк отдаёт свой остаток без изменений', async () => {
    const interactor = build([
      {
        id: '2',
        coopname: 'voskhod',
        wallet_name: 'w.wal.share',
        username: 'partner1',
        available: '24840.0000 RUB',
        blocked: '0.0000 RUB',
        present: true,
      },
    ]);

    const [wallet] = await interactor.getUserWallets('partner1', 'voskhod');

    expect(wallet.available).toBe('24840.0000 RUB');
  });

  it('side: строка без флага present считается живой — легаси-записи не обнуляем', async () => {
    const interactor = build([
      {
        id: '3',
        coopname: 'voskhod',
        wallet_name: 'w.wal.share',
        username: 'partner1',
        available: '100.0000 RUB',
        blocked: '0.0000 RUB',
      },
    ]);

    const [wallet] = await interactor.getUserWallets('partner1', 'voskhod');

    expect(wallet.available).toBe('100.0000 RUB');
  });
});
