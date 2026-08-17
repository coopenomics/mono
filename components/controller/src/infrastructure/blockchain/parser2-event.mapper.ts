import type { ActionEvent, DeltaEvent } from '@coopenomics/parser2';
import { IAction, IDelta } from '~/types/common';

/**
 * Преобразование событий parser2 (ParserEvent) во внутренние формы контроллера
 * IDelta / IAction. Транспорт сменился (parser1 Redis-стрим → parser2 ParserClient),
 * но обработчики (processDelta/processAction → syncer'ы) остаются прежними: они
 * работают с IDelta/IAction. Маппер — единственная точка перевода (DEC-T09).
 *
 * Все поля действия — РЕАЛЬНЫЕ из SHiP-трейса (parser2 их отдаёт): transaction_id,
 * creator_action_ordinal, receipt (с auth_sequence), console, elapsed, context_free,
 * account_ram_deltas. Это полный паритет с тем, что давал parser1, — ledger2
 * (cross-link родительского apply по transaction_id + action_ordinal) и
 * blockchain-explorer работают без потерь.
 *
 * bigint-поля (global_sequence, receipt.*Sequence) приходят по проводу строками
 * (parser2 сериализует bigint→string), поэтому String() безопасен и для bigint, и
 * для string.
 */

/**
 * Хэши приводятся к заглавным — так, как их всегда отдавал прежний индексер.
 *
 * Это не косметика, а сохранение формата данных. Прежний индексер собирал
 * шестнадцатеричные значения через eosjs, а тот заканчивает `arrayToHex`
 * вызовом `toUpperCase()`: заглавными приходило всё — идентификатор транзакции,
 * идентификатор блока, любой `checksum256` внутри полезной нагрузки. Узел годами
 * складывал их в свои таблицы «как пришло» и ищет по ним точным сравнением, а
 * половина кода платформы приводит хэш к заглавным перед сравнением именно
 * поэтому.
 *
 * Новый индексер разбирает цепь через @wharfkit/antelope, а он отдаёт то же
 * значение строчными. Без нормализации переход менял бы регистр всех новых
 * записей: в одной таблице оказались бы старые строки заглавными и новые
 * строчными, а поиск по хэшу молча перестал бы их находить — ни ошибки, ни
 * расхождения в сумме, просто «документ не найден» на исправных данных.
 *
 * Поэтому регистр восстанавливается здесь, в единственной точке входа событий,
 * а не правкой сотен мест сравнения. Регистронезависимый поиск в репозиториях
 * остаётся второй линией защиты — на случай, если хэш придёт со стороны.
 */
const CHECKSUM_HEX = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;

function normalizeHashes<T>(value: T): T {
  if (typeof value === 'string') {
    return (CHECKSUM_HEX.test(value) ? value.toUpperCase() : value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeHashes(item)) as unknown as T;
  }

  // Дата и прочие объекты со своим поведением копированию полей не подлежат:
  // у события они не встречаются, но проверка дешевле, чем испорченное значение.
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeHashes(v)])
    ) as unknown as T;
  }

  return value;
}

export function mapParserDeltaToIDelta(event: DeltaEvent): IDelta {
  return {
    chain_id: event.chain_id,
    block_num: event.block_num,
    block_id: normalizeHashes(event.block_id),
    block_time: event.block_time,
    present: event.present,
    code: event.code,
    scope: event.scope,
    table: event.table,
    primary_key: event.primary_key,
    value: normalizeHashes(event.value),
  };
}

export function mapParserActionToIAction(event: ActionEvent): IAction {
  const globalSequence = String(event.global_sequence);
  const r = event.receipt;
  const receipt = r
    ? {
        receiver: r.receiver,
        act_digest: normalizeHashes(r.actDigest),
        global_sequence: String(r.globalSequence),
        recv_sequence: String(r.recvSequence),
        auth_sequence: r.authSequence.map((s) => ({ account: s.account, sequence: String(s.sequence) })),
        code_sequence: r.codeSequence,
        abi_sequence: r.abiSequence,
      }
    : {
        // Трассировки нет — receipt не null (read-path explorer'а и фильтр
        // notification по receipt.receiver не должны падать).
        receiver: event.account,
        act_digest: '',
        global_sequence: globalSequence,
        recv_sequence: '0',
        auth_sequence: [],
        code_sequence: 0,
        abi_sequence: 0,
      };

  return {
    transaction_id: normalizeHashes(event.transaction_id),
    account: event.account,
    block_num: event.block_num,
    block_id: normalizeHashes(event.block_id),
    block_time: event.block_time,
    chain_id: event.chain_id,
    name: event.name,
    // parser2 эмитит action уже единожды (дедуп по global_sequence); receiver=account,
    // чтобы guard processAction (receiver != account → skip) пропускал событие.
    receiver: receipt.receiver,
    authorization: event.authorization.map((a) => ({ actor: a.actor, permission: a.permission })),
    data: normalizeHashes(event.data),
    action_ordinal: event.action_ordinal,
    global_sequence: globalSequence,
    account_ram_deltas: event.account_ram_deltas.map((d) => ({ account: d.account, delta: d.delta })),
    console: event.console,
    receipt,
    creator_action_ordinal: event.creator_action_ordinal,
    context_free: event.context_free,
    elapsed: event.elapsed,
  };
}
