<template lang="pug">
q-btn(
  @click='showDialog = true',
  color='primary',
  push,
  :stretch='isMobile',
  :size='isMobile ? "sm" : "md"'
)
  i.fa-solid.fa-plus
  span.q-pl-sm(v-if='!isMobile') добавить

q-dialog(v-model='showDialog', @hide='clear')
  ModalBase(:title='"Добавить метод платежа"')
    Form.q-pa-sm(
      :handler-submit='handlerSubmit',
      :is-submitting='isSubmitting',
      :button-cancel-txt='"Отменить"',
      :button-submit-txt='"Продолжить"',
      @cancel='clear'
    )
      q-select(
        v-model='methodType',
        standout='bg-teal text-white',
        :options='methods',
        map-options,
        emit-value,
        option-label='title',
        option-value='value',
        label='Выберите способ получения платежа',
        :rules='[(val) => notEmpty(val)]'
      )

      div(v-if='methodType == "sbp"')
        q-input.q-mb-lg(
          v-model='sbp.phone',
          standout='bg-teal text-white',
          mask='+7 (###) ###-##-##',
          fill-mask,
          label='Номер телефона',
          hint='Имя и фамилия получателя должны совпадать с теми, которые указаны в Удостоверении.',
          :rules='[(val) => notEmpty(val)]',
          autocomplete='off'
        )

      div(v-if='methodType == "bank_transfer"')
        q-select(
          v-model='bank_transfer.currency',
          label='Валюта счёта',
          standout='bg-teal text-white',
          :options='[{ label: "RUB", value: "RUB" }]',
          emit-value,
          :rules='[(val) => notEmpty(val)]',
          map-options
        )
        q-input(
          v-model='bank_transfer.bank_name',
          standout='bg-teal text-white',
          label='Наименование банка',
          :rules='[(val) => notEmpty(val)]',
          autocomplete='off'
        )

        q-input(
          v-model='bank_transfer.details.corr',
          standout='bg-teal text-white',
          mask='####################',
          label='Корреспондентский счет',
          :rules='[(val) => notEmpty(val), (val) => val.length === 20 || "ожидаем 20 цифр"]',
          autocomplete='off'
        )

        q-input(
          v-model='bank_transfer.details.bik',
          standout='bg-teal text-white',
          mask='#########',
          label='БИК',
          :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "ожидаем 9 цифр"]',
          autocomplete='off'
        )

        q-input(
          v-model='bank_transfer.details.kpp',
          standout='bg-teal text-white',
          mask='#########',
          label='КПП',
          :rules='[(val) => notEmpty(val), (val) => val.length === 9 || "ожидаем 9 цифр"]',
          autocomplete='off'
        )

        q-input.q-mb-lg(
          v-model='bank_transfer.account_number',
          standout='bg-teal text-white',
          mask='####################',
          label='Номер счета',
          :rules='[(val) => notEmpty(val), (val) => val.length === 20 || "ожидаем 20 цифр"]',
          autocomplete='off',
          hint='Имя и фамилия получателя должны совпадать с теми, которые указаны в Удостоверении.'
        )
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useAddPaymentMethod } from '../model';
import { FailAlert } from 'src/shared/api';
import { ModalBase } from 'src/shared/ui/ModalBase';
import { Form } from 'src/shared/ui/Form';
import { useWindowSize } from 'src/shared/hooks';

const props = defineProps({
  username: {
    type: String,
    required: true,
  },
});

const username = computed(() => props.username);
const { isMobile } = useWindowSize();
const methodType = ref();

const methods = ref([
  {
    title: 'Система Быстрых Платежей (СБП)',
    value: 'sbp',
  },
  {
    title: 'Банковский перевод',
    value: 'bank_transfer',
  },
]);

const notEmpty = (val: any) => {
  return !!val || 'Это поле обязательно для заполнения';
};

const showDialog = ref(false);
const isSubmitting = ref(false);
const sbp = ref({ phone: '' });

const bank_transfer = ref({
  account_number: '',
  bank_name: '',
  currency: 'RUB',
  details: {
    bik: '',
    corr: '',
    kpp: '',
  },
});

const clear = (): void => {
  showDialog.value = false;
  sbp.value = { phone: '' };
  bank_transfer.value = {
    account_number: '',
    bank_name: '',
    currency: 'RUB',
    details: {
      bik: '',
      corr: '',
      kpp: '',
    },
  };
};

const { addPaymentMethod } = useAddPaymentMethod();

const handlerSubmit = async (): Promise<void> => {
  isSubmitting.value = true;
  try {
    let data = null as any;

    if (methodType.value === 'sbp') data = sbp.value;
    else if (methodType.value === 'bank_transfer') data = bank_transfer.value;

    await addPaymentMethod({
      username: username.value,
      method_id: crypto.randomUUID(), //autogenerate
      method_type: methodType.value,
      data,
    });

    showDialog.value = false;
    isSubmitting.value = false;
    clear();
  } catch (e: any) {
    showDialog.value = false;
    isSubmitting.value = false;
    FailAlert(e);
  }
};
</script>
