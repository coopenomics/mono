<template lang="pug">
.user-data-stack(v-if="data")
  slot(name="top")

  q-input(
    ref='firstInput'
    :autofocus="!$slots.top"
    v-model='data.short_name',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.shortNameLabel")',
    :placeholder='$t("ui.createOrganizationDataForm.shortNamePlaceholder")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.full_name',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.fullNameLabel")',
    :placeholder='$t("ui.createOrganizationDataForm.fullNamePlaceholder")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-select(
    v-model='data.type',
    :label='$t("ui.createOrganizationDataForm.typeLabel")',
    outlined dense color='primary',
    :options='[ { label: $t("ui.createOrganizationDataForm.typeConsumerOption"), value: Zeus.OrganizationType.COOP }, { label: $t("ui.createOrganizationDataForm.typeProductionOption"), value: Zeus.OrganizationType.PRODCOOP }, { label: $t("ui.createOrganizationDataForm.typeLlcOption"), value: Zeus.OrganizationType.OOO }, ]',
    emit-value,
    map-options
    :readonly="readonly"
  ).q-mb-md

  q-input(
    v-model='data.represented_by.last_name',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.repLastNameLabel")',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.represented_by.first_name',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.repFirstNameLabel")',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.represented_by.middle_name',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.repMiddleNameLabel")',
    :rules='[(val) => validatePersonalName(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.represented_by.based_on',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.basisLabel")',
    :placeholder='$t("ui.createOrganizationDataForm.basisPlaceholder")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.represented_by.position',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.repPositionLabel")',
    :placeholder="$t('ui.createOrganizationDataForm.repPositionPlaceholder')",
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.phone',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.repPhoneLabel")',
    mask='+7 (###) ###-##-##',
    fill-mask,
    :rules='[(val) => notEmpty(val), (val) => notEmptyPhone(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-select(
    v-model='data.country',
    outlined dense color='primary',
    map-options,
    emit-value,
    option-label='label',
    option-value='value',
    :label='$t("ui.createOrganizationDataForm.countryLabel")',
    :options='[{ label: $t("ui.createOrganizationDataForm.russiaOptionLabel"), value: "Russia" }]',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.city',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.cityLabel")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.full_address',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.legalAddressLabel")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.fact_address',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.actualAddressLabel")',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
    template(v-slot:append)
      q-btn(
        v-if="!hideMatchButton"
        dense,
        flat,
        size='sm',
        color='primary',
        @click='data.fact_address = data.full_address'
        :disable="readonly"
      ) {{ $t('ui.createOrganizationDataForm.sameAsLegalLabel') }}

  q-input(
    v-model='data.details.inn',
    outlined dense color='primary',
    mask='############',
    :label='$t("ui.createOrganizationDataForm.innLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 10 || val.length === 12 || $t("ui.createOrganizationDataForm.innError")]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.details.ogrn',
    outlined dense color='primary',
    mask='###############',
    :label='$t("ui.createOrganizationDataForm.ogrnLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 13 || val.length === 15 || $t("ui.createOrganizationDataForm.ogrnError")]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.details.kpp',
    outlined dense color='primary',
    mask='#########',
    :label='$t("ui.createOrganizationDataForm.kppLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || $t("ui.createOrganizationDataForm.kppError")]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.bank_account.bank_name',
    outlined dense color='primary',
    :label='$t("ui.createOrganizationDataForm.bankNameLabel")',
    :placeholder="$t('ui.createOrganizationDataForm.bankNamePlaceholder')"
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.bank_account.details.corr',
    outlined dense color='primary',
    mask='####################',
    :label='$t("ui.createOrganizationDataForm.corrAccountLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || $t("ui.createOrganizationDataForm.corrAccountError")]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.bank_account.details.bik',
    outlined dense color='primary',
    mask='#########',
    :label='$t("ui.createOrganizationDataForm.bikLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || $t("ui.createOrganizationDataForm.bikError")]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.bank_account.account_number',
    outlined dense color='primary',
    mask='####################',
    :label='$t("ui.createOrganizationDataForm.accountNumberLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || $t("ui.createOrganizationDataForm.accountNumberError")]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-select(
    v-model='data.bank_account.currency',
    :label='$t("ui.createOrganizationDataForm.currencyLabel")',
    outlined dense color='primary',
    :options='[{ label: "RUB", value: "RUB" }]',
    emit-value,
    :rules='[(val) => notEmpty(val)]',
    map-options
    :readonly="readonly"
  )
</template>

<script setup lang="ts">
import {
  validatePersonalName,
  notEmpty,
  notEmptyPhone,
} from 'src/shared/lib/utils';

import { ref, onMounted, nextTick, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import type { ICreateOrganizationData } from './types';

const props = defineProps<{
  data?: ICreateOrganizationData;
  readonly?: boolean;
  hideMatchButton?: boolean;
}>();

const emit = defineEmits<{
  'update:data': [data: ICreateOrganizationData];
}>();

// Создаем локальный реактивный объект с данными
const data = ref<ICreateOrganizationData>(props.data || {
  short_name: '',
  full_name: '',
  type: Zeus.OrganizationType.COOP,
  represented_by: {
    last_name: '',
    first_name: '',
    middle_name: '',
    based_on: '',
    position: '',
  },
  phone: '',
  email: '',
  country: 'Russia',
  city: '',
  full_address: '',
  fact_address: '',
  details: {
    inn: '',
    ogrn: '',
    kpp: '',
  },
  bank_account: {
    bank_name: '',
    details: {
      corr: '',
      bik: '',
    },
    account_number: '',
    currency: 'RUB',
  },
});

const firstInput = ref<any>();

// Синхронизируем изменения props с локальными данными
watch(() => props.data, (newData) => {
  if (newData) {
    data.value = newData;
  }
}, { deep: true, immediate: true });

// Синхронизируем изменения локальных данных с родителем
watch(data, (newData) => {
  emit('update:data', newData);
}, { deep: true });

onMounted(async () => {
  await nextTick();
  firstInput.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
</script>

<style scoped>
.user-data-stack {
  display: flex;
  flex-direction: column;
  /* gap не задаём: reserve-hint-space у q-input уже даёт ~24px снизу под
     error/hint — дополнительный gap делает расстояние избыточным (канон BaseForm). */
  margin-top: var(--p-4, 16px);
}
</style>
