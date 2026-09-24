import { HandoffTokenKind } from 'src/shared/lib/marketplace';
import { t } from 'src/shared/i18n';

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
    dialogTitle: t('marketplace.handoffCopy.showQrButton'),
    caption:
      t('marketplace.handoffCopy.receiveHint'),
    emptyBody: t('marketplace.handoffCopy.receiveLoginHint'),
  },
  [HandoffTokenKind.Pickup]: {
    dialogTitle: t('marketplace.handoffCopy.showQrButton'),
    caption:
      t('marketplace.handoffCopy.deliveryHint'),
    emptyBody: t('marketplace.handoffCopy.deliveryLoginHint'),
  },
};
