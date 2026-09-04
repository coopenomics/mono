import { computed, onScopeDispose, ref, type Ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { api } from '../api';

/**
 * Призыв подтвердить почту отложен на эту сессию вкладки.
 *
 * Как и у предложения установить пароль (MigrationOfferDialog), состояние живёт
 * в памяти, а не в localStorage: подтверждение почты — не разовая формальность,
 * и пайщик, отложивший его сегодня, должен увидеть напоминание в следующий раз,
 * а не забыть о нём навсегда.
 */
export const verifyEmailOfferDismissed = ref(false);

/** Длина кода подтверждения — как в письме. */
export const EMAIL_CODE_LENGTH = 6;

/**
 * Подтверждение почты кодом — единая логика для всех мест, где оно требуется:
 * шаг ввода почты при регистрации, строка «Email» в профиле и призыв в кабинете.
 *
 * Здесь и запрос письма, и обратный отсчёт до повторной отправки, и проверка
 * кода: иначе каждое место завело бы свой таймер и свою обработку ошибок, и они
 * разъехались бы на первой же правке.
 *
 * `email` принимается ref'ом, а не строкой: в регистрации адрес правится на том
 * же экране («ошибся — измени»), и форма обязана следовать за ним.
 */
/**
 * Обратный отсчёт до разрешённой повторной отправки. Отдельно от остальной
 * логики: таймер надо снимать при уходе компонента, а диалог закрывают
 * крестиком чаще, чем доводят до конца.
 */
function useResendCooldown() {
  const cooldown = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start(seconds: number): void {
    cooldown.value = Math.max(0, Math.round(seconds));
    stop();
    if (cooldown.value === 0) return;
    timer = setInterval(() => {
      cooldown.value -= 1;
      if (cooldown.value <= 0) stop();
    }, 1000);
  }

  /** Сбросить отсчёт: адрес меняют, прежнее окно к нему уже не относится. */
  function clear(): void {
    stop();
    cooldown.value = 0;
  }

  onScopeDispose(stop);

  return { cooldown, start, clear };
}

export function useEmailVerification(email: Ref<string>) {
  const sending = ref(false);
  const confirming = ref(false);
  const code = ref('');
  const error = ref('');
  /** Письмо отправлено в этом сеансе — показываем ввод кода, а не кнопку. */
  const sent = ref(false);
  const { cooldown, start: startCooldown, clear: clearCooldown } = useResendCooldown();

  /** Запросить письмо с кодом. Возвращает false, если письмо не ушло. */
  async function send(): Promise<boolean> {
    if (sending.value || !email.value) return false;
    sending.value = true;
    error.value = '';
    try {
      const window = await api.requestCode(email.value);
      sent.value = true;
      code.value = '';
      startCooldown(window.cooldown_seconds);
      return true;
    } catch (e) {
      FailAlert(e);
      return false;
    } finally {
      sending.value = false;
    }
  }

  /** Проверить введённый код. Возвращает true только при успешном подтверждении. */
  async function confirm(): Promise<boolean> {
    if (confirming.value || code.value.length !== EMAIL_CODE_LENGTH) return false;
    confirming.value = true;
    error.value = '';
    try {
      await api.confirmCode(email.value, code.value);
      return true;
    } catch (e: any) {
      // Ошибку показываем под полем, а не всплывающим уведомлением: пайщик
      // смотрит на код, а не в угол экрана.
      error.value = e?.message || 'Неверный код';
      code.value = '';
      return false;
    } finally {
      confirming.value = false;
    }
  }

  /** Начать заново с другим адресом: ошибся при вводе почты. */
  function reset(): void {
    sent.value = false;
    code.value = '';
    error.value = '';
    clearCooldown();
  }

  const canResend = computed(() => !sending.value && cooldown.value === 0);

  return { code, error, sent, sending, confirming, cooldown, canResend, send, confirm, reset };
}

/**
 * Почта пайщика и её статус по данным сервера
 * (`provider_account.is_email_verified`), а не по локальному состоянию: код
 * могли ввести в другой вкладке.
 */
export function useAccountEmail() {
  const session = useSessionStore();
  const email = computed<string>(() => session.providerAccount?.email ?? '');
  const isVerified = computed<boolean>(() => session.providerAccount?.is_email_verified === true);
  return { email, isVerified };
}
