<template>
  <AuthCard
    title="Восстановление доступа"
    subtitle="Подтвердите смену ключа и задайте новый пароль"
  >
    <BaseForm :loading="loading" :error="errorMessage" @submit="submit">
      <BaseInput
        v-model="email"
        label="Электронная почта"
        type="email"
        autocomplete="email"
        :error="emailError"
        required
      />

      <div class="recover-confirm__field">
        <span class="recover-confirm__label">Код из приложения-аутентификатора</span>
        <OtpInput v-model="totp" :length="6" :error="totpError" />
      </div>

      <BaseInput
        v-model="newPassword"
        label="Новый пароль"
        type="password"
        autocomplete="new-password"
        :hint="PASSWORD_POLICY_HINT"
        :error="passwordError"
        required
      />
      <BaseInput
        v-model="repeatPassword"
        label="Повторите пароль"
        type="password"
        autocomplete="new-password"
        :error="repeatError"
        required
      />

      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="loading"
        :disabled="!isValid"
      >
        Восстановить доступ
      </BaseButton>
    </BaseForm>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AuthCard>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { PASSWORD_POLICY_HINT, passwordPolicyErrors } from '@coopenomics/auth';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useRecoverAccess } from 'src/features/User/RecoverAccess';
import { navigateToPath } from 'src/shared/lib/navigation';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
import { OtpInput } from 'src/shared/ui/domain/OtpInput';

const props = defineProps<{
  /** Одноразовый токен восстановления из ссылки письма. */
  token: string;
  /** Coopname кооператива — для возврата на вход после успеха. */
  coopname: string;
}>();

const { confirmRecovery } = useRecoverAccess();
const { emailIsValid } = useCreateUser();

const email = ref('');
const totp = ref('');
const newPassword = ref('');
const repeatPassword = ref('');
const loading = ref(false);
const errorMessage = ref('');

const isValidEmail = computed(() => emailIsValid(email.value));
const isValidTotp = computed(() => totp.value.length === 6);
const isValidPassword = computed(
  () => passwordPolicyErrors(newPassword.value).length === 0,
);
const passwordsMatch = computed(
  () => !!repeatPassword.value && repeatPassword.value === newPassword.value,
);

const emailError = computed(() =>
  email.value && !isValidEmail.value ? 'Введите корректный email' : '',
);
const totpError = computed(() =>
  totp.value && !isValidTotp.value ? 'Код состоит из 6 цифр' : '',
);
const passwordError = computed(() =>
  newPassword.value ? passwordPolicyErrors(newPassword.value).join(', ') : '',
);
const repeatError = computed(() =>
  repeatPassword.value && !passwordsMatch.value ? 'Пароли не совпадают' : '',
);

const isValid = computed(
  () =>
    isValidEmail.value &&
    isValidTotp.value &&
    isValidPassword.value &&
    passwordsMatch.value,
);

const submit = async (): Promise<void> => {
  if (!isValid.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    await confirmRecovery({
      email: email.value,
      token: props.token,
      totp: totp.value,
      newPassword: newPassword.value,
    });
    SuccessAlert('Доступ восстановлен. Входим…');
    // Сессия CoopID построена, токены и PIN-кэш ключа персистнуты — перезагрузка
    // по каноническому boot-пути сама поднимет сессию (токены из IndexedDB + ключ
    // из PIN-кэша) и доведёт до рабочего стола; переживает F5 (паритет с легаси).
    navigateToPath(`/${props.coopname}`, { reload: true });
  } catch (e: any) {
    errorMessage.value =
      e?.message || 'Не удалось восстановить доступ. Проверьте код и попробуйте снова.';
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.recover-confirm__field {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
.recover-confirm__label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
</style>
