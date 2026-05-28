import { IAction, IDelta } from '~/types/common';

/**
 * Локальное вычисление event_id — основа идемпотентности (INV-09).
 *
 * Формат: `${chain}:${kind}:${block_num}:${block_id_short}:${natural_key}`, где
 * kind = action|delta. Контроллер ведёт собственный consumer_dedup в этом формате
 * (parser2 кладёт свой event_id в событие, но мы считаем по своим полям —
 * формат не зависит от транспорта). Дедуп безусловный: повторно доставленное
 * событие с уже отмеченным event_id игнорируется как no-op.
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
