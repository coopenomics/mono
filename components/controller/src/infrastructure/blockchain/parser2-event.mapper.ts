import type { ActionEvent, DeltaEvent } from '@coopenomics/parser2';
import { IAction, IDelta } from '~/types/common';

/**
 * Преобразование событий parser2 (ParserEvent) во внутренние формы контроллера
 * IDelta / IAction. Транспорт сменился (parser1 Redis-стрим → parser2 ParserClient),
 * но обработчики (processDelta/processAction → syncer'ы) остаются прежними: они
 * работают с IDelta/IAction. Маппер — единственная точка перевода (DEC-T09).
 *
 * Дельта мапится один-в-один — все поля DeltaEvent есть в IDelta.
 *
 * Action мапится с потерями: parser2 ActionEvent несёт декодированный action
 * (account/name/data/authorization/global_sequence/action_ordinal/block), но НЕ
 * несёт полей трассировки транзакции, которые давал parser1:
 *   - transaction_id
 *   - creator_action_ordinal
 *   - account_ram_deltas / console / elapsed / context_free
 *   - полная receipt (act_digest / recv_sequence / auth_sequence / *_sequence)
 *
 * ⚠️ ВАЖНО (ledger2): typeorm-ledger2-state.repository связывает операцию с
 * родительским apply по `transaction_id` + `action_ordinal`/`creator_action_ordinal`.
 * Под parser2 эти поля action'а пусты → cross-link родительского apply может
 * не находиться. transaction_id/creator_action_ordinal заполняются заглушками,
 * см. отчёт миграции — это первый кандидат на проверку при прогоне на parser2.
 * receipt собирается с дефолтами (не null), чтобы read-path explorer'а и
 * notification-фильтр по receipt.receiver не падали.
 */

export function mapParserDeltaToIDelta(event: DeltaEvent): IDelta {
  return {
    chain_id: event.chain_id,
    block_num: event.block_num,
    block_id: event.block_id,
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
  return {
    // parser2 не отдаёт transaction_id трассировки — см. предупреждение про ledger2 выше.
    transaction_id: '',
    account: event.account,
    block_num: event.block_num,
    block_id: event.block_id,
    chain_id: event.chain_id,
    name: event.name,
    // parser2 эмитит action уже единожды (дедуп по global_sequence), контекста
    // receiver≠account нет — выставляем receiver=account, чтобы guard processAction
    // (receiver != account → skip) пропускал событие.
    receiver: event.account,
    authorization: event.authorization.map((a) => ({ actor: a.actor, permission: a.permission })),
    data: event.data,
    action_ordinal: event.action_ordinal,
    global_sequence: globalSequence,
    account_ram_deltas: [],
    console: '',
    receipt: {
      receiver: event.account,
      act_digest: '',
      global_sequence: globalSequence,
      recv_sequence: '0',
      auth_sequence: [],
      code_sequence: 0,
      abi_sequence: 0,
    },
    creator_action_ordinal: 0,
    context_free: false,
    elapsed: 0,
  };
}
