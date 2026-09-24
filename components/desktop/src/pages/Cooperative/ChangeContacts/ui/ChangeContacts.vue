<template lang="pug">
.contacts-page
  .banner
    q-icon.banner__icon(name='fa-solid fa-circle-info' size='18px')
    .banner__body
      | {{ $t('cooperative.changeContacts.bannerLine1') }}
      | {{ $t('cooperative.changeContacts.bannerLine2') }}
      | {{ $t('cooperative.changeContacts.bannerLine3') }}

  q-card.surface-card(flat)
    .section-title {{ $t('cooperative.changeContacts.sectionTitle') }}
    .section-note {{ $t('cooperative.changeContacts.sectionNote') }}

    q-input(
      v-model="phone"
      outlined
      color="primary"
      dense
      :label="$t('cooperative.changeContacts.phoneLabel')"
      type="tel"
    )
    q-input(
      v-model="email"
      outlined
      color="primary"
      dense
      :label="$t('cooperative.changeContacts.emailLabel')"
      type="email"
    )

    .action-row
      q-btn(@click='update' color="primary" unelevated size="md")
        q-icon(name="save").q-mr-sm
        span {{ $t('cooperative.changeContacts.submitLabel') }}
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useUpdateMeta } from 'src/features/User/UpdateMeta';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useCooperativeStore } from 'src/entities/Cooperative';
import { t } from 'src/shared/i18n';

const { info } = useSystemStore();
const coop = useCooperativeStore();
const phone = ref<string>('');
const email = ref<string>('');

watch(
  () => info.contacts,
  (newValue) => {
    if (newValue) {
      phone.value = newValue.phone;
      email.value = newValue.email;
    }
  },
  { immediate: true },
);

coop.loadPublicCooperativeData(info.coopname);

const update = async () => {
  const { updateMeta } = useUpdateMeta();

  try {
    await updateMeta(info.coopname, {
      phone: phone.value || '',
      email: email.value || '',
    });

    SuccessAlert(t('cooperative.changeContacts.updateSuccess'));
  } catch (e: any) {
    FailAlert(t('cooperative.changeContacts.updateError', { message: e.message }));
  }
};
</script>

<style scoped lang="scss">
.contacts-page {
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
