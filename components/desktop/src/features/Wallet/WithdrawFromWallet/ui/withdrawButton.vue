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
import { paymentMethodDescription, paymentMethodLabel, useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useReturnByMoney, useWithdrawDialog } from '../model';
import type { IPaymentMethodData } from 'src/entities/Wallet/model/types';
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
    label: paymentMethodLabel(method),
    value: method.method_id.toString(),
    description: paymentMethodDescription(method),
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
