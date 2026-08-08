import { createHash } from 'crypto';

/**
 * Номер акта приёма-передачи Marketplace — короткий SHA256-хэш от естественных
 * идентификаторов документа (по канону Capital `result_act_hash` в
 * 1042.ResultContributionAct).
 *
 * Никаких человекочитаемых счётчиков/префиксов («ISS-…», «APL-…»): номер
 * детерминированно выводится из on-chain `order_hash` (+ `reception_id` для АПП
 * приёмки), поэтому уникален, воспроизводим и самоописателен. Выводится в шапке
 * акта как «АКТ №{0}».
 */
export function computeActNumber(...parts: string[]): string {
  return createHash('sha256').update(parts.join('')).digest('hex').slice(0, 16).toUpperCase();
}
