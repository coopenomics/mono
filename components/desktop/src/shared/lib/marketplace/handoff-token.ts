/**
 * Эпик 14 / Story 14.3–14.4: account-bound код передачи на ПВЗ («как в Ozon»).
 *
 * Код привязан к АККАУНТУ человека, а не к конкретной партии/единице. Один показ
 * = оператор видит и принимает/выдаёт разом все ожидаемые единицы этого человека
 * на своём КУ (поставщик привёз 10 — показал один код, приняли все 10; заказчик
 * пришёл — показал один код, выдали все его готовые заказы). Код детерминирован от
 * личности + намерения, поэтому его можно сгенерировать заранее и оффлайн — backend
 * токен не минтит.
 *
 * Привязка к КУ обеспечивается на стороне оператора: он резолвит аккаунт против
 * ленты СВОЕГО КУ — у чужого аккаунта на этом КУ просто нет ожидающих единиц.
 * coopname в коде отсекает предъявление в чужом кооперативе.
 *
 * Формат: `blago:<kind>:<coopname>:<ref>`
 *  - `blago`   — namespace кода передачи;
 *  - `kind`    — `pickup` (поставщик → приёмка) | `receive` (заказчик → выдача)
 *                | `shipment` (ТТН экспедитора → приёмка строго этой партии);
 *  - coopname  — кооператив, в котором код действителен;
 *  - ref       — для pickup/receive: аккаунт-биндинг (личность); для shipment:
 *                идентификатор партии (UUID) — экспедитор НЕ пайщик, аккаунта нет,
 *                принимаем строго по партии из накладной.
 *
 * Имена аккаунтов/кооперативов в блокчейне состоят из `a–z`, `1–5`, `.`, а UUID —
 * из hex и `-`; символа `:` ни там, ни там нет, поэтому разделитель однозначен.
 */

export enum HandoffTokenKind {
  /** Поставщик → оператор приёмки: «приняли всё, что я привёз». */
  Pickup = 'pickup',
  /** Заказчик → оператор выдачи: «выдали все мои готовые заказы». */
  Receive = 'receive',
  /**
   * ТТН экспедитора → оператор приёмки: «принять строго эту партию».
   * Привязка к партии (shipment_id), а не к личности — экспедитор не пайщик.
   */
  Shipment = 'shipment',
}

export interface HandoffToken {
  kind: HandoffTokenKind;
  coopname: string;
  /** pickup/receive — аккаунт-биндинг личности; для shipment — пусто. */
  account: string;
  /** shipment — идентификатор партии из ТТН; для pickup/receive — undefined. */
  shipment_id?: string;
}

const PREFIX = 'blago';
const SEP = ':';

/** Собрать код передачи для показа в `HandoffQr` (account-bound или shipment-bound). */
export function encodeHandoffToken(token: HandoffToken): string {
  const ref = token.kind === HandoffTokenKind.Shipment ? token.shipment_id ?? '' : token.account;
  return [PREFIX, token.kind, token.coopname, ref].join(SEP);
}

/**
 * Разобрать отсканированный код. Возвращает `null`, если строка — не валидный
 * токен передачи (чужой формат/мусор): вызывающий код отвергает скан.
 */
export function decodeHandoffToken(raw: string): HandoffToken | null {
  const value = raw.trim();
  if (!value.startsWith(PREFIX + SEP)) return null;
  const parts = value.split(SEP);
  if (parts.length !== 4) return null;
  const [, kind, coopname, ref] = parts;
  if (
    kind !== HandoffTokenKind.Pickup &&
    kind !== HandoffTokenKind.Receive &&
    kind !== HandoffTokenKind.Shipment
  ) {
    return null;
  }
  if (!coopname || !ref) return null;
  if (kind === HandoffTokenKind.Shipment) {
    return { kind, coopname, account: '', shipment_id: ref };
  }
  return { kind: kind as HandoffTokenKind, coopname, account: ref };
}

/** Формат аккаунта EOSIO: `a-z`, `1-5`, `.`, максимум 12 символов. */
const ACCOUNT_NAME_RE = /(^[a-z1-5.]{1,11}[a-z1-5]$)|(^[a-z1-5.]{12}[a-j1-5]$)/;

/**
 * Разобрать то, что дал оператор в ручном вводе (без камеры): либо
 * структурированный код передачи, либо голый логин пайщика со слов человека.
 * Pickup/shipment коды — генерируемые строки, их не продиктуешь, а свой логин
 * каждый пайщик знает — поэтому голый логин трактуется как код получения
 * (заказчик здесь), это единственный сценарий, реалистичный для устного ввода.
 * Худший случай ошибки — на столе выдачи не находится позиций пайщика, и
 * оператор просто предложит ему докладку со склада (см. `resolvePickup`).
 */
export function decodeScannedCode(raw: string, coopname: string): HandoffToken | null {
  const structured = decodeHandoffToken(raw);
  if (structured) return structured;
  const value = raw.trim();
  if (!ACCOUNT_NAME_RE.test(value)) return null;
  return { kind: HandoffTokenKind.Receive, coopname, account: value };
}
