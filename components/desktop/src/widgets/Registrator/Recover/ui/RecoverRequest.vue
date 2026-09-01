<template>
  <AuthCard
    title="Восстановление доступа"
    subtitle="Введите электронную почту — пришлём ссылку для восстановления"
  >
    <BaseBanner v-if="sent" variant="pos">
      Если этот адрес зарегистрирован, мы отправили на него ссылку для восстановления
      доступа. Откройте письмо и перейдите по ссылке — она действует 5 минут.
    </BaseBanner>
    <BaseForm v-else :loading="loading" :error="errorMessage" @submit="submit">
      <BaseInput
        v-model="email"
        label="Электронная почта"
        type="email"
        autocomplete="email"
        :error="emailError"
        required
      />
      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="loading"
        :disabled="!isValidEmail"
      >
        Отправить ссылку
      </BaseButton>
    </BaseForm>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AuthCard>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useRecoverAccess } from 'src/features/User/RecoverAccess';
import { FailAlert } from 'src/shared/api';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';

const { requestRecovery } = useRecoverAccess();
const { emailIsValid } = useCreateUser();

const email = ref('');
const loading = ref(false);
const sent = ref(false);
const errorMessage = ref('');

const isValidEmail = computed(() => emailIsValid(email.value));
const emailError = computed(() =>
  email.value && !isValidEmail.value ? 'Введите корректный email' : '',
);

const submit = async (): Promise<void> => {
  if (!isValidEmail.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    await requestRecovery(email.value);
    // Исход всегда «письмо отправлено» — существование адреса наружу не раскрывается.
    sent.value = true;
  } catch (e: any) {
    errorMessage.value =
      e?.message || 'Не удалось отправить запрос. Попробуйте позже.';
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};
</script>
