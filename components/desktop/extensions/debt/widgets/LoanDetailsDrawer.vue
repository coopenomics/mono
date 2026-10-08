<template lang="pug">
DetailsDrawer(
  :model-value='modelValue',
  :title='loan ? $t("debt.loanDetails.title", { number: loan.contract_number }) : ""',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .loan-details(v-if='loan')
    //- Состояние — один раз бейджем; главное число крупно с подписью.
    .loan-details__head
      BaseBadge(:variant='loanStatusVariant(loan.status)') {{ loanStatusLabel(loan.status) }}
    .loan-details__sum
      .loan-details__eyebrow {{ outstanding ? $t('debt.loanDetails.remainingLabel') : $t('debt.loanDetails.amountLabel') }}
      .loan-details__amount {{ formatAmount(outstanding ? loan.remaining : loan.amount) }}

    BaseBanner(v-if='loan.status === "SIGNED"', variant='warn')
      | {{ $t('debt.loanDetails.payDeclinedHint') }}

    BaseBanner(v-if='extensionPending', variant='info')
      | {{ $t('debt.loanDetails.extensionPendingHint') }}

    .loan-details__facts
      DataRow(v-if='outstanding', :label='$t("debt.loanDetails.amountLabel")', :value='formatAmount(loan.amount)')
      DataRow(v-if='repaid > 0', :label='$t("debt.loanDetails.repaidLabel")', :value='formatAmount(repaidAsset)')
      DataRow(v-if='showMember && loan.username', :label='$t("debt.loanDetails.memberLabel")', :value='loan.username', mono)
      DataRow(:label='$t("debt.loanDetails.sourceLabel")', :value='sourceLabel(loan.source)')
      DataRow(v-if='loan.collateral', :label='$t("debt.loanDetails.collateralLabel")', :value='collateralLabel(loan.collateral)')
      DataRow(v-if='hasPledge', :label='$t("debt.loanDetails.pledgedLabel")', :value='formatAmount(loan.pledged)')
      DataRow(:label='$t("debt.loanDetails.createdLabel")', :value='formatDate(loan.created_at)')
      DataRow(v-if='formatDate(loan.issued_at)', :label='$t("debt.loanDetails.issuedLabel")', :value='formatDate(loan.issued_at)')
      DataRow(v-if='formatDate(loan.due_at)', :label='$t("debt.loanDetails.dueLabel")', :value='formatDate(loan.due_at)')
      DataRow(
        v-if='outstanding && days !== null',
        :label='days >= 0 ? $t("debt.loanDetails.daysLeftLabel") : $t("debt.loanDetails.overdueDaysLabel")',
        :value='$t("debt.loanDetails.daysLeftValue", { count: Math.abs(days) })'
      )
      DataRow(
        v-if='extensionPending',
        :label='$t("debt.loanDetails.requestedDueLabel")',
        :value='formatDate(loan.requested_due_at)'
      )
      DataRow(
        v-if='loan.status === "SIGNED" && loan.last_pay_error',
        :label='$t("debt.loanDetails.payErrorLabel")',
        :value='loan.last_pay_error',
        align='vertical'
      )

    .loan-details__section(v-if='hasDocuments')
      .loan-details__eyebrow {{ $t('debt.loanDetails.documentsTitle') }}
      LoanDocuments(:loan='loan')

  template(v-if='loan && (canCancel || canRetry || canRepay)', #footer)
    .loan-details__footer
      BaseButton(
        v-if='canRepay && !extensionPending',
        variant='secondary',
        :disabled='busy !== null',
        @click='extendOpen = true'
      ) {{ $t('debt.loanDetails.extendAction') }}
      BaseButton(
        v-if='canRepay',
        variant='primary',
        :disabled='busy !== null',
        @click='repayOpen = true'
      ) {{ $t('debt.loanDetails.repayAction') }}
      BaseButton(
        v-if='canRetry',
        variant='primary',
        :loading='busy === "retry"',
        :disabled='busy !== null',
        @click='onRetry'
      ) {{ $t('debt.loanDetails.retryPayAction') }}
      BaseButton(
        v-if='canCancel',
        variant='danger',
        :loading='busy === "cancel"',
        :disabled='busy !== null',
        @click='confirmOpen = true'
      ) {{ $t('debt.loanDetails.cancelAction') }}

LoanRepayDialog(v-model='repayOpen', :loan='loan', @repaid='$emit("changed")')
LoanExtendDialog(v-model='extendOpen', :loan='loan', @extended='$emit("changed")')

//- Подтверждение отмены: действие необратимо, обеспечение возвращается в программу.
BaseDialog(v-model='confirmOpen', :title='$t("debt.loanDetails.cancelConfirmTitle")', size='sm')
  .loan-details__confirm {{ $t('debt.loanDetails.cancelConfirmMessage') }}
  template(#footer)
    .loan-details__footer
      BaseButton(variant='ghost', @click='confirmOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='danger', @click='onCancel') {{ $t('debt.loanDetails.cancelConfirmLabel') }}
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop';
import { useSessionStore } from 'src/entities/Session';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { DetailsDrawer } from 'src/shared/ui/domain/DetailsDrawer';
import type { ILoan } from '../api';
import {
  amountOf,
  collateralLabel,
  daysUntil,
  formatAmount,
  formatDate,
  isCancellable,
  isOutstanding,
  loanStatusLabel,
  loanStatusVariant,
  sourceLabel,
  useLoanActions,
} from '../model';
import { t } from '../i18n';
import LoanDocuments from './LoanDocuments.vue';
import LoanRepayDialog from '../pages/LoanRepayDialog.vue';
import LoanExtendDialog from '../pages/LoanExtendDialog.vue';

const props = defineProps<{
  modelValue: boolean;
  loan: ILoan | null;
  /** Реестр совета показывает заёмщика; в своих займах он лишний. */
  showMember?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'changed'): void;
}>();

const desktop = useDesktopStore();
const session = useSessionStore();
const { cancel, retryPayment } = useLoanActions();

const busy = ref<'cancel' | 'retry' | null>(null);
const confirmOpen = ref(false);
const repayOpen = ref(false);
const extendOpen = ref(false);

const outstanding = computed(() => (props.loan ? isOutstanding(props.loan.status) : false));
const hasPledge = computed(() => Boolean(props.loan?.pledged) && parseFloat(props.loan?.pledged ?? '0') > 0);
const hasDocuments = computed(() =>
  Boolean(
    props.loan?.statement ||
      props.loan?.contract ||
      props.loan?.signed_contract ||
      props.loan?.decision ||
      props.loan?.extension_statement,
  ),
);

// Возвращённая часть — разница суммы займа и остатка.
const repaid = computed(() => (outstanding.value ? amountOf(props.loan?.amount) - amountOf(props.loan?.remaining) : 0));
const repaidAsset = computed(() => `${repaid.value} ${String(props.loan?.amount ?? '').split(' ')[1] ?? ''}`);
const days = computed(() => daysUntil(props.loan?.due_at));
const extensionPending = computed(() => outstanding.value && Boolean(formatDate(props.loan?.requested_due_at)));

// Возвращает и продлевает заём сам заёмщик, и только заём контракта займов:
// погашение деньгами займов других приложений идёт в них.
const canRepay = computed(
  () => outstanding.value && props.loan?.source === 'debt' && props.loan?.username === session.username,
);

// Отменяется только заём контракта займов до выплаты: свой — пайщиком, любой — председателем.
const canCancel = computed(() => {
  const loan = props.loan;
  if (!loan || loan.source !== 'debt' || !isCancellable(loan.status)) return false;
  return loan.username === session.username || desktop.hasGrant('debt', 'Loan:cancel:all');
});
const canRetry = computed(
  () => props.loan?.status === 'SIGNED' && props.loan?.source === 'debt' && desktop.hasGrant('debt', 'Loan:retry-pay'),
);

async function onCancel(): Promise<void> {
  if (!props.loan) return;
  confirmOpen.value = false;
  try {
    busy.value = 'cancel';
    await cancel(props.loan.debt_hash);
    SuccessAlert(t('debt.loanDetails.cancelledMessage'));
    emit('changed');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

async function onRetry(): Promise<void> {
  if (!props.loan) return;
  try {
    busy.value = 'retry';
    await retryPayment(props.loan.debt_hash);
    SuccessAlert(t('debt.loanDetails.retryMessage'));
    emit('changed');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}
</script>

<style scoped lang="scss">
.loan-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}

.loan-details__head {
  display: flex;
}

.loan-details__eyebrow {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: var(--p-2);
}

.loan-details__amount {
  font-size: var(--p-fs-h1);
  font-weight: 700;
  color: var(--p-ink);
}

.loan-details__facts {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.loan-details__confirm {
  color: var(--p-ink-2);
}

.loan-details__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
