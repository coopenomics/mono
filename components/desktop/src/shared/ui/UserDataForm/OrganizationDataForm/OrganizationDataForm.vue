<template lang="pug">
.user-data-stack(v-if='userData.organization_data')
  q-input(
    ref='firstInput'
    :autofocus="!$slots.top"
    v-model='userData.organization_data.short_name',
    outlined color='primary',
    label='Краткое наименование организации',
    placeholder='ПК "Ромашка"',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.full_name',
    outlined color='primary',
    label='Полное наименование организации',
    placeholder='Потребительский Кооператив "Ромашка"',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-select(
    v-model='userData.organization_data.type',
    label='Выберите тип организации',
    outlined color='primary',
    :options='[ { label: "Потребительский Кооператив", value: Zeus.OrganizationType.COOP }, { label: "Производственный Кооператив", value: Zeus.OrganizationType.PRODCOOP }, { label: "ООО", value: Zeus.OrganizationType.OOO }, ]',
    emit-value,
    map-options
  ).q-mb-md

  q-input(
    v-model='userData.organization_data.represented_by.last_name',
    outlined color='primary',
    label='Фамилия представителя',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.first_name',
    outlined color='primary',
    label='Имя представителя',
    :rules='[(val) => notEmpty(val), (val) => validatePersonalName(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.middle_name',
    outlined color='primary',
    label='Отчество представителя',
    :rules='[(val) => validatePersonalName(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.represented_by.based_on',
    outlined color='primary',
    label='Представитель действует на основании',
    placeholder='решения общего собрания №... от ... г',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.represented_by.position',
    outlined color='primary',
    label='Должность представителя',
    placeholder='Председатель совета',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.phone',
    outlined color='primary',
    label='Номер телефона представителя',
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
    label='Страна',
    :options='[{ label: "Россия", value: "Russia" }]',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.city',
    outlined color='primary',
    label='Город',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.full_address',
    outlined color='primary',
    label='Юридический адрес регистрации',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.fact_address',
    outlined color='primary',
    label='Фактический адрес',
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
      ) совпадает

  q-input(
    v-model='userData.organization_data.details.inn',
    outlined color='primary',
    mask='############',
    label='ИНН организации (10 или 12 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 10 || val.length === 12 || "ИНН должен содержать 10 или 12 цифр"]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.details.ogrn',
    outlined color='primary',
    mask='###############',
    label='ОГРН организации (13 или 15 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 13 || val.length === 15 || "ОГРН должен содержать 13 или 15 цифр"]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.details.kpp',
    outlined color='primary',
    mask='#########',
    label='КПП организации (9 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "КПП должен содержать 9 цифр"]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.bank_name',
    outlined color='primary',
    label='Наименование банка',
    placeholder='ПАО "Сбербанк"',
    :rules='[(val) => notEmpty(val)]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.details.corr',
    outlined color='primary',
    mask='####################',
    label='Корреспондентский счет (20 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || "Корреспондентский счет должен содержать 20 цифр"]',
    autocomplete='off'
  )
  q-input(
    v-model='userData.organization_data.bank_account.details.bik',
    outlined color='primary',
    mask='#########',
    label='БИК (9 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "БИК должен содержать 9 цифр"]',
    autocomplete='off'
  )

  q-input(
    v-model='userData.organization_data.bank_account.account_number',
    outlined color='primary',
    mask='####################',
    label='Номер счета (20 цифр)',
    :rules='[(val) => notEmpty(val), (val) => val.length === 20 || "Номер счета должен содержать 20 цифр"]',
    autocomplete='off'
  )

  q-select(
    v-model='userData.organization_data.bank_account.currency',
    label='Валюта счёта',
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
