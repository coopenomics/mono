<template lang="pug">
.user-data-stack(v-if='userData.organization_data')
  q-input(
    ref='firstInput'
    :autofocus="!$slots.top"
    v-model='userData.organization_data.details.inn',
    outlined color='primary',
    mask='############',
    :label='$t("ui.organizationDataForm.innLabel")',
    :rules='[(val) => notEmpty(val), (val) => val.length === 10 || val.length === 12 || $t("ui.organizationDataForm.innError")]',
    :hint='innHint',
    :loading='loading',
    :readonly='isLocked("inn")',
    autocomplete='off'
  )
    template(v-if='lookupState === "found"', v-slot:append)
      q-btn(
        dense,
        flat,
        size='sm',
        color='primary',
        @click='resetLookup'
      ) {{ $t('ui.organizationDataForm.lookupChangeInn') }}

  template(v-if='showRest')
    q-input(
      v-model='userData.organization_data.short_name',
      :readonly='isLocked("short_name")',
      outlined color='primary',
      :label='$t("ui.organizationDataForm.shortNameLabel")',
      :placeholder='$t("ui.organizationDataForm.shortNamePlaceholder")',
      :rules='[(val) => notEmpty(val)]',
      autocomplete='off'
    )

    q-input(
      v-model='userData.organization_data.full_name',
      :readonly='isLocked("full_name")',
      outlined color='primary',
      :label='$t("ui.organizationDataForm.fullNameLabel")',
      :placeholder='$t("ui.organizationDataForm.fullNamePlaceholder")',
      :rules='[(val) => notEmpty(val)]',
      autocomplete='off'
    )

    q-select(
      v-model='userData.organization_data.type',
      :readonly='isLocked("type")',
      :label='$t("ui.organizationDataForm.typeLabel")',
      outlined color='primary',
      :options='[ { label: $t("ui.organizationDataForm.typeConsumerOption"), value: Zeus.OrganizationType.COOP }, { label: $t("ui.organizationDataForm.typeProductionOption"), value: Zeus.OrganizationType.PRODCOOP }, { label: $t("ui.organizationDataForm.typeLlcOption"), value: Zeus.OrganizationType.OOO }, ]',
      emit-value,
      map-options
    ).q-mb-md

    q-input(
      v-model='userData.organization_data.represented_by.last_name',
      :readonly='isLocked("last_name")',
      outlined color='primary',
      :label='$t("ui.organizationDataForm.repLastNameLabel")',
      :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
      autocomplete='off'
    )
    q-input(
      v-model='userData.organization_data.represented_by.first_name',
      :readonly='isLocked("first_name")',
      outlined color='primary',
      :label='$t("ui.organizationDataForm.repFirstNameLabel")',
      :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
      autocomplete='off'
    )
    q-input(
      v-model='userData.organization_data.represented_by.middle_name',
      :readonly='isLocked("middle_name")',
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
      :readonly='isLocked("position")',
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
      :readonly='isLocked("city")',
      outlined color='primary',
      :label='$t("ui.organizationDataForm.cityLabel")',
      :rules='[(val) => notEmpty(val)]',
      autocomplete='off'
    )
    q-input(
      v-model='userData.organization_data.full_address',
      :readonly='isLocked("full_address")',
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
      v-model='userData.organization_data.details.ogrn',
      :readonly='isLocked("ogrn")',
      outlined color='primary',
      mask='###############',
      :label='$t("ui.organizationDataForm.ogrnLabel")',
      :rules='[(val) => notEmpty(val), (val) => val.length === 13 || val.length === 15 || $t("ui.organizationDataForm.ogrnError")]',
      autocomplete='off'
    )

    q-input(
      v-model='userData.organization_data.details.kpp',
      :readonly='isLocked("kpp")',
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
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { t } from 'src/shared/i18n';
import { useOrganizationLookup, type IOrganizationLookupResult } from './useOrganizationLookup';

const props = defineProps<{ userData: IUserData }>();
const emit = defineEmits<{
  /** Раскрыта ли анкета: пока ИНН не введён в режиме поиска по реестру, видно только его поле. */
  detailsShown: [shown: boolean];
}>();

const userData = ref<IUserData>(props.userData);
const firstInput = ref<any>();

/** Поля анкеты, которые заполняет реестр страны. */
type LookupField =
  | 'inn'
  | 'short_name'
  | 'full_name'
  | 'type'
  | 'last_name'
  | 'first_name'
  | 'middle_name'
  | 'position'
  | 'city'
  | 'full_address'
  | 'ogrn'
  | 'kpp';

/**
 * Анкета по ИНН: если для страны анкеты есть коннектор реестра, пайщик
 * вводит ИНН, а найденные сведения ложатся в поля и закрываются для правки.
 * Пока поиска не было, прочие поля скрыты. Нет коннектора или сведений —
 * анкета заполняется вручную.
 */
const { countries, loading, loadCountries, lookup } = useOrganizationLookup();
const countriesLoaded = ref(false);
// manual — анкета вернулась с введённым ИНН: поиска в этот раз не было.
const lookupState = ref<'idle' | 'found' | 'notFound' | 'manual'>('idle');
const lockedFields = ref<LookupField[]>([]);

const lookupAvailable = computed(() =>
  countries.value.includes(userData.value.organization_data?.country ?? ''),
);

// До ответа о странах видно только поле ИНН: иначе ручная анкета мелькнула бы
// и спряталась. Анкета, вернувшаяся с уже введённым ИНН, открыта целиком.
const showRest = computed(
  () => countriesLoaded.value && (!lookupAvailable.value || lookupState.value !== 'idle'),
);

watch(showRest, (shown) => emit('detailsShown', shown), { immediate: true });

const innHint = computed(() =>
  lookupAvailable.value && lookupState.value === 'notFound'
    ? t('ui.organizationDataForm.lookupNotFound')
    : undefined,
);

const isLocked = (field: LookupField) => lockedFields.value.includes(field);

const applyLookup = (found: IOrganizationLookupResult) => {
  const org = userData.value.organization_data;
  if (!org) return;
  const locked: LookupField[] = ['inn'];
  const fill = (field: LookupField, value: string | null | undefined, set: (v: string) => void) => {
    if (!value) return;
    set(value);
    locked.push(field);
  };

  fill('short_name', found.short_name, (v) => (org.short_name = v));
  fill('full_name', found.full_name, (v) => (org.full_name = v));
  fill('type', found.type, (v) => (org.type = v as Zeus.OrganizationType));
  fill('last_name', found.represented_by?.last_name, (v) => (org.represented_by.last_name = v));
  fill('first_name', found.represented_by?.first_name, (v) => (org.represented_by.first_name = v));
  fill('middle_name', found.represented_by?.middle_name, (v) => (org.represented_by.middle_name = v));
  fill('position', found.represented_by?.position, (v) => (org.represented_by.position = v));
  fill('city', found.city, (v) => (org.city = v));
  fill('full_address', found.full_address, (v) => (org.full_address = v));
  fill('ogrn', found.details.ogrn, (v) => (org.details.ogrn = v));
  fill('kpp', found.details.kpp, (v) => (org.details.kpp = v));

  lockedFields.value = locked;
};

const runLookup = async (inn: string) => {
  const org = userData.value.organization_data;
  if (!org) return;
  const found = await lookup({ country: org.country, inn });
  // Пока шёл запрос, ИНН могли поменять — ответ уже не про эту организацию.
  if (org.details.inn !== inn) return;
  if (found) {
    applyLookup(found);
    lookupState.value = 'found';
  } else {
    lookupState.value = 'notFound';
  }
};

/** «Другой ИНН»: снять сведения прежней организации и вернуться к вводу ИНН. */
const resetLookup = () => {
  const org = userData.value.organization_data;
  if (!org) return;
  for (const field of lockedFields.value) {
    switch (field) {
      case 'inn':
        org.details.inn = '';
        break;
      case 'ogrn':
        org.details.ogrn = '';
        break;
      case 'kpp':
        org.details.kpp = '';
        break;
      case 'type':
        org.type = Zeus.OrganizationType.COOP;
        break;
      case 'last_name':
      case 'first_name':
      case 'middle_name':
      case 'position':
        org.represented_by[field] = '';
        break;
      default:
        org[field] = '';
    }
  }
  lockedFields.value = [];
  lookupState.value = 'idle';
};

watch(
  () => userData.value.organization_data?.details.inn,
  (inn) => {
    if (!lookupAvailable.value || lookupState.value === 'found' || !inn) return;
    if (inn.length === 10 || inn.length === 12) runLookup(inn);
  },
);

onMounted(async () => {
  await loadCountries();
  if (userData.value.organization_data?.details.inn) lookupState.value = 'manual';
  countriesLoaded.value = true;
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
