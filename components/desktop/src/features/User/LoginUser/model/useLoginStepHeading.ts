import { computed, ref, type ComputedRef, type Ref } from 'vue';

export type LoginStep = 'login' | 'migrate';

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

  const title = computed(() => (step.value === 'migrate' ? 'Придумайте пароль' : login.title));
  const subtitle = computed(() =>
    step.value === 'migrate' ? 'Вход по ключу доступа больше не понадобится' : login.subtitle,
  );

  return { step, title, subtitle };
}
