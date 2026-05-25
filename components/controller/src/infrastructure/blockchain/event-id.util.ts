import { IAction, IDelta } from '~/types/common';

/**
 * Локальное вычисление event_id по формуле parser2 (Story 2.2, DEC-T08 phase 1).
 *
 * Формат (см. controller/CLAUDE.md): `${chain}:${kind}:${block_num}:${block_id_short}:${natural_key}`.
 * Признак уникальности события — основа идемпотентности (INV-09). До миграции
 * на parser2 (Epic 3) считается здесь параллельно текущему flow; в Epic 3 phase 2
 * сверяется с авторитетным event_id, который отдаёт сам движок.
 *
 * ВАЖНО: формула ещё не верифицирована против parser2, поэтому dedup-gate
 * (Story 2.3) по умолчанию выключен (BLOCKCHAIN_DEDUP_ENABLED=false). Ложный
 * дубль = silent data loss, поэтому активация — только после сверки.
 */

/** Длина короткого префикса block_id в event_id. */
const BLOCK_ID_SHORT_LEN = 8;

function shortBlockId(blockId: string | undefined): string {
  return (blockId ?? '').slice(0, BLOCK_ID_SHORT_LEN);
}

/**
 * event_id дельты. natural_key = code:scope:table:primary_key — естественная
 * идентичность строки таблицы в конкретном блоке.
 */
export function computeDeltaEventId(delta: IDelta): string {
  const naturalKey = `${delta.code}:${delta.scope}:${delta.table}:${delta.primary_key}`;
  return `${delta.chain_id}:delta:${delta.block_num}:${shortBlockId(delta.block_id)}:${naturalKey}`;
}

/**
 * event_id действия. natural_key = global_sequence — глобально-монотонный
 * идентификатор action'а в цепи, уникален сам по себе.
 */
export function computeActionEventId(action: IAction): string {
  return `${action.chain_id}:action:${action.block_num}:${shortBlockId(action.block_id)}:${action.global_sequence}`;
}
