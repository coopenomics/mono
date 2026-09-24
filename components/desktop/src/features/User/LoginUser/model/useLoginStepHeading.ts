import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { t } from 'src/shared/i18n';

export type LoginStep = 'login' | 'migrate' | 'twofactor';

interface LoginStepHeading {
  /** Текущий шаг формы; переключается обработчиком `step-change` у LoginForm. */
  step: Ref<LoginStep>;
  title: ComputedRef<string>;
  subtitle: ComputedRef<string | undefined>;
}

/**
 * Заголовок карточки входа по шагу формы.
 *
 * Установка пароля — уже не вход, и выглядеть она должна иначе. Пока заголовок
 * оставался прежним, а под ним стояла та же почта, экран после нажатия «Войти»
 * менялся так мало, что переход было легко не заметить: человек видел почти ту
 * же форму и не понимал, что от него теперь хотят другого.
 *
 * Заголовок принадлежит не форме, а тому, кто её показывает, — а показывают её
 * из двух мест с разными заголовками входа. Отсюда общий расчёт: свой заголовок
 * входа передаётся, заголовок установки пароля один на всех.
 */
export function useLoginStepHeading(login: { title: string; subtitle?: string }): LoginStepHeading {
  const step = ref<LoginStep>('login');

  const title = computed(() => {
    if (step.value === 'migrate') return t('user.loginStepHeading.migrateTitle');
    if (step.value === 'twofactor') return t('user.loginStepHeading.twofactorTitle');
    return login.title;
  });
  const subtitle = computed(() => {
    if (step.value === 'migrate') return t('user.loginStepHeading.migrateSubtitle');
    if (step.value === 'twofactor') return t('user.loginStepHeading.twofactorSubtitle');
    return login.subtitle;
  });

  return { step, title, subtitle };
}

/**
 * Тексты тёмной панели экранов входа (AuthSplit). Формулировки владельца 16.09.2026;
 * вход и вход с переадресацией показывают одну и ту же панель.
 */
export const LOGIN_PANE = {
  title: t('user.loginStepHeading.paneTitle'),
  lead: t('user.loginStepHeading.paneLead'),
  quote: t('user.loginStepHeading.paneQuote'),
} as const;
