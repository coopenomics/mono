<template lang="pug">
.user-data-stack(v-if="userData.entrepreneur_data")
  q-input(ref="firstInput" autofocus v-model="userData.entrepreneur_data.last_name" outlined color="primary" :label="$t('ui.entrepreneurDataForm.lastNameLabel')" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
  q-input(v-model="userData.entrepreneur_data.first_name" outlined color="primary" :label="$t('ui.entrepreneurDataForm.firstNameLabel')" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
  q-input(v-model="userData.entrepreneur_data.middle_name" outlined color="primary" :label="$t('ui.entrepreneurDataForm.middleNameLabel')" :rules="[val => validatePersonalName(val)]" autocomplete="off")

  q-input(
    outlined color="primary"
    v-model="userData.entrepreneur_data.birthdate"
    mask="date"
    :label="$t('ui.entrepreneurDataForm.birthDateLabel')"
    :rules="['date', val => notEmpty(val)]"
    autocomplete="off"
  )
    template(v-slot:append)
      q-icon(name="event" class="cursor-pointer")
        q-popup-proxy(cover transition-show="scale" transition-hide="scale")
          q-date(v-model="userData.entrepreneur_data.birthdate")
            .row.items-center.justify-end
              q-btn(v-close-popup label="Close" color="primary" flat)

  q-input(v-model="userData.entrepreneur_data.phone" outlined color="primary" mask="+7 (###) ###-##-##" fill-mask :label="$t('ui.entrepreneurDataForm.phoneLabel')" :rules="[val => notEmpty(val), val => notEmptyPhone(val)]" autocomplete="off")

  q-select(v-model="userData.entrepreneur_data.country" outlined color="primary" map-options emit-value option-label="label" option-value="value" :label="$t('ui.entrepreneurDataForm.countryLabel')" :options="[{ label: $t('ui.entrepreneurDataForm.russiaOptionLabel'), value: 'Russia' }]" :rules="[val => notEmpty(val)]" autocomplete="off")

  q-input(v-model="userData.entrepreneur_data.city" outlined color="primary" :label="$t('ui.entrepreneurDataForm.cityLabel')" :rules="[val => notEmpty(val)]" autocomplete="off")
  q-input(v-model="userData.entrepreneur_data.full_address" outlined color="primary" :label="$t('ui.entrepreneurDataForm.addressLabel')" :rules="[val => notEmpty(val)]" autocomplete="off")

  q-input(
    v-model="userData.entrepreneur_data.details.inn"
    outlined color="primary"
    mask="############"
    :label="$t('ui.entrepreneurDataForm.innLabel')"
    :rules="[val => notEmpty(val), val => (val.length === 10 || val.length === 12) || $t('ui.entrepreneurDataForm.innError')]"
    autocomplete="off"
  )
  q-input(
    v-model="userData.entrepreneur_data.details.ogrn"
    outlined color="primary"
    mask="###############"
    :label="$t('ui.entrepreneurDataForm.ogrnipLabel')"
    :rules="[val => notEmpty(val), val => (val.length === 13 || val.length === 15) || $t('ui.entrepreneurDataForm.ogrnipError')]"
    autocomplete="off"
  )

  q-input(
    v-model="userData.entrepreneur_data.bank_account.bank_name"
    outlined color="primary"
    :label="$t('ui.entrepreneurDataForm.bankNameLabel')"
    :placeholder='$t("ui.entrepreneurDataForm.bankNamePlaceholder")'
    :rules="[val => notEmpty(val)]"
    autocomplete="off"
  )

  q-input(
    v-model="userData.entrepreneur_data.bank_account.details.corr"
    outlined color="primary"
    mask="####################"
    :label="$t('ui.entrepreneurDataForm.corrAccountLabel')"
    :rules="[val => notEmpty(val), val => val.length === 20 || $t('ui.entrepreneurDataForm.corrAccountError')]"
    autocomplete="off"
  )

  q-input(
    v-model="userData.entrepreneur_data.bank_account.details.bik"
    outlined color="primary"
    mask="#########"
    :label="$t('ui.entrepreneurDataForm.bikLabel')"
    :rules="[val => notEmpty(val), val => val.length === 9 || $t('ui.entrepreneurDataForm.bikError')]"
  )

  q-select(v-model="userData.entrepreneur_data.bank_account.currency"
    :label="$t('ui.entrepreneurDataForm.currencyLabel')"
    outlined color="primary"
    :options="[{ label: 'RUB', value: 'RUB' }]"
    emit-value
    map-options
  )

  q-input(
    v-model="userData.entrepreneur_data.bank_account.account_number"
    outlined color="primary"
    mask="####################"
    :label="$t('ui.entrepreneurDataForm.accountNumberLabel')"
    :rules="[val => notEmpty(val), val => val.length === 20 || $t('ui.entrepreneurDataForm.accountNumberError')]"
    autocomplete="off"
  )
</template>
<script setup lang="ts">
import { validatePersonalName, notEmpty, notEmptyPhone } from 'src/shared/lib/utils';

import type { IUserData } from 'src/shared/lib/types/user/IUserData';
import { ref, onMounted, nextTick } from 'vue';

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
