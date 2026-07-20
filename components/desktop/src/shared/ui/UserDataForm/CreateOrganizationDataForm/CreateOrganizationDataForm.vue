<template lang="pug">
.user-data-stack(v-if="data")
  slot(name="top")

  q-input(
    ref='firstInput'
    :autofocus="!$slots.top"
    v-model='data.short_name',
    outlined dense color='primary',
    label='Краткое наименование организации',
    placeholder='ПК "Ромашка"',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.full_name',
    outlined dense color='primary',
    label='Полное наименование организации',
    placeholder='Потребительский Кооператив "Ромашка"',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-select(
    v-model='data.type',
    label='Выберите тип организации',
    outlined dense color='primary',
    :options='[ { label: "Потребительский Кооператив", value: Zeus.OrganizationType.COOP }, { label: "Производственный Кооператив", value: Zeus.OrganizationType.PRODCOOP }, { label: "ООО", value: Zeus.OrganizationType.OOO }, ]',
    emit-value,
    map-options
    :readonly="readonly"
  ).q-mb-md

  q-input(
    v-model='data.represented_by.last_name',
    outlined dense color='primary',
    label='Фамилия представителя',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.represented_by.first_name',
    outlined dense color='primary',
    label='Имя представителя',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.represented_by.middle_name',
    outlined dense color='primary',
    label='Отчество представителя',
    :rules='[(val) => validatePersonalName(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.represented_by.based_on',
    outlined dense color='primary',
    label='Представитель действует на основании',
    placeholder='решения общего собрания №... от ... г',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.represented_by.position',
    outlined dense color='primary',
    label='Должность представителя',
    placeholder="Председатель совета",
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.phone',
    outlined dense color='primary',
    label='Номер телефона представителя',
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
    label='Страна',
    :options='[{ label: "Россия", value: "Russia" }]',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.city',
    outlined dense color='primary',
    label='Город',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.full_address',
    outlined dense color='primary',
    label='Юридический адрес регистрации',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.fact_address',
    outlined dense color='primary',
    label='Фактический адрес',
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
      ) совпадает

  q-input(
    v-model='data.details.inn',
    outlined dense color='primary',
    mask='############',
    label='ИНН организации (10 или 12 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 10 || val.length === 12 || "ИНН должен содержать 10 или 12 цифр"]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.details.ogrn',
    outlined dense color='primary',
    mask='###############',
    label='ОГРН организации (13 или 15 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 13 || val.length === 15 || "ОГРН должен содержать 13 или 15 цифр"]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.details.kpp',
    outlined dense color='primary',
    mask='#########',
    label='КПП организации (9 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "КПП должен содержать 9 цифр"]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.bank_account.bank_name',
    outlined dense color='primary',
    label='Наименование банка',
    placeholder="ПАО Сбербанк"
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.bank_account.details.corr',
    outlined dense color='primary',
    mask='####################',
    label='Корреспондентский счет (20 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || "Корреспондентский счет должен содержать 20 цифр"]',
    autocomplete='off'
    :readonly="readonly"
  )
  q-input(
    v-model='data.bank_account.details.bik',
    outlined dense color='primary',
    mask='#########',
    label='БИК (9 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "БИК должен содержать 9 цифр"]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-input(
    v-model='data.bank_account.account_number',
    outlined dense color='primary',
    mask='####################',
    label='Номер счета (20 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || "Номер счета должен содержать 20 цифр"]',
    autocomplete='off'
    :readonly="readonly"
  )

  q-select(
    v-model='data.bank_account.currency',
    label='Валюта счёта',
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
