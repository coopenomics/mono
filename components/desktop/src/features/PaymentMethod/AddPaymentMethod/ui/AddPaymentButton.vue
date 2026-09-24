<template lang="pug">
q-btn(
  @click='showDialog = true',
  :color='micro ? "accent" : "primary"',
  :flat='micro',
  :dense='micro',
  :size='micro ? "sm" : undefined',
  no-wrap
)
  q-icon(name='fa-solid fa-plus')
  span.q-ml-sm(v-if='!micro') {{ $t('common.action.add') }}
  q-tooltip(v-if='micro') {{ $t('paymentMethod.addPaymentButton.buttonLabel') }}

BaseDialog(
  v-model='showDialog',
  :title='$t("paymentMethod.addPaymentButton.title")',
  size='lg',
  @update:model-value='(v) => !v && clear()'
)
  Form(
    :handler-submit='handlerSubmit',
    :is-submitting='isSubmitting',
    :button-cancel-txt='$t("paymentMethod.addPaymentButton.cancel")',
    :button-submit-txt='$t("paymentMethod.addPaymentButton.submit")',
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
      :label='$t("paymentMethod.addPaymentButton.methodLabel")',
      :rules='[(val) => notEmpty(val)]'
    )

    div(v-if='methodType == "sbp"')
      q-input.q-mb-lg(
        v-model='sbp.phone',
        standout='bg-teal text-white',
        mask='+7 (###) ###-##-##',
        fill-mask,
        :label='$t("paymentMethod.addPaymentButton.phoneLabel")',
        :hint='$t("paymentMethod.addPaymentButton.recipientNameHint")',
        :rules='[(val) => notEmpty(val)]',
        autocomplete='off'
      )

    div(v-if='methodType == "bank_transfer"')
      q-select(
        v-model='bank_transfer.currency',
        :label='$t("paymentMethod.addPaymentButton.currencyLabel")',
        standout='bg-teal text-white',
        :options='[{ label: "RUB", value: "RUB" }]',
        emit-value,
        :rules='[(val) => notEmpty(val)]',
        map-options
      )
      q-input(
        v-model='bank_transfer.bank_name',
        standout='bg-teal text-white',
        :label='$t("paymentMethod.addPaymentButton.bankNameLabel")',
        :rules='[(val) => notEmpty(val)]',
        autocomplete='off'
      )

      q-input(
        v-model='bank_transfer.details.corr',
        standout='bg-teal text-white',
        mask='####################',
        :label='$t("paymentMethod.addPaymentButton.correspondentAccountLabel")',
        :rules='[(val) => notEmpty(val), (val) => val.length === 20 || $t("paymentMethod.addPaymentButton.expect20DigitsError")]',
        autocomplete='off'
      )

      q-input(
        v-model='bank_transfer.details.bik',
        standout='bg-teal text-white',
        mask='#########',
        :label='$t("paymentMethod.addPaymentButton.bikLabel")',
        :rules='[(val) => notEmpty(val), (val) => val.length === 9 || $t("paymentMethod.addPaymentButton.expect9DigitsError")]',
        autocomplete='off'
      )

      q-input.q-mb-lg(
        v-model='bank_transfer.account_number',
        standout='bg-teal text-white',
        mask='####################',
        :label='$t("paymentMethod.addPaymentButton.accountNumberLabel")',
        :rules='[(val) => notEmpty(val), (val) => val.length === 20 || $t("paymentMethod.addPaymentButton.expect20DigitsError")]',
        autocomplete='off',
        :hint='$t("paymentMethod.addPaymentButton.recipientNameHint")'
      )
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useAddPaymentMethod } from '../model';
import { FailAlert } from 'src/shared/api';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { t } from 'src/shared/i18n';

const props = defineProps({
  username: {
    type: String,
    required: true,
  },
  micro: {
    type: Boolean,
    default: false,
  },
});

const username = computed(() => props.username);
const methodType = ref();

const methods = ref([
  {
    title: t('paymentMethod.addPaymentButton.methodSbp'),
    value: 'sbp',
  },
  {
    title: t('paymentMethod.addPaymentButton.methodBankTransfer'),
    value: 'bank_transfer',
  },
]);

const notEmpty = (val: any) => {
  return !!val || t('paymentMethod.addPaymentButton.requiredFieldError');
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
    },
  };
};

const { addPaymentMethod } = useAddPaymentMethod();

const handlerSubmit = async (): Promise<void> => {
  isSubmitting.value = true;
  try {
    const paymentData: any = {
      username: username.value,
      is_default: false,
    };

    if (methodType.value === 'sbp') {
      paymentData.sbp_data = sbp.value;
    } else if (methodType.value === 'bank_transfer') {
      paymentData.bank_transfer_data = bank_transfer.value;
    }

    await addPaymentMethod(paymentData);

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
