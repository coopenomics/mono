/**
 * Аренда ресурсов по событию (28.11.2026, слово владельца: «если ресурсов не
 * хватает, весь кооператив сидит пять минут ждёт… надо сразу»).
 *
 *   - транзакция узла получила отказ по ресурсам — аренда сразу, ядро повторяет
 *     транзакцию;
 *   - аренда не прошла (бак AXON пуст) — узел сразу просит оператора пополнить бак;
 *   - бак пополнен — пауза после отказов снимается, аренда идёт сразу.
 */
jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'partner1', blockchain: { rootSymbol: 'AXON', rootPrecision: 4 } }),
}));

import { PowerupExtension, defaultConfig } from '~/extensions/powerup/powerup-extension.module';

const account = (cpuUsed: number) => ({
  account_name: 'partner1',
  cpu_limit: { used: cpuUsed, max: 100 },
  net_limit: { used: 1, max: 100 },
  ram_quota: 1000,
  ram_usage: 10,
});

function build(opts: { powerUpError?: Error; cpuUsed?: number } = {}) {
  const chain = {
    getAccount: jest.fn(async () => account(opts.cpuUsed ?? 10)),
    powerUp: jest.fn(async () => {
      if (opts.powerUpError) throw opts.powerUpError;
      return 'tx-powerup';
    }),
    requestTankTopup: jest.fn(async () => false),
  };
  const logs = { push: jest.fn(async () => undefined) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const ext = new PowerupExtension({} as never, logs as never, logger as never, chain as never);
  ext.extension = { name: 'powerup', config: { ...defaultConfig } } as never;
  return { ext, chain, logs, logger };
}

const shortage = (account = 'partner1') => ({ account, kind: 'cpu' as const, reason: 'insufficient objective cpu resources' });
const balanceDelta = (balance: string, over: Record<string, unknown> = {}) =>
  ({ code: 'eosio.token', table: 'accounts', scope: 'partner1', present: true, value: { balance }, ...over }) as never;
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('аренда ресурсов по нехватке', () => {
  it('happy: транзакция кооператива получила отказ по ресурсам — аренда суточным пакетом, запись в журнале, ядру ответ «арендовано»', async () => {
    const { ext, chain, logs } = build();

    expect(await ext.onResourceShortage(shortage())).toBe(true);
    expect(chain.powerUp).toHaveBeenCalledWith('partner1', '5.0000 AXON');
    expect(logs.push).toHaveBeenCalledWith('powerup', expect.objectContaining({ type: 'now', amount: '5.0000 AXON', trx_id: 'tx-powerup' }));
  });

  it('break: нехватка у чужого аккаунта — узел за него ресурсы не арендует', async () => {
    const { ext, chain } = build();

    expect(await ext.onResourceShortage(shortage('stranger'))).toBe(false);
    expect(chain.powerUp).not.toHaveBeenCalled();
  });

  it('side: две транзакции с нехваткой подряд ждут одну аренду', async () => {
    const { ext, chain } = build();

    const [a, b] = await Promise.all([ext.onResourceShortage(shortage()), ext.onResourceShortage(shortage())]);
    expect([a, b]).toEqual([true, true]);
    expect(chain.powerUp).toHaveBeenCalledTimes(1);
  });

  it('break: аренда не прошла — ядру ответ «не арендовано», узел просит оператора пополнить бак, в журнале аренды записи нет', async () => {
    const { ext, chain, logs } = build({ powerUpError: new Error('assertion failure with message: overdrawn balance') });

    expect(await ext.onResourceShortage(shortage())).toBe(false);
    expect(chain.requestTankTopup).toHaveBeenCalledTimes(1);
    expect(logs.push).not.toHaveBeenCalled();
  });

  it('break: пока идёт пауза после отказа, новая нехватка аренду не начинает и оператора повторно не просит', async () => {
    const { ext, chain } = build({ powerUpError: new Error('overdrawn balance') });

    await ext.onResourceShortage(shortage());
    expect(await ext.onResourceShortage(shortage())).toBe(false);
    expect(chain.powerUp).toHaveBeenCalledTimes(1);
    expect(chain.requestTankTopup).toHaveBeenCalledTimes(1);
  });
});

describe('пауза аренды снимается при пополнении бака', () => {
  it('happy: после отказа аренды бак пополнен — пауза снята, плановая проверка идёт сразу и арендует ресурсы', async () => {
    const { ext, chain } = build({ powerUpError: new Error('overdrawn balance'), cpuUsed: 90 });
    await ext.onResourceShortage(shortage());
    chain.powerUp.mockResolvedValue('tx-after-topup');

    ext.onOwnBalanceChanged(balanceDelta('5.0000 AXON'));
    await flush();
    await flush();

    expect(chain.powerUp).toHaveBeenCalledTimes(2);
    expect(await ext.onResourceShortage(shortage())).toBe(true);
  });

  it('side: отказов аренды не было — изменение остатка аренду не запускает', async () => {
    const { ext, chain } = build({ cpuUsed: 90 });

    ext.onOwnBalanceChanged(balanceDelta('50.0000 AXON'));
    await flush();

    expect(chain.getAccount).not.toHaveBeenCalled();
    expect(chain.powerUp).not.toHaveBeenCalled();
  });

  it('break: чужой остаток, другой токен, остаток меньше пакета и стёртая строка паузу не снимают', async () => {
    const { ext, chain } = build({ powerUpError: new Error('overdrawn balance'), cpuUsed: 90 });
    await ext.onResourceShortage(shortage());

    ext.onOwnBalanceChanged(balanceDelta('50.0000 AXON', { scope: 'stranger' }));
    ext.onOwnBalanceChanged(balanceDelta('50.0000 RUB'));
    ext.onOwnBalanceChanged(balanceDelta('1.0000 AXON'));
    ext.onOwnBalanceChanged(balanceDelta('50.0000 AXON', { present: false }));
    await flush();

    expect(chain.powerUp).toHaveBeenCalledTimes(1);
    expect(await ext.onResourceShortage(shortage())).toBe(false);
  });
});
