<template lang="pug">
.user-data-stack(v-if='userData.organization_data')
  q-input(
    ref='firstInput'
    :autofocus="!$slots.top"
    v-model='userData.organization_data.short_name',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.shortNameLabel")',
    :placeholder='$t("ui.organizationDataForm.shortNamePlaceholder")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.full_name',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.fullNameLabel")',
    :placeholder='$t("ui.organizationDataForm.fullNamePlaceholder")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-select(
    v-model='userData.organization_data.type',
    :label='$t("ui.organizationDataForm.typeLabel")',
    outlined color='primary',
    :options='[ { label: $t("ui.organizationDataForm.typeConsumerOption"), value: Zeus.OrganizationType.COOP }, { label: $t("ui.organizationDataForm.typeProductionOption"), value: Zeus.OrganizationType.PRODCOOP }, { label: $t("ui.organizationDataForm.typeLlcOption"), value: Zeus.OrganizationType.OOO }, ]',
    emit-value,
    map-options
  ).q-mb-md

  q-input(
    v-model='userData.organization_data.represented_by.last_name',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.repLastNameLabel")',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.first_name',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.repFirstNameLabel")',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.middle_name',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.repMiddleNameLabel")',
    :rules='[(val) => validatePersonalName(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.represented_by.based_on',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.basisLabel")',
    :placeholder='$t("ui.organizationDataForm.basisPlaceholder")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.position',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.repPositionLabel")',
    :placeholder='$t("ui.organizationDataForm.repPositionPlaceholder")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.phone',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.repPhoneLabel")',
    mask='+7 (###) ###-##-##',
    fill-mask,
    :rules='[(val) => notEmpty(val), (val) => notEmptyPhone(val)]',
    autocomplete='off'
  )

  q-select(
    v-model='userData.organization_data.country',
    outlined color='primary',
    map-options,
    emit-value,
    option-label='label',
    option-value='value',
    :label='$t("ui.organizationDataForm.countryLabel")',
    :options='[{ label: $t("ui.organizationDataForm.russiaOptionLabel"), value: "Russia" }]',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.city',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.cityLabel")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.full_address',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.legalAddressLabel")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.fact_address',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.actualAddressLabel")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
    template(v-slot:append)
      q-btn(
        dense,
        flat,
        size='sm',
        color='primary',
        @click='userData.organization_data.fact_address = userData.organization_data.full_address'
      ) {{ $t('ui.organizationDataForm.sameAsLegalLabel') }}

  q-input(
    v-model='userData.organization_data.details.inn',
    outlined color='primary',
    mask='############',
    :label='$t("ui.organizationDataForm.innLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 10 || val.length === 12 || $t("ui.organizationDataForm.innError")]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.details.ogrn',
    outlined color='primary',
    mask='###############',
    :label='$t("ui.organizationDataForm.ogrnLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 13 || val.length === 15 || $t("ui.organizationDataForm.ogrnError")]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.details.kpp',
    outlined color='primary',
    mask='#########',
    :label='$t("ui.organizationDataForm.kppLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || $t("ui.organizationDataForm.kppError")]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.bank_name',
    outlined color='primary',
    :label='$t("ui.organizationDataForm.bankNameLabel")',
    :placeholder='$t("ui.organizationDataForm.bankNamePlaceholder")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.details.corr',
    outlined color='primary',
    mask='####################',
    :label='$t("ui.organizationDataForm.corrAccountLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || $t("ui.organizationDataForm.corrAccountError")]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.bank_account.details.bik',
    outlined color='primary',
    mask='#########',
    :label='$t("ui.organizationDataForm.bikLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || $t("ui.organizationDataForm.bikError")]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.account_number',
    outlined color='primary',
    mask='####################',
    :label='$t("ui.organizationDataForm.accountNumberLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || $t("ui.organizationDataForm.accountNumberError")]',
    autocomplete='off'
  )

  q-select(
    v-model='userData.organization_data.bank_account.currency',
    :label='$t("ui.organizationDataForm.currencyLabel")',
    outlined color='primary',
    :options='[{ label: "RUB", value: "RUB" }]',
    emit-value,
    :rules='[(val) => notEmpty(val)]',
    map-options
  )
</template>

<script setup lang="ts">
import {
  validatePersonalName,
  notEmpty,
  notEmptyPhone,
} from 'src/shared/lib/utils';

import type { IUserData } from 'src/shared/lib/types/user/IUserData';
import { ref, onMounted, nextTick } from 'vue';
import { Zeus } from '@coopenomics/sdk';

const props = defineProps<{ userData: IUserData }>();

const userData = ref<IUserData>(props.userData);
const firstInput = ref<any>();

onMounted(async () => {
  await nextTick();
  firstInput.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
</script>

<style scoped>
.user-data-stack {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  margin-top: var(--p-4, 16px);
}
</style>
