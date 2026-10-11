/**
 * Код передачи на участке (задача 598-62). Пайщик показывает QR, оператор
 * сканирует его одним общим сканером, сервер по коду определяет, кто пришёл и
 * за чем. Разбор строки живёт только здесь: стол в браузере код не разбирает,
 * а передаёт строку запросом `marketplaceResolveScan`.
 *
 * Формат: `blago:<kind>:<coopname>:<ref>`.
 *  - `receive`   — код заказчика: ref — учётная запись;
 *  - `pickup`    — код поставщика: ref — учётная запись;
 *  - `return`    — код заявления на гарантийный возврат: ref — id заявления;
 *  - `shipment`  — QR на накладной экспедитора: ref — id партии;
 *  - `container` — QR на боксе: ref — код бокса с этикетки (`BX-0001`).
 *
 * Ручной ввод без камеры: голый логин пайщика считается кодом заказчика, код
 * бокса с этикетки — кодом бокса. Имена учётных записей и кооперативов в цепи
 * состоят из `a–z`, `1–5`, `.`, id — из hex и `-`: двоеточия там нет, и
 * разделитель однозначен.
 *
 * Второй этап (временные коды): меняется только то, как ref кода заказчика и
 * поставщика превращается в учётную запись; формат и виды остаются.
 */

export const HANDOFF_CODE_PREFIX = 'blago';
const SEP = ':';

export enum MarketplaceHandoffCodeKind {
  Receive = 'receive',
  Pickup = 'pickup',
  Return = 'return',
  Shipment = 'shipment',
  Container = 'container',
}

export interface MarketplaceHandoffCode {
  kind: MarketplaceHandoffCodeKind;
  coopname: string;
  ref: string;
}

const KINDS = new Set<string>(Object.values(MarketplaceHandoffCodeKind));

/** Код бокса с этикетки: `BX-0001`. */
const CONTAINER_CODE_RE = /^BX-\d{4,}$/i;

/** Учётная запись цепи: `a-z`, `1-5`, `.`, до 12 символов. */
const ACCOUNT_NAME_RE = /(^[a-z1-5.]{1,11}[a-z1-5]$)|(^[a-z1-5.]{12}[a-j1-5]$)/;

export function encodeMarketplaceHandoffCode(code: MarketplaceHandoffCode): string {
  return [HANDOFF_CODE_PREFIX, code.kind, code.coopname, code.ref].join(SEP);
}

/**
 * Разобрать строку из сканера или из поля ручного ввода. `null` — строка не
 * является кодом передачи. Принадлежность кооперативу здесь не сверяется:
 * это делает сервис, чтобы ответить своим кодом ошибки.
 */
export function parseMarketplaceHandoffCode(
  raw: string,
  coopname: string
): MarketplaceHandoffCode | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith(HANDOFF_CODE_PREFIX + SEP)) {
    const parts = value.split(SEP);
    if (parts.length !== 4) return null;
    const [, kind, codeCoopname, ref] = parts;
    if (!KINDS.has(kind) || !codeCoopname || !ref) return null;
    return { kind: kind as MarketplaceHandoffCodeKind, coopname: codeCoopname, ref };
  }
  if (CONTAINER_CODE_RE.test(value)) {
    return { kind: MarketplaceHandoffCodeKind.Container, coopname, ref: value.toUpperCase() };
  }
  if (ACCOUNT_NAME_RE.test(value)) {
    return { kind: MarketplaceHandoffCodeKind.Receive, coopname, ref: value };
  }
  return null;
}
