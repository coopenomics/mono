/**
 * Код передачи на ПВЗ: строка, которую печатают в QR. Один формат на все
 * столы: `blago:<kind>:<coopname>:<ref>`.
 *
 * Стол в браузере код только СОБИРАЕТ — для QR на накладной экспедитора
 * (`shipment`) и на этикетке бокса (`container`). Код заказчика и код
 * поставщика пайщику отдаёт сервер (`marketplaceHandoffCode`), а любой
 * отсканированный код разбирает сервер (`marketplaceResolveScan`): он знает,
 * кто пришёл и какие дела у него на участке. Разбора строки на столе нет —
 * иначе временные коды второго этапа (598-62) пришлось бы заводить в двух
 * местах.
 */

export enum HandoffTokenKind {
  /** Поставщик → приёмка. Код выдаёт сервер. */
  Pickup = 'pickup',
  /** Заказчик → выдача. Код выдаёт сервер. */
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

const PREFIX = 'blago';
const SEP = ':';

/** Собрать код передачи для QR. */
export function encodeHandoffToken(token: HandoffToken): string {
  return [PREFIX, token.kind, token.coopname, refOf(token)].join(SEP);
}

function refOf(token: HandoffToken): string {
  if (token.kind === HandoffTokenKind.Shipment) return token.shipment_id ?? '';
  if (token.kind === HandoffTokenKind.Container) return token.container_code ?? '';
  return token.account;
}
