<template lang="pug">
.payment-provider-page
  .banner
    q-icon.banner__icon(name='fa-solid fa-circle-info' size='18px')
    .banner__body
      | Выберите провайдера входящих платежей по умолчанию для вашего кооператива.
      | Этот провайдер будет использоваться для создания и обработки платежей пайщиков.

  q-card(flat)
    q-card-section
      PaymentProviderForm(
        :loading='saving'
        @submit='onSubmit'
        @success='onSuccess'
        @error='onError'
      )
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { PaymentProviderForm } from 'app/extensions/chairman/features/PaymentProvider';

const saving = ref(false);
const systemStore = useSystemStore();

onMounted(async () => {
  if (!systemStore.info) {
    await systemStore.loadSystemInfo();
  }
});

const onSubmit = () => {
  saving.value = true;
};

const onSuccess = () => {
  saving.value = false;
};

const onError = (error: Error) => {
  saving.value = false;
  console.error('Ошибка сохранения провайдера платежей:', error);
};
</script>

<style scoped lang="scss">
.payment-provider-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}
</style>
