<template lang="pug">
div.matrix-registration
  .registration-card
    .registration-header
      .widget-icon
        i.fas.fa-comments
    h2.registration-title {{ $t('chatcoop.matrixRegistration.title') }}

    form.registration-form(@submit.prevent="handleSubmit")
      .form-group
        label.form-label Email
        q-input(
          :model-value="email",
          readonly,
          outlined,
          dense,
          :placeholder="$t('chatcoop.matrixRegistration.emailPlaceholder')",
          autocomplete="off",
          class="matrix-input"
        )

      .form-group
        label.form-label {{ $t('chatcoop.matrixRegistration.usernameLabel') }}
        q-input(
          v-model="username",
          outlined,
          dense,
          :placeholder="$t('chatcoop.matrixRegistration.usernamePlaceholder')",
          autocomplete="off",
          lazy-rules,
          no-error-icon,
          :rules="[validateUsernameAsync]",
          :loading="checkingUsername",
          :color="usernameAvailable === false ? 'negative' : usernameAvailable === true ? 'positive' : 'primary'",
          class="matrix-input"
        )

      .form-group
        label.form-label {{ $t('chatcoop.matrixRegistration.passwordLabel') }}
        q-input(
          v-model="password",
          type="password",
          outlined,
          dense,
          :placeholder="$t('chatcoop.matrixRegistration.passwordPlaceholder')",
          autocomplete="off",
          lazy-rules,
          no-error-icon,
          :rules="[validatePassword]",
          class="matrix-input"
        )

      .form-group
        label.form-label {{ $t('chatcoop.matrixRegistration.repeatPasswordLabel') }}
        q-input(
          v-model="confirmPassword",
          type="password",
          outlined,
          dense,
          :placeholder="$t('chatcoop.matrixRegistration.repeatPasswordLabel')",
          autocomplete="off",
          lazy-rules,
          no-error-icon,
          :rules="[validateConfirmPassword]",
          class="matrix-input"
        )

      .error-message(v-if="combinedError")
        q-icon(name="error", color="negative", size="sm")
        span {{ combinedError }}

      q-btn(
        type="submit",
        :loading="isLoading",
        :disable="!username || !password || !confirmPassword || password !== confirmPassword || usernameAvailable === false",
        color="primary",
        size="lg",
        unelevated,
        rounded,
        class="registration-btn"
      )
        template(#loading)
          | {{ $t('chatcoop.matrixRegistration.creatingLabel') }}
        | {{ $t('chatcoop.matrixRegistration.continueLabel') }}
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useMatrixRegistration } from '../model/useMatrixRegistration';
import { useCreateMatrixAccount } from '../../../pages/ChatCoopPage/features/CreateMatrixAccount/model/useCreateMatrixAccount';
import { useSessionStore } from 'src/entities/Session/model/store';
import { t } from '../../../i18n';

const sessionStore = useSessionStore();

// Получаем email пользователя напрямую из session store
const email = computed(() => (sessionStore.providerAccount as any)?.email || '');

const {
  username,
  password,
  confirmPassword,
  usernameAvailable,
  checkingUsername,
  isSubmitting,
  error,
  validateForm,
  resetForm,
  validateUsernameAsync,
} = useMatrixRegistration();

// Валидация имени пользователя теперь асинхронная (validateUsernameAsync)

// Валидация пароля: минимум 6 символов, буквы, цифры и символы
const validatePassword = (val: string): string | boolean => {
  if (!val || val.length < 6) {
    return t('chatcoop.matrixRegistration.passwordMinLengthError');
  }

  const hasLetter = /[a-zA-Zа-яА-Я]/.test(val);
  const hasDigit = /\d/.test(val);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;':",./<>?`~]/.test(val);

  if (!hasLetter) {
    return t('chatcoop.matrixRegistration.passwordLetterError');
  }

  if (!hasDigit) {
    return t('chatcoop.matrixRegistration.passwordDigitError');
  }

  if (!hasSpecial) {
    return t('chatcoop.matrixRegistration.passwordSpecialCharError');
  }

  return true;
};

// Валидация совпадения паролей
const validateConfirmPassword = (val: string): string | boolean => {
  if (!val) {
    return t('chatcoop.matrixRegistration.repeatPasswordLabel');
  }

  if (val !== password.value) {
    return t('chatcoop.matrixRegistration.passwordMismatchError');
  }

  return true;
};
const { createAccount, isLoading: isCreatingAccount, error: createAccountError } = useCreateMatrixAccount();

// Объединяем состояния загрузки
const isLoading = computed(() => isSubmitting.value || isCreatingAccount.value);

// Объединяем ошибки
const combinedError = computed(() => error.value || createAccountError.value);

const emit = defineEmits<{
  accountCreated: [];
}>();

const handleSubmit = async () => {
  if (!validateForm()) {
    isSubmitting.value = false; // Сбрасываем флаг при ошибке валидации
    return;
  }

  isSubmitting.value = true;
  const success = await createAccount(username.value, password.value);

  if (success) {
    resetForm();
    emit('accountCreated');
  }

  isSubmitting.value = false;
};
</script>


<style lang="scss" scoped>
.matrix-registration {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 56px);
  padding: 2rem;

}


.registration-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  padding: 3rem 2.5rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.15);
  }
}

.registration-header {
  text-align: center;
  margin-bottom: 2.5rem;

  .widget-icon {
    width: 60px;
    height: 60px;
    border-radius: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
    box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
  }
}

.registration-title {
  color: #2c3e50;
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.02em;
  padding-bottom: 20px;
  text-align: center;
}


.registration-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 600;
  color: #34495e;
  font-size: 0.95rem;
  letter-spacing: 0.01em;
}


.matrix-input {
  :deep(.q-field__control) {
    border-radius: 12px;
    border: 2px solid transparent;
    background: rgba(255, 255, 255, 0.8);
    transition: all 0.3s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.95);
      border-color: rgba(102, 126, 234, 0.2);
    }

    &.q-field--focused {
      background: white;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
  }


  :deep(.q-field__native),
  :deep(.q-field__input) {
  font-size: 1rem;
  font-weight: 500;
    color: #2c3e50;
  }


  :deep(.q-field--readonly .q-field__native) {
    background: rgba(248, 249, 250, 0.8);
    cursor: not-allowed;
    color: #6c757d;
  }


  :deep(.q-field__label) {
    font-weight: 600;
    color: #34495e;
    font-size: 0.9rem;
  }

}

.registration-btn {
  margin-top: 1rem;
  height: 56px;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    transform: none;
  }
}


.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #e74c3c;
  font-size: 0.9rem;
  font-weight: 500;
  text-align: center;
  justify-content: center;
  background: rgba(231, 76, 60, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(231, 76, 60, 0.2);
}

</style>
