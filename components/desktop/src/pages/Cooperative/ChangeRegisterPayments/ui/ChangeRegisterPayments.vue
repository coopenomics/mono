<script setup lang="ts">
import { RegistratorContract } from 'cooptypes';
import { useCooperativeStore } from 'src/entities/Cooperative';
import { useSessionStore } from 'src/entities/Session';
import { useUpdateCoop } from 'src/features/Cooperative/UpdateCoop';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatToAsset } from 'src/shared/lib/utils/formatToAsset';
import { ref, watch, computed } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { env } from 'src/shared/config';
import { t } from 'src/shared/i18n';

const { info } = useSystemStore();
const currency = computed(() => env.CURRENCY);
const coop = useCooperativeStore();
// realtime: нет источника — форма взносов при вступлении: поля заполняются из карточки кооператива, живое перечитывание затёрло бы ввод; меняет их только этот экран.
coop.loadPublicCooperativeData(info.coopname);

const localCoop = ref({
  initial: 0,
  minimum: 0,
  org_initial: 0,
  org_minimum: 0,
});

const save = async () => {
  const { updateCoop } = useUpdateCoop();
  const session = useSessionStore();

  if (coop.publicCooperativeData) {
    try {
      await updateCoop({
        coopname: info.coopname,
        username: session.username,
        initial: formatToAsset(localCoop.value.initial, env.CURRENCY as string),
        minimum: formatToAsset(localCoop.value.minimum, env.CURRENCY as string),
        org_initial: formatToAsset(localCoop.value.org_initial, env.CURRENCY as string),
        org_minimum: formatToAsset(localCoop.value.org_minimum, env.CURRENCY as string),
        announce: coop.publicCooperativeData?.announce,
        description: coop.publicCooperativeData?.description,
      });
      await coop.loadPublicCooperativeData(info.coopname);

      SuccessAlert(t('cooperative.changeRegisterPayments.updateSuccess'));
    } catch (e: any) {
      FailAlert(`${e.message}`);
    }
  } else {
    FailAlert(t('cooperative.changeRegisterPayments.updateError'));
  }
};

watch(
  () => coop.publicCooperativeData,
  (newCoop: RegistratorContract.Tables.Cooperatives.ICooperative | undefined) => {
    if (newCoop) {
      localCoop.value = {
        initial: parseFloat(newCoop.initial),
        minimum: parseFloat(newCoop.minimum),
        org_initial: parseFloat(newCoop.org_initial),
        org_minimum: parseFloat(newCoop.org_minimum),
      };
    }
  },
);
</script>

<template lang="pug">
.contributions-page
  .banner
    q-icon.banner__icon(name='fa-solid fa-circle-info' size='18px')
    .banner__body
      | {{ $t('cooperative.changeRegisterPayments.bannerText') }}

  .section-grid.two-col
    q-card.surface-card(flat bordered)
      .section-title {{ $t('cooperative.changeRegisterPayments.individualSectionTitle') }}
      .section-note {{ $t('cooperative.changeRegisterPayments.individualSectionNote') }}
      q-input(
        outlined
        color="primary"
        dense
        v-model="localCoop.initial"
        :label="$t('cooperative.changeRegisterPayments.initialIndividualLabel')"
      )
        template(#append)
          span.text-overline {{ currency }}

      q-input(
        outlined
        color="primary"
        dense
        v-model="localCoop.minimum"
        :label="$t('cooperative.changeRegisterPayments.minimumIndividualLabel')"
      )
        template(#append)
          span.text-overline {{ currency }}

    q-card.surface-card(flat bordered)
      .section-title {{ $t('cooperative.changeRegisterPayments.orgSectionTitle') }}
      .section-note {{ $t('cooperative.changeRegisterPayments.orgSectionNote') }}
      q-input(
        outlined
        color="primary"
        dense
        v-model="localCoop.org_initial"
        :label="$t('cooperative.changeRegisterPayments.initialOrgLabel')"
      )
        template(#append)
          span.text-overline {{ currency }}
      q-input(
        outlined
        color="primary"
        dense
        v-model="localCoop.org_minimum"
        :label="$t('cooperative.changeRegisterPayments.minimumOrgLabel')"
      )
        template(#append)
          span.text-overline {{ currency }}

  .action-row.q-pa-md
    q-btn(
      color="primary"
      @click="save"
    )
      q-icon(name="save").q-mr-sm
      span {{ $t('common.action.save') }}
</template>

<style scoped lang="scss">
.contributions-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}

.section-grid {
  display: grid;
  gap: var(--p-4, 16px);
}

.two-col {
  grid-template-columns: 1fr;
}

@media (min-width: 900px) {
  .two-col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  margin-bottom: var(--p-1, 4px);
}

.action-row {
  display: flex;
  justify-content: flex-start;
  padding-top: var(--p-2, 8px);
}
</style>
