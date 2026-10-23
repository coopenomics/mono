<template lang="pug">
.user-data-stack(v-if="userData.entrepreneur_data")
  q-input(
    ref="firstInput"
    autofocus
    v-model="userData.entrepreneur_data.details.inn"
    outlined color="primary"
    mask="############"
    :label="$t('ui.entrepreneurDataForm.innLabel')"
    :rules="[val => notEmpty(val), val => (val.length === 10 || val.length === 12) || $t('ui.entrepreneurDataForm.innError')]"
    :hint="innHint"
    :loading="loading"
    :readonly="isLocked('inn')"
    autocomplete="off"
  )
    template(v-if="lookupState === 'found'", v-slot:append)
      q-btn(
        dense,
        flat,
        size="sm",
        color="primary",
        @click="resetLookup"
      ) {{ $t('ui.registryLookup.changeInn') }}

  template(v-if="showRest")
    q-input(v-model="userData.entrepreneur_data.last_name" :readonly="isLocked('last_name')" outlined color="primary" :label="$t('ui.entrepreneurDataForm.lastNameLabel')" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
    q-input(v-model="userData.entrepreneur_data.first_name" :readonly="isLocked('first_name')" outlined color="primary" :label="$t('ui.entrepreneurDataForm.firstNameLabel')" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
    q-input(v-model="userData.entrepreneur_data.middle_name" :readonly="isLocked('middle_name')" outlined color="primary" :label="$t('ui.entrepreneurDataForm.middleNameLabel')" :rules="[val => validatePersonalName(val)]" autocomplete="off")

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

    q-input(v-model="userData.entrepreneur_data.city" :readonly="isLocked('city')" outlined color="primary" :label="$t('ui.entrepreneurDataForm.cityLabel')" :rules="[val => notEmpty(val)]" autocomplete="off")
    q-input(v-model="userData.entrepreneur_data.full_address" outlined color="primary" :label="$t('ui.entrepreneurDataForm.addressLabel')" :rules="[val => notEmpty(val)]" autocomplete="off")

    q-input(
      v-model="userData.entrepreneur_data.details.ogrn"
      :readonly="isLocked('ogrn')"
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
import { useRegistryLookup, lookupEntrepreneur, type IEntrepreneurLookupResult } from '../useRegistryLookup';

const props = defineProps<{ userData: IUserData }>();
const emit = defineEmits<{
  /** Раскрыта ли анкета: пока ИНН не введён в режиме поиска по реестру, видно только его поле. */
  detailsShown: [shown: boolean];
}>();

const userData = ref<IUserData>(props.userData);
const firstInput = ref<any>();

/**
 * Поля анкеты ИП, которые заполняет реестр страны. Адреса среди них нет:
 * реестр ИП публикует только город, полный адрес пайщик вводит сам.
 */
type LookupField = 'last_name' | 'first_name' | 'middle_name' | 'city' | 'ogrn';

const { loading, lookupState, showRest, innHint, isLocked, resetLookup } = useRegistryLookup<
  IEntrepreneurLookupResult,
  LookupField
>({
  country: () => userData.value.entrepreneur_data?.country,
  inn: () => userData.value.entrepreneur_data?.details.inn,
  find: lookupEntrepreneur,
  onDetailsShown: (shown) => emit('detailsShown', shown),
  apply: (found) => {
    const ip = userData.value.entrepreneur_data;
    const filled: LookupField[] = [];
    if (!ip) return filled;
    const fill = (field: LookupField, value: string | null | undefined, set: (v: string) => void) => {
      if (!value) return;
      set(value);
      filled.push(field);
    };

    fill('last_name', found.last_name, (v) => (ip.last_name = v));
    fill('first_name', found.first_name, (v) => (ip.first_name = v));
    fill('middle_name', found.middle_name, (v) => (ip.middle_name = v));
    fill('city', found.city, (v) => (ip.city = v));
    fill('ogrn', found.details.ogrn, (v) => (ip.details.ogrn = v));
    return filled;
  },
  clear: (fields) => {
    const ip = userData.value.entrepreneur_data;
    if (!ip) return;
    ip.details.inn = '';
    for (const field of fields) {
      if (field === 'ogrn') ip.details.ogrn = '';
      else ip[field] = '';
    }
  },
});

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
