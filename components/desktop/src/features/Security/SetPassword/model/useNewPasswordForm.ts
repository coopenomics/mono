import { computed, ref } from 'vue';
import { passwordPolicyErrors } from '@coopenomics/auth';

/**
 * Состояние пары полей «новый пароль + повтор» с валидацией по общей политике.
 * Используется карточкой настроек и диалогом мягкой миграции — правила одни.
 */
export function useNewPasswordForm() {
  const password = ref('');
  const repeat = ref('');

  const passwordsMatch = computed(() => !!repeat.value && repeat.value === password.value);
  const passwordError = computed(() =>
    password.value ? passwordPolicyErrors(password.value).join(', ') : '',
  );
  const repeatError = computed(() =>
    repeat.value && !passwordsMatch.value ? 'Пароли не совпадают' : '',
  );
  const isValid = computed(
    () => passwordPolicyErrors(password.value).length === 0 && passwordsMatch.value,
  );

  const reset = () => {
    password.value = '';
    repeat.value = '';
  };

  return { password, repeat, passwordError, repeatError, isValid, reset };
}
