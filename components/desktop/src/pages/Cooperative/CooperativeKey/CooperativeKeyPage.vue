<template lang="pug">
.key-page
  .banner
    q-icon.banner__icon(name='fa-solid fa-circle-info' size='18px')
    .banner__body
      | {{ $t('cooperative.cooperativeKeyPage.bannerLine1') }}
      | {{ $t('cooperative.cooperativeKeyPage.bannerLine2') }}
      | {{ $t('cooperative.cooperativeKeyPage.bannerLine3') }}

  q-card.surface-card(flat)
    .section-title {{ $t('cooperative.cooperativeKeyPage.sectionTitle') }}
    .section-note {{ $t('cooperative.cooperativeKeyPage.sectionNote') }}

    q-input(
      v-model='privateKey'
      :label='$t("cooperative.cooperativeKeyPage.keyLabel")'
      type='password'
      outlined
      color='primary'
      dense
      :loading='loading'
      :disable='loading'
      :hint='$t("cooperative.cooperativeKeyPage.keyHint")'
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
        | {{ $t('cooperative.cooperativeKeyPage.submitLabel') }}
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSetCooperativeKey } from 'src/features/System/SetCooperativeKey';
import {
  SuccessAlert,
  FailAlert,
  extractGraphQLErrorMessages,
} from 'src/shared/api';
import { t } from 'src/shared/i18n';

const { setCooperativeKey } = useSetCooperativeKey();

const privateKey = ref('');
const loading = ref(false);

onMounted(() => {
  privateKey.value = '5********************************';
});

const updateKey = async () => {
  if (!privateKey.value || privateKey.value === '5********************************') {
    FailAlert(t('cooperative.cooperativeKeyPage.invalidKeyError'));
    return;
  }

  try {
    loading.value = true;

    await setCooperativeKey(privateKey.value);

    privateKey.value = '5********************************';

    SuccessAlert(t('cooperative.cooperativeKeyPage.updateSuccess'));
  } catch (error: any) {
    FailAlert(t('cooperative.cooperativeKeyPage.updateError', { message: extractGraphQLErrorMessages(error) }));
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
