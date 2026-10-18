<template lang="pug">
//- Ключ установки (разрешение platform) — им узел подписывает операции
//- кооператива. Выпускают его на странице «Подключение» у ВОСХОДа; после
//- перевыпуска прежний ключ сразу перестаёт действовать, и новый вводится здесь.
.key-page
  BaseBanner(variant="info") {{ $t('cooperative.cooperativeKeyPage.banner') }}

  BaseCard(
    :title="$t('cooperative.cooperativeKeyPage.sectionTitle')"
    :subtitle="$t('cooperative.cooperativeKeyPage.sectionNote')"
  )
    BaseInput(
      v-model="privateKey"
      :label="$t('cooperative.cooperativeKeyPage.keyLabel')"
      type="password"
      :hint="$t('cooperative.cooperativeKeyPage.keyHint')"
      :disable="loading"
      mono
    )
    .key-page__actions
      BaseButton(
        variant="primary"
        type="button"
        :loading="loading"
        :disabled="!privateKey"
        @click="updateKey"
      ) {{ $t('cooperative.cooperativeKeyPage.submitLabel') }}
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseBanner, BaseButton, BaseCard, BaseInput } from 'src/shared/ui/base';
import { useSetCooperativeKey } from 'src/features/System/SetCooperativeKey';
import { SuccessAlert, FailAlert, extractGraphQLErrorMessages } from 'src/shared/api';
import { t } from 'src/shared/i18n';

const { setCooperativeKey } = useSetCooperativeKey();

const privateKey = ref('');
const loading = ref(false);

const updateKey = async () => {
  if (!privateKey.value.trim()) {
    FailAlert(t('cooperative.cooperativeKeyPage.invalidKeyError'));
    return;
  }

  try {
    loading.value = true;
    await setCooperativeKey(privateKey.value.trim());
    privateKey.value = '';
    SuccessAlert(t('cooperative.cooperativeKeyPage.updateSuccess'));
  } catch (error: any) {
    FailAlert(t('cooperative.cooperativeKeyPage.updateError', { message: extractGraphQLErrorMessages(error) }));
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.key-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
}
.key-page__actions {
  display: flex;
  padding-top: var(--p-2);
}
@media (max-width: 768px) {
  .key-page {
    padding: var(--p-4);
  }
}
</style>
