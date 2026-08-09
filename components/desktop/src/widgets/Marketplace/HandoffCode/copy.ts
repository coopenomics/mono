import { HandoffTokenKind } from 'src/shared/lib/marketplace';

/**
 * Account-bound сценарии кода передачи (привязка к личности пайщика). Shipment
 * (привязка к партии экспедитора) сюда НЕ входит — там нет аккаунта.
 */
export type AccountHandoffKind = HandoffTokenKind.Receive | HandoffTokenKind.Pickup;

interface HandoffCodeCopy {
  /** Заголовок диалога и одноимённого пункта меню. */
  dialogTitle: string;
  /** Подпись под QR — что с ним делать на пункте. */
  caption: string;
  /** Тело пустого состояния, когда нет сессии. */
  emptyBody: string;
}

/**
 * Тексты на оба account-bound сценария. Единый источник, чтобы страница и диалог
 * (и заказчика, и поставщика) брали подпись/заголовок из одного места.
 */
export const HANDOFF_CODE_COPY: Record<AccountHandoffKind, HandoffCodeCopy> = {
  [HandoffTokenKind.Receive]: {
    dialogTitle: 'Показать QR',
    caption:
      'Покажите этот код оператору на том пункте выдачи, куда пришёл ваш заказ — он выдаст по нему всё, что готово к получению. Код можно показать с экрана телефона или с распечатки.',
    emptyBody: 'Войдите в кооператив, чтобы получить персональный код выдачи.',
  },
  [HandoffTokenKind.Pickup]: {
    dialogTitle: 'Показать QR',
    caption:
      'Покажите этот код оператору на пункте приёмки — он примет разом всё, что вы привезли (и сформированные партии, и самовывоз по факту). Код можно показать с экрана телефона или с распечатки.',
    emptyBody: 'Войдите в кооператив, чтобы получить персональный код приёмки.',
  },
};
