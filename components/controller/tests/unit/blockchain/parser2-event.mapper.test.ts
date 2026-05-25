/**
 * Unit-тесты mapParserDeltaToIDelta / mapParserActionToIAction (миграция на parser2).
 *
 * Маппер — единственная точка перевода ParserEvent → IDelta/IAction при смене
 * транспорта (DEC-T09). Дельта мапится один-в-один; action — с дефолтами для
 * трейс-полей, которых нет в parser2 (transaction_id/creator_action_ordinal и
 * receipt-детали). Тесты фиксируют контракт маппинга, в т.ч. что receipt не null
 * (read-path explorer'а и notification-фильтр по receipt.receiver не должны падать).
 */

import { mapParserActionToIAction, mapParserDeltaToIDelta } from '~/infrastructure/blockchain/parser2-event.mapper';

function deltaEvent(over: Record<string, any> = {}): any {
  return {
    kind: 'delta',
    event_id: 'chain-aaa:d:100:0123456789abcdef:eosio.token:voskhod:accounts:42',
    chain_id: 'chain-aaa',
    block_num: 100,
    block_time: '2026-05-25T00:00:00.000Z',
    block_id: '0123456789abcdef0000',
    code: 'eosio.token',
    scope: 'voskhod',
    table: 'accounts',
    primary_key: '42',
    value: { balance: '10.0000 RUB', coopname: 'voskhod' },
    present: true,
    ...over,
  };
}

function actionEvent(over: Record<string, any> = {}): any {
  return {
    kind: 'action',
    event_id: 'chain-aaa:a:100:0123456789abcdef:777',
    chain_id: 'chain-aaa',
    block_num: 100,
    block_time: '2026-05-25T00:00:00.000Z',
    block_id: '0123456789abcdef0000',
    account: 'eosio.token',
    name: 'transfer',
    authorization: [{ actor: 'voskhod', permission: 'active' }],
    data: { from: 'voskhod', to: 'ant', quantity: '1.0000 RUB' },
    action_ordinal: 1,
    global_sequence: 777n,
    receipt: null,
    ...over,
  };
}

describe('mapParserDeltaToIDelta', () => {
  it('мапит все поля DeltaEvent один-в-один', () => {
    const d = mapParserDeltaToIDelta(deltaEvent());
    expect(d).toEqual({
      chain_id: 'chain-aaa',
      block_num: 100,
      block_id: '0123456789abcdef0000',
      present: true,
      code: 'eosio.token',
      scope: 'voskhod',
      table: 'accounts',
      primary_key: '42',
      value: { balance: '10.0000 RUB', coopname: 'voskhod' },
    });
  });

  it('пробрасывает present=false (удаление строки)', () => {
    expect(mapParserDeltaToIDelta(deltaEvent({ present: false })).present).toBe(false);
  });
});

describe('mapParserActionToIAction', () => {
  it('мапит доступные поля action и сериализует global_sequence (bigint → string)', () => {
    const a = mapParserActionToIAction(actionEvent());
    expect(a.account).toBe('eosio.token');
    expect(a.name).toBe('transfer');
    expect(a.block_num).toBe(100);
    expect(a.data).toEqual({ from: 'voskhod', to: 'ant', quantity: '1.0000 RUB' });
    expect(a.global_sequence).toBe('777');
    expect(typeof a.global_sequence).toBe('string');
    expect(a.authorization).toEqual([{ actor: 'voskhod', permission: 'active' }]);
  });

  it('выставляет receiver = account (guard processAction пропускает событие)', () => {
    expect(mapParserActionToIAction(actionEvent()).receiver).toBe('eosio.token');
  });

  it('receipt не null и несёт global_sequence (read-path explorer/notification не падают)', () => {
    const a = mapParserActionToIAction(actionEvent());
    expect(a.receipt).toBeDefined();
    expect(a.receipt.receiver).toBe('eosio.token');
    expect(a.receipt.global_sequence).toBe('777');
    expect(a.receipt.auth_sequence).toEqual([]);
  });

  it('трейс-поля, которых нет в parser2, получают дефолты (transaction_id/creator_action_ordinal)', () => {
    const a = mapParserActionToIAction(actionEvent());
    expect(a.transaction_id).toBe('');
    expect(a.creator_action_ordinal).toBe(0);
    expect(a.account_ram_deltas).toEqual([]);
    expect(a.context_free).toBe(false);
    expect(a.elapsed).toBe(0);
    expect(a.console).toBe('');
  });
});
