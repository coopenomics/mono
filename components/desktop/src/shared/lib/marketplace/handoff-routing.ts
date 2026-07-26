/**
 * Универсальная маршрутизация отсканированного кода передачи по столу ПВЗ.
 *
 * Оператору не нужно заранее выбирать «я принимаю» или «я выдаю»: ВИД кода (а не
 * выбор человека) определяет стадию. Один сканер обрабатывает любой код:
 *   - `pickup`/`shipment` (поставщик привёз / ТТН экспедитора) → приёмка;
 *   - `receive` (заказчик пришёл за заказом)                   → выдача.
 *
 * Поэтому единого «и приёмка, и выдача» по одному скану не бывает — у человека,
 * который одновременно поставщик и заказчик, ДВА разных кода (свой на отгрузку и
 * свой на получение). Порядок «сперва приёмка, потом выдача» обеспечивается тем,
 * каким кодом он воспользуется: универсальный сканер из меню ведёт строго по
 * виду кода, а кнопки на самих столах приёмки/выдачи запускают свою стадию сразу.
 */

import { decodeScannedCode, HandoffTokenKind } from './handoff-token';

/** Стадия стола ПВЗ, на которую ведёт код передачи. */
export type HandoffStage = 'reception' | 'issuance';

export interface HandoffRouteTarget {
  /** Имя маршрута стола ПВЗ (vue-router `name`). */
  routeName: string;
  /** Стадия — для подсказок/логики вызывающего. */
  stage: HandoffStage;
}

const STAGE_ROUTE: Record<HandoffStage, string> = {
  reception: 'marketplace-pvz-reception',
  issuance: 'marketplace-issuance',
};

/** Имя маршрута стола, обрабатывающего код данного вида. */
export function handoffStageRoute(stage: HandoffStage): string {
  return STAGE_ROUTE[stage];
}

/**
 * Куда ведёт отсканированный код. Возвращает `null`, если код не распознан как
 * токен передачи или выписан для другого кооператива — вызывающий показывает
 * ошибку. Имя query-параметра, через который целевая страница подхватывает код
 * и сама открывает приёмку/выдачу, — `HANDOFF_QUERY`.
 */
export function resolveHandoffTarget(
  coopname: string,
  code: string,
): HandoffRouteTarget | null {
  const token = decodeScannedCode(code, coopname);
  if (!token) return null;
  if (token.coopname && token.coopname !== coopname) return null;
  const stage: HandoffStage =
    token.kind === HandoffTokenKind.Receive ? 'issuance' : 'reception';
  return { routeName: STAGE_ROUTE[stage], stage };
}

/**
 * Имя query-параметра, в котором отсканированный код прилетает на целевой стол
 * (приёмки/выдачи). Страница читает его при появлении, запускает свой сценарий
 * скана и стирает параметр (чтобы повторный показ того же кода снова сработал).
 */
export const HANDOFF_QUERY = 'handoff';
