/**
 * Unit-тесты computeDeltaEventId / computeActionEventId (Story 2.2 + сверка Epic 3 phase 2).
 *
 * event_id — фундамент идемпотентности (INV-09). Формула должна быть
 * детерминированной и не схлопывать разные логические события в один id
 * (иначе dedup-gate Story 2.3 отбросит реальное событие = silent data loss).
 *
 * Golden-значения ниже — БАЙТ-В-БАЙТ как computeEventId в @coopenomics/parser2 v1.0.3
 * (packages/parser2/src/events/eventId.ts): дискриминанты `a`/`d`, block_id[0..16].
 * Совпадение — инвариант для безопасного cutover на parser2 (overlap dual-consume):
 * расхождение = тот же event получит разные id в legacy и в движке → дедуп промахнётся.
 * При правке формулы синхронно сверять эти значения с исходником parser2.
 */

import { computeActionEventId, computeDeltaEventId } from '~/infrastructure/blockchain/event-id.util';

function makeDelta(over: Partial<any> = {}): any {
  return {
    chain_id: 'chain-aaa',
    block_num: 100,
    block_id: '0123456789abcdef',
    present: true,
    code: 'eosio.token',
    scope: 'voskhod',
    table: 'accounts',
    primary_key: '42',
    ...over,
  };
}

function makeAction(over: Partial<any> = {}): any {
  return {
    chain_id: 'chain-aaa',
    block_num: 100,
    block_id: '0123456789abcdef',
    global_sequence: '777',
    account: 'eosio.token',
    name: 'transfer',
    ...over,
  };
}

describe('computeDeltaEventId (Story 2.2)', () => {
  it('формирует id по формуле parser2 chain:d:block:block_id[0..16]:code:scope:table:primary_key', () => {
    expect(computeDeltaEventId(makeDelta())).toBe('chain-aaa:d:100:0123456789abcdef:eosio.token:voskhod:accounts:42');
  });

  it('детерминирован: один и тот же вход → один и тот же id', () => {
    expect(computeDeltaEventId(makeDelta())).toBe(computeDeltaEventId(makeDelta()));
  });

  it('разный primary_key → разный id', () => {
    expect(computeDeltaEventId(makeDelta({ primary_key: '1' }))).not.toBe(
      computeDeltaEventId(makeDelta({ primary_key: '2' }))
    );
  });

  it('разный блок → разный id (один и тот же ряд, обновлённый в другом блоке)', () => {
    expect(computeDeltaEventId(makeDelta({ block_num: 100, block_id: 'aaaa1111' }))).not.toBe(
      computeDeltaEventId(makeDelta({ block_num: 101, block_id: 'bbbb2222' }))
    );
  });

  it('обрезает block_id до 16 символов; короткий block_id не падает', () => {
    expect(computeDeltaEventId(makeDelta({ block_id: 'ab' }))).toBe('chain-aaa:d:100:ab:eosio.token:voskhod:accounts:42');
  });

  it('берёт ровно первые 16 hex-символов длинного block_id (как parser2 blockIdShort)', () => {
    expect(
      computeDeltaEventId(makeDelta({ block_id: '0123456789abcdef0000ffff', primary_key: '7' }))
    ).toBe('chain-aaa:d:100:0123456789abcdef:eosio.token:voskhod:accounts:7');
  });
});

describe('computeActionEventId (Story 2.2)', () => {
  it('формирует id по формуле parser2 chain:a:block:block_id[0..16]:global_sequence', () => {
    expect(computeActionEventId(makeAction())).toBe('chain-aaa:a:100:0123456789abcdef:777');
  });

  it('разный global_sequence → разный id', () => {
    expect(computeActionEventId(makeAction({ global_sequence: '1' }))).not.toBe(
      computeActionEventId(makeAction({ global_sequence: '2' }))
    );
  });

  it('детерминирован', () => {
    expect(computeActionEventId(makeAction())).toBe(computeActionEventId(makeAction()));
  });
});
