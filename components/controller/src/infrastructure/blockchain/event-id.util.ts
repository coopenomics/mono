import { IAction, IDelta } from '~/types/common';

/**
 * Локальное вычисление event_id по формуле parser2 (Story 2.2 + сверка Epic 3 phase 2, DEC-T08).
 *
 * Признак уникальности события — основа идемпотентности (INV-09). До миграции
 * транспорта на parser2 (Epic 3 Stories 3.3/3.4) считается здесь параллельно
 * текущему flow (legacy BlockchainConsumerService); после переключения авторитетный
 * event_id отдаёт сам движок в каждом ParserEvent (DEC-T09) и локальный расчёт уходит.
 *
 * Форматы — БАЙТ-В-БАЙТ как в @coopenomics/parser2 v1.0.3
 * (packages/parser2/src/events/eventId.ts → computeEventId):
 *   action: `${chain_id}:a:${block_num}:${block_id[0..16]}:${global_sequence}`
 *   delta:  `${chain_id}:d:${block_num}:${block_id[0..16]}:${code}:${scope}:${table}:${primary_key}`
 * (native-delta `:n:` и fork `:f:` контроллер по legacy-транспорту не порождает.)
 *
 * ВАЖНО: совпадение с parser2 — инвариант. Если форматы разойдутся, при cutover на
 * parser2 (overlap dual-consume) одно и то же событие получит разные id в legacy и в
 * движке → dedup-gate его не распознает = silent data loss / двойное применение.
 * Поэтому при любой правке формулы — синхронно править golden-тест event-id.util.test.ts
 * против исходника parser2. Раньше формула расходилась (`:delta:`/`:action:`, block_id[0..8]):
 * выровнено в Epic 3 после публикации parser2 v1.0.3 и инспекции computeEventId.
 *
 * Dedup-gate (Story 2.3) остаётся за флагом BLOCKCHAIN_DEDUP_ENABLED=false до прод-
 * сверки с parser2 на стенде (Story 3.3); пока флаг false первичная защита — block_num-guard.
 */

/**
 * Длина короткого префикса block_id в event_id — первые 16 hex-символов (8 байт,
 * содержащих номер блока). Совпадает с blockIdShort в parser2 computeEventId.
 */
const BLOCK_ID_SHORT_LEN = 16;

function shortBlockId(blockId: string | undefined): string {
  return (blockId ?? '').slice(0, BLOCK_ID_SHORT_LEN);
}

/**
 * event_id дельты. Комбинация code:scope:table:primary_key уникально идентифицирует
 * строку таблицы контракта в конкретном блоке. Дискриминант `d` — как в parser2.
 */
export function computeDeltaEventId(delta: IDelta): string {
  const naturalKey = `${delta.code}:${delta.scope}:${delta.table}:${delta.primary_key}`;
  return `${delta.chain_id}:d:${delta.block_num}:${shortBlockId(delta.block_id)}:${naturalKey}`;
}

/**
 * event_id действия. global_sequence — глобально-монотонный счётчик action'ов в цепи,
 * уникален сам по себе. Дискриминант `a` — как в parser2.
 */
export function computeActionEventId(action: IAction): string {
  return `${action.chain_id}:a:${action.block_num}:${shortBlockId(action.block_id)}:${action.global_sequence}`;
}
