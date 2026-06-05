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

export function mapParserDeltaToIDelta(event: DeltaEvent): IDelta {
  return {
    chain_id: event.chain_id,
    block_num: event.block_num,
    block_id: event.block_id,
    block_time: event.block_time,
    present: event.present,
    code: event.code,
    scope: event.scope,
    table: event.table,
    primary_key: event.primary_key,
    value: event.value,
  };
}

export function mapParserActionToIAction(event: ActionEvent): IAction {
  const globalSequence = String(event.global_sequence);
  const r = event.receipt;
  const receipt = r
    ? {
        receiver: r.receiver,
        act_digest: r.actDigest,
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
    transaction_id: event.transaction_id,
    account: event.account,
    block_num: event.block_num,
    block_id: event.block_id,
    block_time: event.block_time,
    chain_id: event.chain_id,
    name: event.name,
    // parser2 эмитит action уже единожды (дедуп по global_sequence); receiver=account,
    // чтобы guard processAction (receiver != account → skip) пропускал событие.
    receiver: receipt.receiver,
    authorization: event.authorization.map((a) => ({ actor: a.actor, permission: a.permission })),
    data: event.data,
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
