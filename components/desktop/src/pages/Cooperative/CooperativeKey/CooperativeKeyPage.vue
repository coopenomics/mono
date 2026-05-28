<template lang="pug">
.key-page
  .banner
    q-icon.banner__icon(name='fa-solid fa-circle-info' size='18px')
    .banner__body
      | Приватный ключ используется для подписи транзакций в блокчейне. Хранится
      | зашифрованным на сервере. Обновляйте его при смене ключа у аккаунта
      | кооператива или при восстановлении доступа.

  q-card.surface-card(flat)
    .section-title Приватный ключ
    .section-note Введите новый приватный ключ, чтобы заменить текущий.

    q-input(
      v-model='privateKey'
      label='Приватный ключ'
      type='password'
      outlined
      color='primary'
      dense
      :loading='loading'
      :disable='loading'
      hint='Ключ не отображается после сохранения'
    )
      template(#prepend)
        q-icon(name='key')

    .action-row
      q-btn(
        :loading='loading'
        :disable='!privateKey || loading'
        @click='updateKey'
        color='primary'
        unelevated
        size='md'
      )
        q-icon.q-mr-sm(name='update')
        | Обновить ключ
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSetCooperativeKey } from 'src/features/System/SetCooperativeKey';
import {
  SuccessAlert,
  FailAlert,
  extractGraphQLErrorMessages,
} from 'src/shared/api';

const { setCooperativeKey } = useSetCooperativeKey();

const privateKey = ref('');
const loading = ref(false);

onMounted(() => {
  privateKey.value = '5********************************';
});

const updateKey = async () => {
  if (!privateKey.value || privateKey.value === '5********************************') {
    FailAlert('Пожалуйста, введите действительный приватный ключ');
    return;
  }

  try {
    loading.value = true;

    await setCooperativeKey(privateKey.value);

    privateKey.value = '5********************************';

    SuccessAlert('Ключ кооператива успешно обновлен');
  } catch (error: any) {
    FailAlert(`Ошибка обновления ключа: ${extractGraphQLErrorMessages(error)}`);
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.key-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}

.surface-card {
  border-radius: var(--p-r-md, 12px);
  padding: var(--p-5, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.section-title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}

.section-note {
  font-size: var(--p-fs-body-sm);
  line-height: 1.45;
  color: var(--p-ink-2);
}

.action-row {
  display: flex;
  justify-content: flex-start;
  padding-top: var(--p-2, 8px);
}
</style>
