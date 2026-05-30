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
 * Формат: `blago:<kind>:<coopname>:<account>`
 *  - `blago`   — namespace кода передачи;
 *  - `kind`    — `pickup` (поставщик → приёмка) | `receive` (заказчик → выдача);
 *  - coopname  — кооператив, в котором код действителен;
 *  - account   — аккаунт-биндинг (личность, не партия/единица).
 *
 * Имена аккаунтов/кооперативов в блокчейне состоят из `a–z`, `1–5`, `.` — символа
 * `:` в них быть не может, поэтому разделитель однозначен.
 */

export enum HandoffTokenKind {
  /** Поставщик → оператор приёмки: «приняли всё, что я привёз». */
  Pickup = 'pickup',
  /** Заказчик → оператор выдачи: «выдали все мои готовые заказы». */
  Receive = 'receive',
}

export interface HandoffToken {
  kind: HandoffTokenKind;
  coopname: string;
  account: string;
}

const PREFIX = 'blago';
const SEP = ':';

/** Собрать account-bound код для показа в `HandoffQr`. */
export function encodeHandoffToken(token: HandoffToken): string {
  return [PREFIX, token.kind, token.coopname, token.account].join(SEP);
}

/**
 * Разобрать отсканированный код. Возвращает `null`, если строка — не валидный
 * account-bound токен (чужой формат/мусор): вызывающий код отвергает скан.
 */
export function decodeHandoffToken(raw: string): HandoffToken | null {
  const value = raw.trim();
  if (!value.startsWith(PREFIX + SEP)) return null;
  const parts = value.split(SEP);
  if (parts.length !== 4) return null;
  const [, kind, coopname, account] = parts;
  if (kind !== HandoffTokenKind.Pickup && kind !== HandoffTokenKind.Receive) return null;
  if (!coopname || !account) return null;
  return { kind: kind as HandoffTokenKind, coopname, account };
}
