/**
 * Аренда ресурсов по нехватке при отправке транзакции (28.11.2026).
 *
 * Цепь отклонила транзакцию из-за нехватки ресурсов аккаунта — ядро объявляет
 * событие `CHAIN_RESOURCE_SHORTAGE_EVENT`, ждёт слушателей и повторяет
 * транзакцию один раз, если ресурсы арендованы. Раньше транзакция падала, а
 * аренда шла только плановой проверкой раз в минуту.
 */
import { CHAIN_RESOURCE_SHORTAGE_EVENT } from '@coopenomics/innercoop';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { tankBalanceOf } from '~/domain/billing/events/tank-balance.event';
import { ChainResourcesInnercoopAdapter } from '~/infrastructure/innercoop/chain-resources-innercoop.adapter';
import config from '~/config/config';

const ramShortage = () => new Error('account partner1 has insufficient ram; needs 1200 bytes has 800 bytes');

function build(answers: unknown[] = [true]) {
  const events = { emitAsync: jest.fn(async () => answers) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
  const service = new BlockchainService(logger as any, { read: jest.fn(), activeUrl: jest.fn() } as any, {} as any, null, events as any);
  (service as any).session = { actor: 'partner1' };
  const sendAction = jest.spyOn(service as any, 'sendAction');
  return { service, events, sendAction };
}

describe('отправка транзакции: аренда ресурсов по нехватке', () => {
  it('happy: аккаунту не хватило ресурсов — ядро объявляет нехватку, ждёт аренду и повторяет транзакцию', async () => {
    const { service, events, sendAction } = build([true]);
    sendAction.mockRejectedValueOnce(ramShortage()).mockResolvedValue({ ok: true });

    await expect(service.transact({ name: 'x' })).resolves.toEqual({ ok: true });
    expect(events.emitAsync).toHaveBeenCalledWith(
      CHAIN_RESOURCE_SHORTAGE_EVENT,
      expect.objectContaining({ account: 'partner1', kind: 'ram' }),
    );
    expect(sendAction).toHaveBeenCalledTimes(2);
  });

  it('break: никто ресурсы не арендовал — транзакция не повторяется, отказ получает вызывающий', async () => {
    const { service, sendAction } = build([false, undefined]);
    sendAction.mockRejectedValue(ramShortage());

    await expect(service.transact({ name: 'x' })).rejects.toBeDefined();
    expect(sendAction).toHaveBeenCalledTimes(1);
  });

  it('break: отказ контракта нехваткой ресурсов не считается — аренда не объявляется', async () => {
    const { service, events, sendAction } = build([true]);
    sendAction.mockRejectedValue(new Error('assertion failure with message: REGISTRATOR_NOT_OPERATOR: ...'));

    await expect(service.transact({ name: 'x' })).rejects.toBeDefined();
    expect(events.emitAsync).not.toHaveBeenCalled();
  });

  it('break: транзакция самой аренды повторную аренду не объявляет — круга нет', async () => {
    const { service, events, sendAction } = build();
    // Слушатель арендует ресурсы той же отправкой, и ей ресурсов тоже не хватает.
    events.emitAsync.mockImplementation(async () => {
      await service.transact({ name: 'powerup' }).catch(() => undefined);
      return [false];
    });
    sendAction.mockRejectedValue(ramShortage());

    await expect(service.transact({ name: 'x' })).rejects.toBeDefined();
    expect(events.emitAsync).toHaveBeenCalledTimes(1);
  });

  it('side: две транзакции одного аккаунта с нехваткой ждут одну аренду', async () => {
    const { service, events, sendAction } = build([true]);
    sendAction
      .mockRejectedValueOnce(ramShortage())
      .mockRejectedValueOnce(ramShortage())
      .mockResolvedValue({ ok: true });

    await Promise.all([service.transact({ name: 'a' }), service.transact({ name: 'b' })]);
    expect(events.emitAsync).toHaveBeenCalledTimes(1);
  });

  it('side: сборка транзакции без отправки (broadcast=false) аренду не ждёт', async () => {
    const { service, events, sendAction } = build([true]);
    sendAction.mockRejectedValue(ramShortage());

    await expect(service.transact({ name: 'x' }, false)).rejects.toBeDefined();
    expect(events.emitAsync).not.toHaveBeenCalled();
  });
});

describe('остаток AXON из дельты цепи', () => {
  const delta = (over: Record<string, unknown> = {}) => ({
    code: 'eosio.token',
    table: 'accounts',
    scope: 'partner1',
    present: true,
    value: { balance: '1.5000 AXON' },
    ...over,
  });

  it('happy: остаток токена аккаунта — кооператив и число', () => {
    expect(tankBalanceOf(delta(), 'AXON')).toEqual({ coopname: 'partner1', balance: 1.5 });
  });

  it('side: строка остатка стёрта — остаток ноль', () => {
    expect(tankBalanceOf(delta({ present: false }), 'AXON')).toEqual({ coopname: 'partner1', balance: 0 });
  });

  it('break: другая таблица, другой контракт и другой токен остатком бака не считаются', () => {
    expect(tankBalanceOf(delta({ table: 'stat' }), 'AXON')).toBeNull();
    expect(tankBalanceOf(delta({ code: 'ledger2' }), 'AXON')).toBeNull();
    expect(tankBalanceOf(delta({ value: { balance: '100.0000 RUB' } }), 'AXON')).toBeNull();
    expect(tankBalanceOf(delta({ value: {} }), 'AXON')).toBeNull();
  });
});

describe('запрос узла кооператива оператору о баке', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  function adapter(node: { operator: string; url: string } | null) {
    const chain = { getOperatorNode: jest.fn(async () => node) };
    return { port: new ChainResourcesInnercoopAdapter(chain as any), chain };
  }

  it('happy: узел называет оператору свой кооператив по адресу из реестра сети; оператор пополнил — ответ «пополнен»', async () => {
    const fetchMock = jest.fn(async () => ({ status: 200, json: async () => ({ data: { requestTankTopup: true } }) }));
    global.fetch = fetchMock as any;
    const { port, chain } = adapter({ operator: 'voskhod', url: 'https://hub.example.org' });

    await expect(port.requestTankTopup()).resolves.toBe(true);
    expect(chain.getOperatorNode).toHaveBeenCalledWith(config.coopname);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe('https://hub.example.org/backend/v1/graphql');
    expect(JSON.parse(init.body).variables).toEqual({ d: { coopname: config.coopname } });
  });

  it('side: кооператив на своей платформе либо оператор без адреса — запроса нет', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    await expect(adapter(null).port.requestTankTopup()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('break: узел оператора отказал или не ответил — ответ «не пополнен», отказ наружу не выходит', async () => {
    global.fetch = jest.fn(async () => ({ status: 200, json: async () => ({ data: { requestTankTopup: false } }) })) as any;
    await expect(adapter({ operator: 'voskhod', url: 'https://hub.example.org' }).port.requestTankTopup()).resolves.toBe(false);

    global.fetch = jest.fn(async () => {
      throw new Error('fetch failed');
    }) as any;
    await expect(adapter({ operator: 'voskhod', url: 'https://hub.example.org' }).port.requestTankTopup()).resolves.toBe(false);
  });
});
