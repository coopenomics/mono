<template>
  <AuthCard
    title="Перевыпуск ключа"
    subtitle="Введите электронную почту для восстановления доступа"
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
      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="loading"
        :disabled="!isValidEmail"
      >
        Продолжить
      </BaseButton>
    </BaseForm>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AuthCard>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useLostKey } from 'src/features/User/LostKey/model';
import { FailAlert } from 'src/shared/api';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';

const router = useRouter();
const { startResetKey } = useLostKey();
const { emailIsValid } = useCreateUser();

const email = ref('');
const loading = ref(false);
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
    await startResetKey({ email: email.value });
    void router.push({ name: 'resetkey' });
  } catch (e: any) {
    errorMessage.value = e?.message || 'Не удалось отправить запрос. Попробуйте позже.';
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};
</script>
