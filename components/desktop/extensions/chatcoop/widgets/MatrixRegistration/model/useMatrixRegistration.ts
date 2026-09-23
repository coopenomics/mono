import { ref, computed } from 'vue';
import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import { t } from '../../../i18n';

export function useMatrixRegistration() {
  const username = ref('');
  const password = ref('');
  const confirmPassword = ref('');
  const usernameAvailable = ref<boolean | null>(null);
  const checkingUsername = ref(false);

  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  const validateForm = (): boolean => {
    if (!username.value || !password.value || !confirmPassword.value) {
      error.value = t('chatcoop.matrixRegistrationValidation.fillAllFieldsError');
      return false;
    }

    if (usernameAvailable.value === false) {
      error.value = t('chatcoop.matrixRegistrationValidation.usernameTakenError');
      return false;
    }

    if (password.value !== confirmPassword.value) {
      error.value = t('chatcoop.matrixRegistrationValidation.passwordMismatchError');
      return false;
    }

    error.value = null;
    return true;
  };

  const resetForm = () => {
    username.value = '';
    password.value = '';
    confirmPassword.value = '';
    usernameAvailable.value = null;
    error.value = null;
  };

  // Асинхронная проверка доступности username
  const checkUsernameAvailability = async (value: string): Promise<boolean> => {
    if (!value || value.length < 3) return false;

    checkingUsername.value = true;
    try {
      const { [Queries.ChatCoop.CheckUsernameAvailability.name]: result } = await client.Query(
        Queries.ChatCoop.CheckUsernameAvailability.query,
        {
          variables: {
            data: { username: value },
          },
        }
      );
      usernameAvailable.value = result;
      return result;
    } catch (err) {
      console.error('Failed to check username availability:', err);
      usernameAvailable.value = false; // В случае ошибки считаем недоступным
      return false;
    } finally {
      checkingUsername.value = false;
    }
  };

  // Правило валидации для username
  const validateUsernameAsync = async (val: string): Promise<string | boolean> => {
    if (!val) {
      usernameAvailable.value = null;
      return t('chatcoop.matrixRegistrationValidation.usernameRequiredError');
    }

    if (val.length < 3) {
      usernameAvailable.value = null;
      return t('chatcoop.matrixRegistrationValidation.usernameMinLengthError');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(val)) {
      usernameAvailable.value = null;
      return t('chatcoop.matrixRegistrationValidation.usernameCharsError');
    }

    const available = await checkUsernameAvailability(val);
    return available || t('chatcoop.matrixRegistrationValidation.usernameTakenError');
  };

  return {
    username,
    password,
    confirmPassword,
    usernameAvailable: computed(() => usernameAvailable.value),
    checkingUsername: computed(() => checkingUsername.value),
    isSubmitting,
    error,
    validateForm,
    resetForm,
    checkUsernameAvailability,
    validateUsernameAsync,
  };
}
