import { Notify } from 'quasar';
import { extractGraphQLErrorMessages } from './errors';

/**
 * Canon-тосты платформы. Единый визуал и поведение для всех типов
 * уведомлений: бизнес-успех, бизнес-ошибка, входящий push (Novu).
 *
 * Канон (см. shared/MONO Design System.html → .toast):
 *  - Позиция: правый НИЖНИЙ угол (bottom-right).
 *  - Контейнер: тёмный фон (var(--p-ink) для нейтрального; deep-tinted
 *    #052e16 / #4c0a0a / #3d2400 / #0c1e3f для positive/negative/warning
 *    /info), светлый текст, ЦВЕТНАЯ иконка по типу.
 *  - Иконка слева, заголовок + опциональный sub.
 *  - Закрытие крестиком справа, авто-таймаут.
 *
 * Стилистические override-ы — централизованно в `quasar-canon.css`
 * (.q-notification + .q-notification.bg-*). Здесь только тип + контент.
 */

const POSITION = 'bottom-right' as const;
const TIMEOUT_INFO = 5000;
const TIMEOUT_ERROR = 7000;

// Цвет close-крестика и CTA-action не задаём — они наследуют светлый
// тон от тёмного фона тоста (см. .q-notification в quasar-canon.css).
const CLOSE_ACTION = {
  icon: 'close',
  round: true,
  size: 'sm',
  flat: true,
  handler: (): void => {
    /* dismiss */
  },
};

export function SuccessAlert(
  message: string,
  action?: {
    text?: string;
    icon?: string;
    handler: () => void;
  },
): void {
  const ctaAction = action
    ? {
        ...(action.text ? { label: action.text } : { icon: action.icon || 'launch' }),
        size: 'sm',
        flat: true,
        handler: action.handler,
      }
    : null;

  Notify.create({
    message,
    type: 'positive',
    icon: 'check_circle',
    position: POSITION,
    timeout: TIMEOUT_INFO,
    actions: ctaAction ? [ctaAction, CLOSE_ACTION] : [CLOSE_ACTION],
  });
}

export function FailAlert(error: unknown, text?: string): void {
  let message = extractGraphQLErrorMessages(error);
  message = message.replace('assertion failure with message: ', '');

  Notify.create({
    message: text ? `${text}: ${message}` : message,
    type: 'negative',
    icon: 'error',
    position: POSITION,
    timeout: TIMEOUT_ERROR,
    actions: [CLOSE_ACTION],
  });
}

export function NotifyAlert(title: string, body?: string, avatar?: string): void {
  Notify.create({
    message: title,
    caption: body,
    avatar,
    // Без avatar — нейтральная иконка-колокольчик; это in-app push от Novu.
    icon: avatar ? undefined : 'notifications',
    position: POSITION,
    timeout: TIMEOUT_INFO + 3000,
    actions: [CLOSE_ACTION],
  });
}
