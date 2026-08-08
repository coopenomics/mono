/**
 * Код очного осмотра гарантийного возврата: пайщик показывает QR из своей
 * заявки (статус «Очный визит одобрен»), председатель сканирует камерой на
 * КУ и сразу попадает в решение по СВОЕЙ заявке — без ручного поиска в
 * списке. Отдельный формат от `handoff-token.ts`: тот привязан к личности
 * (pickup/receive) или партии (shipment) и участвует в общей маршрутизации
 * между столами приёмки/выдачи; этот привязан к конкретному `claim_id` и
 * обрабатывается только на странице гарантийных возвратов.
 *
 * Формат: `blago:return:<coopname>:<claim_id>`.
 */

const PREFIX = 'blago';
const KIND = 'return';
const SEP = ':';

export function encodeReturnClaimCode(coopname: string, claimId: string): string {
  return [PREFIX, KIND, coopname, claimId].join(SEP);
}

/** Возвращает `claim_id`, либо `null`, если код не распознан/выписан для другого кооператива. */
export function decodeReturnClaimCode(raw: string, coopname: string): string | null {
  const parts = raw.trim().split(SEP);
  if (parts.length !== 4) return null;
  const [prefix, kind, codeCoopname, claimId] = parts;
  if (prefix !== PREFIX || kind !== KIND) return null;
  if (!codeCoopname || codeCoopname !== coopname) return null;
  if (!claimId) return null;
  return claimId;
}
