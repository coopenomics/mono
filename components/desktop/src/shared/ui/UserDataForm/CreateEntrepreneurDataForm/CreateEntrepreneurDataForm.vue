<template lang="pug">
.user-data-stack
  q-input(ref="firstInput" autofocus v-model="data.last_name" outlined color="primary" :label="$t('ui.createEntrepreneurDataForm.lastNameLabel')" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
  q-input(v-model="data.first_name" outlined color="primary" :label="$t('ui.createEntrepreneurDataForm.firstNameLabel')" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
  q-input(v-model="data.middle_name" outlined color="primary" :label="$t('ui.createEntrepreneurDataForm.middleNameLabel')" :rules="[val => validatePersonalName(val)]" autocomplete="off")

  q-input(
    outlined color="primary"
    v-model="data.birthdate"
    mask="date"
    :label="$t('ui.createEntrepreneurDataForm.birthDateLabel')"
    :rules="['date', val => notEmpty(val)]"
    autocomplete="off"
  )
    template(v-slot:append)
      q-icon(name="event" class="cursor-pointer")
        q-popup-proxy(cover transition-show="scale" transition-hide="scale")
          q-date(v-model="data.birthdate")
            .row.items-center.justify-end
              q-btn(v-close-popup label="Close" color="primary" flat)

  q-input(v-model="data.phone" outlined color="primary" mask="+7 (###) ###-##-##" fill-mask :label="$t('ui.createEntrepreneurDataForm.phoneLabel')" :rules="[val => notEmpty(val), val => notEmptyPhone(val)]" autocomplete="off")

  q-select(v-model="data.country" outlined color="primary" map-options emit-value option-label="label" option-value="value" :label="$t('ui.createEntrepreneurDataForm.countryLabel')" :options="[{ label: $t('ui.createEntrepreneurDataForm.russiaOptionLabel'), value: 'Russia' }]" :rules="[val => notEmpty(val)]" autocomplete="off")

  q-input(v-model="data.city" outlined color="primary" :label="$t('ui.createEntrepreneurDataForm.cityLabel')" :rules="[val => notEmpty(val)]" autocomplete="off")
  q-input(v-model="data.full_address" outlined color="primary" :label="$t('ui.createEntrepreneurDataForm.addressLabel')" :rules="[val => notEmpty(val)]" autocomplete="off")

  q-input(
    v-model="data.details.inn"
    outlined color="primary"
    mask="############"
    :label="$t('ui.createEntrepreneurDataForm.innLabel')"
    :rules="[val => notEmpty(val), val => (val.length === 10 || val.length === 12) || $t('ui.createEntrepreneurDataForm.innError')]"
    autocomplete="off"
  )
  q-input(
    v-model="data.details.ogrn"
    outlined color="primary"
    mask="###############"
    :label="$t('ui.createEntrepreneurDataForm.ogrnipLabel')"
    :rules="[val => notEmpty(val), val => (val.length === 13 || val.length === 15) || $t('ui.createEntrepreneurDataForm.ogrnipError')]"
    autocomplete="off"
  )

  q-input(
    v-model="data.bank_account.bank_name"
    outlined color="primary"
    :label="$t('ui.createEntrepreneurDataForm.bankNameLabel')"
    :rules="[val => notEmpty(val)]"
    autocomplete="off"
  )

  q-input(
    v-model="data.bank_account.details.corr"
    outlined color="primary"
    mask="####################"
    :label="$t('ui.createEntrepreneurDataForm.corrAccountLabel')"
    :rules="[val => notEmpty(val), val => val.length === 20 || $t('ui.createEntrepreneurDataForm.corrAccountError')]"
    autocomplete="off"
  )

  q-input(
    v-model="data.bank_account.details.bik"
    outlined color="primary"
    mask="#########"
    :label="$t('ui.createEntrepreneurDataForm.bikLabel')"
    :rules="[val => notEmpty(val), val => val.length === 9 || $t('ui.createEntrepreneurDataForm.bikError')]"
  )

  q-select(v-model="data.bank_account.currency"
    :label="$t('ui.createEntrepreneurDataForm.currencyLabel')"
    outlined color="primary"
    :options="[{ label: 'RUB', value: 'RUB' }]"
    emit-value
    map-options
  )

  q-input(
    v-model="data.bank_account.account_number"
    outlined color="primary"
    mask="####################"
    :label="$t('ui.createEntrepreneurDataForm.accountNumberLabel')"
    :rules="[val => notEmpty(val), val => val.length === 20 || $t('ui.createEntrepreneurDataForm.accountNumberError')]"
    autocomplete="off"
  )
</template>

<script setup lang="ts">
import { validatePersonalName, notEmpty, notEmptyPhone } from 'src/shared/lib/utils';
import { ref, onMounted, nextTick } from 'vue';
import type { ICreateEntrepreneurData } from './types';

const props = defineProps<{
  data: ICreateEntrepreneurData;
  readonly?: boolean;
}>();

defineEmits<{
  'update:data': [data: ICreateEntrepreneurData];
}>();

const data = ref<ICreateEntrepreneurData>(props.data);
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
