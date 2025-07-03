<template lang="pug">
.q-gutter-sm.q-mt-md(v-if='userData.organization_data')
  q-select.q-mb-md(
    v-model='userData.organization_data.type',
    label='Выберите тип организации',
    standout='bg-teal text-white',
    :options='[ { label: "Потребительский Кооператив", value: Zeus.OrganizationType.COOP }, { label: "Производственный Кооператив", value: Zeus.OrganizationType.PRODCOOP }, { label: "ООО", value: Zeus.OrganizationType.OOO }, ]',
    emit-value,
    map-options
  )

  q-input(
    v-model='userData.organization_data.short_name',
    standout='bg-teal text-white',
    hint='ПК Ромашка',
    label='Краткое наименование организации',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.full_name',
    standout='bg-teal text-white',
    hint='Потребительский Кооператив \'Ромашка\'',
    label='Полное наименование организации',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.last_name',
    standout='bg-teal text-white',
    label='Фамилия представителя',
    hint='',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.first_name',
    standout='bg-teal text-white',
    label='Имя представителя',
    hint='',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.middle_name',
    standout='bg-teal text-white',
    label='Отчество представителя',
    hint='',
    :rules='[(val) => validatePersonalName(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.represented_by.based_on',
    standout='bg-teal text-white',
    label='Представитель действует на основании',
    hint='решения общего собрания №102 от 01.01.2025 г',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.position',
    standout='bg-teal text-white',
    label='Должность представителя',
    hint='председатель совета',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.phone',
    standout='bg-teal text-white',
    label='Номер телефона представителя',
    mask='+7 (###) ###-##-##',
    fill-mask,
    hint='',
    :rules='[(val) => notEmpty(val), (val) => notEmptyPhone(val)]',
    autocomplete='off'
  )

  q-select(
    v-model='userData.organization_data.country',
    standout='bg-teal text-white',
    map-options,
    emit-value,
    option-label='label',
    option-value='value',
    label='Страна',
    :options='[{ label: "Россия", value: "Russia" }]',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.city',
    standout='bg-teal text-white',
    label='Город',
    hint='',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.full_address',
    standout='bg-teal text-white',
    hint='',
    label='Юридический адрес регистрации',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.fact_address',
    standout='bg-teal text-white',
    hint='',
    label='Фактический адрес',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
    template(v-slot:append)
      q-btn(
        dense,
        size='sm',
        color='teal',
        @click='userData.organization_data.fact_address = userData.organization_data.full_address'
      ) совпадает

  q-input(
    v-model='userData.organization_data.details.inn',
    standout='bg-teal text-white',
    mask='############',
    label='ИНН организации',
    hint='10 или 12 цифр',
    :rules='[(val) => notEmpty(val), (val) => val.length === 10 || val.length === 12 || "ИНН должен содержать 10 или 12 цифр"]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.details.ogrn',
    standout='bg-teal text-white',
    mask='###############',
    label='ОГРН организации',
    hint='13 или 15 цифр',
    :rules='[(val) => notEmpty(val), (val) => val.length === 13 || val.length === 15 || "ОГРН должен содержать 13 или 15 цифр"]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.details.kpp',
    standout='bg-teal text-white',
    mask='#########',
    label='КПП организации',
    hint='9 цифр',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "КПП должен содержать 9 цифр"]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.bank_name',
    standout='bg-teal text-white',
    label='Наименование банка',
    hint='ПАО Сбербанк',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.details.corr',
    standout='bg-teal text-white',
    mask='####################',
    label='Корреспондентский счет',
    hint='20 цифр',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || "Корреспондентский счет должен содержать 20 цифр"]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.bank_account.details.bik',
    standout='bg-teal text-white',
    mask='#########',
    label='БИК',
    hint='9 цифр',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "БИК должен содержать 9 цифр"]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.details.kpp',
    standout='bg-teal text-white',
    mask='#########',
    label='КПП (банка)',
    hint='9 цифр',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "КПП должен содержать 9 цифр"]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.account_number',
    standout='bg-teal text-white',
    mask='####################',
    label='Номер счета',
    hint='20 цифр',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || "Номер счета должен содержать 20 цифр"]',
    autocomplete='off'
  )

  q-select(
    v-model='userData.organization_data.bank_account.currency',
    label='Валюта счёта',
    standout='bg-teal text-white',
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
import { ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';

const props = defineProps<{ userData: IUserData }>();

const userData = ref<IUserData>(props.userData);
</script>
