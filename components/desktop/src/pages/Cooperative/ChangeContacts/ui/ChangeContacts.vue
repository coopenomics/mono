<template lang="pug">
.contacts-page
  .banner
    q-icon.banner__icon(name='fa-solid fa-circle-info' size='18px')
    .banner__body
      | Эти контакты показываются всем — в разделе «Контакты кооператива»
      | пайщикам и в подвале сайта незарегистрированным посетителям.
      | Держите их актуальными.

  q-card.surface-card(flat)
    .section-title Публичные контакты
    .section-note Данные для связи с кооперативом.

    q-input(
      v-model="phone"
      outlined
      color="primary"
      dense
      label="Телефон"
      type="tel"
    )
    q-input(
      v-model="email"
      outlined
      color="primary"
      dense
      label="Электронная почта"
      type="email"
    )

    .action-row
      q-btn(@click='update' color="primary" unelevated size="md")
        q-icon(name="save").q-mr-sm
        span Сохранить контакты
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useUpdateMeta } from 'src/features/User/UpdateMeta';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useCooperativeStore } from 'src/entities/Cooperative';

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

    SuccessAlert('Контакты успешно обновлены');
  } catch (e: any) {
    FailAlert(`Возникла ошибка при обновлении: ${e.message}`);
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
