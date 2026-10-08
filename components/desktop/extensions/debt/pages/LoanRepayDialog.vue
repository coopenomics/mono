<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  :title='$t("debt.repayDialog.title")',
  size='sm',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .repay-form(v-if='loan')
    q-skeleton(v-if='loading', type='rect', height='120px')

    EmptyState(
      v-else-if='walletAvailable <= 0',
      :title='$t("debt.repayDialog.walletEmptyTitle")',
      :body='$t("debt.repayDialog.walletEmptyBody")'
    )
      template(#icon)
        q-icon(name='account_balance_wallet', size='40px')

    template(v-else)
      AmountInput(
        v-model='amount',
        :symbol='symbol',
        :precision='precision',
        :label='$t("debt.repayDialog.amountLabel")',
        :hint='$t("debt.repayDialog.amountHint", { remaining: formatAmount(loan.remaining) })',
        :balance='walletAvailable',
        :max='maxAmount',
        show-balance,
        show-max
      )
      BaseBanner(variant='info') {{ $t('debt.repayDialog.terms') }}

  template(#footer)
    .repay-form__footer
      BaseButton(variant='ghost', @click='close') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='submitting', :disabled='!canSubmit', @click='submit') {{ $t('debt.repayDialog.submitLabel') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Ledger2Contract } from 'cooptypes';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { useSystemStore } from 'src/entities/System/model';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { getRepayAvailable, type ILoan } from '../api';
import { amountOf, formatAmount, useLoanActions } from '../model';
import { t } from '../i18n';

const props = defineProps<{ modelValue: boolean; loan: ILoan | null }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'repaid'): void;
}>();

const system = useSystemStore();
const { repay } = useLoanActions();

const symbol = computed(() => system.governSymbol);
const precision = computed(() => system.governPrecision);

const loading = ref(true);
const submitting = ref(false);
const walletAvailable = ref(0);
const amount = ref<number | null>(null);

// Вернуть можно в пределах остатка займа и свободного на главном кошельке.
const maxAmount = computed(() => Math.min(amountOf(props.loan?.remaining), walletAvailable.value));
const canSubmit = computed(
  () => amount.value !== null && amount.value > 0 && amount.value <= maxAmount.value && !submitting.value,
);

// silent — дочитка по ленте изменений: без каркаса и без сброса введённого.
async function load(silent = false): Promise<void> {
  try {
    if (!silent) loading.value = true;
    walletAvailable.value = amountOf(await getRepayAvailable(system.info.coopname));
    if (!silent) amount.value = maxAmount.value > 0 ? maxAmount.value : null;
  } catch (e) {
    if (!silent) FailAlert(e);
  } finally {
    loading.value = false;
  }
}

// Остатки кошельков пайщика меняются и при открытом окне — перечитываем по ленте изменений.
useLiveReload([liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets)], () => {
  if (props.modelValue && !submitting.value) void load(true);
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) void load();
  },
  { immediate: true },
);

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (!props.loan || amount.value === null) return;
  try {
    submitting.value = true;
    await repay(props.loan.debt_hash, amount.value, symbol.value, precision.value);
    SuccessAlert(t('debt.repayDialog.submittedMessage'));
    emit('repaid');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.repay-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.repay-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
