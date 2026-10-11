/**
 * Код передачи на ПВЗ: строка, которую печатают в QR предмета —
 * `<kind>:<coopname>:<ref>` (накладная экспедитора `shipment`, этикетка
 * бокса `container`).
 *
 * Стол в браузере код только СОБИРАЕТ. Код пайщика (заказчик, поставщик)
 * выдаёт сервер (`marketplaceHandoffCode`): случайный, живёт сутки. Любой
 * отсканированный код разбирает сервер (`marketplaceResolveScan`): он знает,
 * кто пришёл и какие дела у него на участке. Разбора строки на столе нет
 * (598-62): формат живёт в одном месте — в контроллере.
 */

export enum HandoffTokenKind {
  /** Поставщик → приёмка. Код выдаёт сервер; вид нужен только для текстов. */
  Pickup = 'pickup',
  /** Заказчик → выдача. Код выдаёт сервер; вид нужен только для текстов. */
  Receive = 'receive',
  /** QR накладной экспедитора: ref — идентификатор партии. */
  Shipment = 'shipment',
  /** QR на боксе: ref — код бокса с этикетки (`BX-0001`). */
  Container = 'container',
}

export interface HandoffToken {
  kind: HandoffTokenKind;
  coopname: string;
  /** pickup/receive — учётная запись; для shipment/container пусто. */
  account: string;
  shipment_id?: string;
  container_code?: string;
}

const SEP = ':';

/** Собрать код предмета для QR. */
export function encodeHandoffToken(token: HandoffToken): string {
  return [token.kind, token.coopname, refOf(token)].join(SEP);
}

function refOf(token: HandoffToken): string {
  if (token.kind === HandoffTokenKind.Shipment) return token.shipment_id ?? '';
  if (token.kind === HandoffTokenKind.Container) return token.container_code ?? '';
  return token.account;
}
