<template>
  <ResetKeyForm
    :mode="mode"
    :account="account"
    :loading="loading"
    @submit="onSubmit"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useResetKey } from 'src/features/User/ResetKey/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import type { IGeneratedAccount } from 'src/shared/lib/types/user';
import ResetKeyForm from './ResetKeyForm.vue';

const route = useRoute();
const router = useRouter();
const { generateAccount } = useCreateUser();
const { resetKey } = useResetKey();

const token = computed(() => (route.query.token as string | undefined) ?? '');
const mode = computed<'check-mail' | 'save-key'>(() =>
  token.value ? 'save-key' : 'check-mail',
);

// Ключ генерируется в браузере один раз при заходе по email-ссылке.
// Если token нет — генерировать незачем, просто показываем «Проверьте почту».
const account = ref<IGeneratedAccount | null>(
  token.value ? generateAccount() : null,
);

const loading = ref(false);

async function onSubmit(): Promise<void> {
  if (!account.value || !token.value) return;
  loading.value = true;
  try {
    await resetKey({ token: token.value, public_key: account.value.public_key });
    SuccessAlert('Ключ доступа успешно установлен');
    void router.push({ name: 'signin' });
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
</script>
