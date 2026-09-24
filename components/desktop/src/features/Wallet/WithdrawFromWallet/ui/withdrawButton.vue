<template lang="pug">
q-btn(
  v-if='walletStore.isWalletAgreementSigned',
  @click='showDialog = true',
  :color='micro ? "accent" : "primary"',
  :flat='micro',
  :dense='micro',
  :size='micro ? "sm" : undefined'
)
  q-icon(:name='micro ? "fa-solid fa-arrow-down" : "fa-solid fa-chevron-down"')
  span(v-if='!micro').q-ml-sm {{ $t('wallet.withdrawButton.buttonLabel') }}
  q-tooltip(v-if='micro') {{ $t('wallet.withdrawButton.submitLabel') }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("wallet.withdrawButton.dialogTitle")',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    Form(
      :disabled='!isFormValid',
      :handler-submit='handlerSubmit',
      :is-submitting='isSubmitting',
      :button-cancel-txt='$t("wallet.withdrawButton.cancel")',
      :button-submit-txt='$t("wallet.withdrawButton.confirm")',
      @cancel='clear'
    )
      InfoCard(
        :text='$t("wallet.withdrawButton.description")'
      )

      div
        q-input(
          v-model.number='quantity',
          standout='bg-teal text-white',
          type='number',
          :min='1',
          :label='$t("wallet.withdrawButton.amountLabel")',
          :hint='availableHint',
          :rules='quantityRules'
        )
          template(#append)
            span.text-overline {{ currency }}

      div
        q-select(
          v-model='selectedMethod',
          :options='methodOptions',
          standout='bg-teal text-white',
          :label='$t("wallet.withdrawButton.methodLabel")',
          option-label='label',
          option-value='value',
          :rules='[(val) => !!val || $t("wallet.withdrawButton.methodPlaceholder")]',
          :loading='loadingMethods'
        )
          template(v-slot:no-option)
            q-item
              q-item-section.text-grey {{ $t('wallet.withdrawButton.methodsEmpty') }}
</template>
<script setup lang="ts">import { t } from 'src/shared/i18n';

interface Props {
  micro?: boolean;
}

withDefaults(defineProps<Props>(), {
  micro: false,
});
import { ref, computed, watch } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { env } from 'src/shared/config';
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useReturnByMoney, useWithdrawDialog } from '../model';
import type { IPaymentMethodData, IBankTransferData, ISBPData } from 'src/entities/Wallet/model/types';
import InfoCard from 'src/shared/ui/InfoCard.vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';

const currency = computed(() => env.CURRENCY);
const { showDialog } = useWithdrawDialog();
const quantity = ref();
const selectedMethod = ref<{
  label: string;
  value: string;
  description?: string;
} | null>(null);
const isSubmitting = ref(false);
const loadingMethods = ref(false);

const walletStore = useWalletStore();
const { info } = useSystemStore();
const session = useSessionStore();
const { processReturnByMoney } = useReturnByMoney();

// Вернуть можно не больше собственного остатка на паевом кошельке — ровно его
// цепь и сверяет. Раньше форма принимала любую сумму: пайщик вводил больше,
// чем у него есть, подписывал заявление и получал отказ с текстом контракта.
// Остаток не загрузился — не блокируем: окончательно сумму проверит цепь.
const availableToReturn = computed<number | null>(() => {
  const share = walletStore.user_wallets.find((w) => w.wallet_name === 'w.wal.share');
  if (!share?.available) return null;
  const amount = Number.parseFloat(share.available);
  return Number.isFinite(amount) ? amount : null;
});

const availableHint = computed(() =>
  availableToReturn.value === null
    ? undefined
    : t('wallet.withdrawButton.availableAmountLabel', { amount: availableToReturn.value, currency: currency.value }),
);

// Правила валидации для суммы
const quantityRules = [
  (val: number) => val > 0 || t('wallet.withdrawButton.amountPositiveError'),
  (val: number) =>
    availableToReturn.value === null ||
    val <= availableToReturn.value ||
    t('wallet.withdrawButton.amountExceedsBalanceError'),
];

// Опции методов платежа
const methodOptions = computed(() => {
  return walletStore.methods.map((method: IPaymentMethodData) => ({
    label: getMethodLabel(method),
    value: method.method_id.toString(),
    description: getMethodDescription(method),
  }));
});

// Проверка валидности формы
const isFormValid = computed(() => {
  return (
    quantity.value >= 0 &&
    quantity.value > 0 &&
    (availableToReturn.value === null || quantity.value <= availableToReturn.value) &&
    selectedMethod.value !== null &&
    !isSubmitting.value
  );
});

// Функция для получения читаемого названия метода
function getMethodLabel(method: IPaymentMethodData): string {
  if (method.method_type === 'sbp' && isSBPData(method.data)) {
    const phone = method.data.phone;
    let formatted = phone;
    if (phone.length >= 6) {
      formatted = `${phone.slice(0, 2)}***${phone.slice(-2)}`;
    } else if (phone.length > 2) {
      formatted = `${phone.slice(0, 2)}***${phone.slice(-2)}`;
    }
    return t('wallet.withdrawButton.sbpMethodLabel', { phone: formatted });
  } else if (
    method.method_type === 'bank_transfer' &&
    isBankTransferData(method.data)
  ) {
    const acc = method.data.account_number;
    const last4 = acc.slice(-4);
    const bank = method.data.bank_name || '';
    return t('wallet.withdrawButton.bankTransferMethodLabel', { bank, last4 });
  }
  return method.method_type;
}

// Функция для получения описания метода
function getMethodDescription(method: IPaymentMethodData): string {
  if (method.method_type === 'sbp' && isSBPData(method.data)) {
    return t('wallet.withdrawButton.sbpFullMethodLabel', { phone: method.data.phone });
  } else if (
    method.method_type === 'bank_transfer' &&
    isBankTransferData(method.data)
  ) {
    return t('wallet.withdrawButton.bankAccountMethodLabel', { accountNumber: method.data.account_number, bankName: method.data.bank_name });
  }
  return '';
}

// Функции для проверки типов данных
function isSBPData(data: ISBPData | IBankTransferData): data is ISBPData {
  return (data as ISBPData).phone !== undefined;
}

function isBankTransferData(
  data: ISBPData | IBankTransferData,
): data is IBankTransferData {
  return (data as IBankTransferData).account_number !== undefined;
}

// Загрузка методов платежа при открытии диалога
watch(showDialog, async (newValue) => {
  if (newValue) {
    loadingMethods.value = true;
    try {
      await walletStore.loadUserWallet({
        coopname: info.coopname,
        username: session.username,
      });
    } catch (error) {
      console.error('Ошибка загрузки методов платежа:', error);
      FailAlert(t('wallet.withdrawButton.methodsLoadError'));
    } finally {
      loadingMethods.value = false;
    }
  }
});

const clear = (): void => {
  showDialog.value = false;
  isSubmitting.value = false;
  quantity.value = null;
  selectedMethod.value = null;
};

const handlerSubmit = async (): Promise<void> => {
  if (!selectedMethod.value) {
    FailAlert(t('wallet.withdrawButton.methodRequiredError'));
    return;
  }

  isSubmitting.value = true;
  try {
    await processReturnByMoney({
      quantity: quantity.value,
      symbol: env.CURRENCY as string,
      method_id: selectedMethod.value.value,
    });
    SuccessAlert(t('wallet.withdrawButton.submitSuccess'));
    clear();
  } catch (e: any) {
    FailAlert(e);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped></style>
