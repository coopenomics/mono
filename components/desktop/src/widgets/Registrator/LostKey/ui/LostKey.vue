<template>
  <AuthSplit
    :eyebrow="coopTitle"
    title="Перевыпуск ключа"
    lead="Новый ключ доступа создаётся в вашем браузере и заменяет утерянный."
    quote="Ключ подписывает документы от вашего имени — храните его в менеджере паролей."
    step-eyebrow="Перевыпуск ключа"
    heading="Куда прислать ссылку"
    text="Введите электронную почту, на которую зарегистрирован аккаунт."
  >
    <template v-if="$slots['pane-foot']" #pane-foot>
      <slot name="pane-foot" />
    </template>
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
    <template v-if="$slots.footer" #foot>
      <slot name="footer" />
    </template>
  </AuthSplit>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useLostKey } from 'src/features/User/LostKey/model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';

const router = useRouter();
const { startResetKey } = useLostKey();
const { emailIsValid } = useCreateUser();
const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

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
