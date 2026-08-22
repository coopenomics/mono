import { IAction, IDelta } from '~/types/common';

/**
 * Локальное вычисление event_id — основа идемпотентности (INV-09).
 *
 * Формат: `${chain}:${kind}:${block_num}:${block_id_short}:${natural_key}`, где
 * kind = action|delta|fork. Контроллер ведёт собственный consumer_dedup в этом
 * формате (parser2 кладёт свой event_id в событие — другая формула
 * `chain:a:...`/`chain:d:...`/`chain:f:...`, мы её не используем). Дедуп
 * безусловный: повторно доставленное событие с уже отмеченным event_id
 * игнорируется как no-op. Полный «kind» — чтобы человек, глядя в consumer_dedup,
 * сразу видел тип события без расшифровки префикса.
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

/**
 * event_id форка. natural_key — short new_head_block_id (новая голова цепи
 * после rollback). Симметрично action/delta-формуле: `chain:fork:block_num:short_id`.
 * block_num = forked_from_block (последний безопасный блок до отката).
 * short_id различает форк-эпохи — две разных «новых ветки» того же forked_from_block
 * дают разный event_id, что корректно с точки зрения retry / breach-сценариев.
 */
export function computeForkEventId(chainId: string, forkedFromBlock: number, newHeadBlockId: string): string {
  return `${chainId}:fork:${forkedFromBlock}:${shortBlockId(newHeadBlockId)}`;
}
