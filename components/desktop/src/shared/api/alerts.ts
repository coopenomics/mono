import { Notify } from 'quasar';
import { extractGraphQLErrorMessages } from './errors';
import { formatAssetsInText } from 'src/shared/lib/utils/formatAsset2Digits';
import { sanitizeBlockchainError } from 'src/shared/lib/utils/sanitizeBlockchainError';

/**
 * Canon-тосты платформы. Единый визуал и поведение для всех типов
 * уведомлений: бизнес-успех, бизнес-ошибка, входящее in-app уведомление.
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
        // Заливка --p-primary — CTA не должен теряться рядом с заголовком
        // (жалоба 2026-08-02: «Добавлено в корзину» и «В корзину» сливались
        // в одну строку). Стиль — в quasar-canon.css.
        class: 'q-notification__cta-btn',
        handler: action.handler,
      }
    : null;

  Notify.create({
    message,
    type: 'positive',
    icon: 'check_circle',
    position: POSITION,
    timeout: TIMEOUT_INFO,
    // При наличии CTA-действия переносим его на отдельную строку под
    // текстом (Quasar multiLine складывает контент и actions в колонку) —
    // без action остаётся привычная компактная одна строка.
    multiLine: Boolean(ctaAction),
    actions: ctaAction ? [ctaAction, CLOSE_ACTION] : [CLOSE_ACTION],
  });
}

export function FailAlert(error: unknown, text?: string): void {
  let message = extractGraphQLErrorMessages(error);
  message = message.replace('assertion failure with message: ', '');

  // Полный технический текст ошибки — в консоль для разработчиков. Пользователю
  // ниже показываем очищенную версию, но сырой ассерт цепи остаётся доступен
  // здесь (и в логах контроллера).
  // eslint-disable-next-line no-console
  console.error('[FailAlert]', message, error);

  // Суммы из ошибок цепи приходят «сырыми» (precision=4: "100.0000 RUB").
  // Приводим к виду «2 знака» через единый форматтер — единая точка для
  // всех тостов ошибок (см. formatAssetsInText).
  message = formatAssetsInText(message);
  // Снимаем технические детали ассертов контрактов (scope-префикс вида
  // `walletop TRANSFER:` и служебные имена кошельков `w.wal.share`), чтобы
  // пользователь видел «Недостаточно средств на кошельке», а не внутреннюю
  // механику. Единая точка очистки для всех тостов ошибок.
  message = sanitizeBlockchainError(message);

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
    // Без avatar — нейтральная иконка-колокольчик; это in-app уведомление.
    icon: avatar ? undefined : 'notifications',
    position: POSITION,
    timeout: TIMEOUT_INFO + 3000,
    actions: [CLOSE_ACTION],
  });
}

// Тост обновления приложения. Правый нижний угол (там же, где все тосты),
// timeout 0 (не исчезает сам): пользователь сам решает «Обновить»/«Позже».
export function UpdateAlert(onApply: () => void, onDismiss?: () => void): void {
  Notify.create({
    message: 'Доступно обновление',
    caption: 'Вышла новая версия рабочего стола. Без обновления часть функций может работать некорректно.',
    type: 'info',
    icon: 'update',
    position: POSITION,
    timeout: 0,
    group: false,
    multiLine: true,
    classes: 'q-notification--app-update',
    actions: [
      { label: 'Обновить', noDismiss: true, handler: onApply },
      { label: 'Позже', flat: true, size: 'sm', handler: (): void => { onDismiss?.(); } },
      // Крестик закрытия — позиционируется в правый верхний угол тоста (CSS .app-update__close)
      { icon: 'close', flat: true, round: true, size: 'sm', class: 'app-update__close', handler: (): void => { onDismiss?.(); } },
    ],
  });
}
