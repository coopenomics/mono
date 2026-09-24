<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  :title='$t("expenses.expenseProposalCreateDialog.dialogTitle")',
  size='lg',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .create-form
    .field-group
      .t-section.q-mb-sm {{ $t('expenses.expenseProposalCreateDialog.sectionPurposeTitle') }}
      BaseInput(
        v-model='form.description',
        :label='$t("expenses.expenseProposalCreateDialog.purposeLabel")',
        :placeholder='$t("expenses.expenseProposalCreateDialog.purposePlaceholder")',
        required
      )
      BaseInput(
        v-model='form.source_wallet',
        :label='$t("expenses.expenseProposalCreateDialog.walletLabel")',
        placeholder='w.cap.blago / w.cap.gen / …',
        required
      )
      BaseInput(
        v-model='form.deadline',
        type='date',
        :label='$t("expenses.expenseProposalCreateDialog.deadlineLabel")',
        required
      )

    .field-group
      .field-group__head
        .t-section {{ $t('expenses.expenseProposalCreateDialog.linesTitle') }}
        BaseButton(
          variant='ghost',
          size='sm',
          icon='add',
          @click='addItem'
        ) {{ $t('expenses.expenseProposalCreateDialog.addLineLabel') }}

      .empty-items(v-if='!form.items.length')
        EmptyState(
          :title='$t("expenses.expenseProposalCreateDialog.noLinesTitle")',
          :body='$t("expenses.expenseProposalCreateDialog.noLinesHint")'
        )
          template(#icon)
            q-icon(name='playlist_add', size='40px')

      .items
        .item-card(v-for='(item, idx) in form.items', :key='idx')
          .item-card__head
            .t-section-sm {{ $t('expenses.expenseProposalCreateDialog.linePositionLabel', { index: idx + 1 }) }}
            BaseButton(
              variant='ghost',
              size='sm',
              icon='delete',
              @click='removeItem(idx)'
            )
          .row.q-col-gutter-sm
            .col-12.col-md-6
              q-select(
                v-model='item.recipient_type',
                :options='recipientTypeOptions',
                :label='$t("expenses.expenseProposalCreateDialog.recipientTypeLabel")',
                outlined,
                dense,
                emit-value,
                map-options,
                @update:model-value='onRecipientTypeChange(item)'
              )
            .col-12.col-md-6
              q-select(
                v-model='item.mechanics',
                :options='mechanicsOptions',
                :label='$t("expenses.expenseProposalCreateDialog.methodLabel")',
                outlined,
                dense,
                emit-value,
                map-options,
                disable
              )
            .col-12.col-md-6
              BaseInput(
                v-model='item.recipient_name',
                :label='$t("expenses.expenseProposalCreateDialog.recipientNameLabel")',
                :placeholder='$t("expenses.expenseProposalCreateDialog.recipientNamePlaceholder")'
              )
            .col-12.col-md-6
              BaseInput(
                v-model='item.recipient_account',
                :label='$t("expenses.expenseProposalCreateDialog.recipientAccountLabel")',
                placeholder='username / eosio::name'
              )
            .col-12.col-md-6
              BaseInput(
                v-model='item.amount',
                :label='$t("expenses.expenseProposalCreateDialog.amountPlanLabel")',
                placeholder='1000.0000 RUB',
                required
              )
            .col-12
              BaseInput(
                v-model='item.description',
                :label='$t("expenses.expenseProposalCreateDialog.purposeDetailLabel")',
                :placeholder='$t("expenses.expenseProposalCreateDialog.purposeDetailPlaceholder")'
              )
            .col-12(v-if='item.recipient_type === "ORG"')
              BaseInput(
                v-model='item.requisites',
                :label='$t("expenses.expenseProposalCreateDialog.recipientDetailsLabel")',
                :placeholder='$t("expenses.expenseProposalCreateDialog.recipientDetailsPlaceholder")'
              )
            .col-12(v-if='item.recipient_type === "ORG"')
              BaseInput(
                v-model='item.payment_purpose',
                :label='$t("expenses.expenseProposalCreateDialog.paymentPurposeLabel")',
                :placeholder='$t("expenses.expenseProposalCreateDialog.paymentPurposePlaceholder")'
              )

  template(#footer)
    .footer-bar
      BaseButton(variant='ghost', @click='close') {{ $t('common.action.cancel') }}
      BaseButton(
        variant='primary',
        :loading='submitting',
        :disabled='!canSubmit',
        @click='submit'
      ) {{ $t('expenses.expenseProposalCreateDialog.submitLabel') }}
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { useExpenseProposalActions, type ICreateProposalDraftItem } from '../model';
import { t } from '../i18n';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created'): void;
}>();

const { submitProposal } = useExpenseProposalActions();

const form = reactive({
  description: '',
  source_wallet: 'w.cap.blago',
  deadline: '',
  items: [] as ICreateProposalDraftItem[],
});

const submitting = ref(false);

const recipientTypeOptions = [
  { label: t('expenses.expenseProposalCreateDialog.recipientTypeSelfOption'), value: 'SELF' as const },
  { label: t('expenses.expenseProposalCreateDialog.recipientTypeMemberOption'), value: 'MEMBER' as const },
  { label: t('expenses.expenseProposalCreateDialog.recipientTypeOrgOption'), value: 'ORG' as const },
];

const mechanicsOptions = [
  { label: t('expenses.expenseProposalCreateDialog.methodAdvanceOption'), value: 'ADVANCE' as const },
  { label: t('expenses.expenseProposalCreateDialog.methodInvoiceOption'), value: 'DIRECT' as const },
];

// Пайщик получает только аванс под отчёт; организация — только прямую оплату.
function onRecipientTypeChange(item: ICreateProposalDraftItem): void {
  item.mechanics = item.recipient_type === 'ORG' ? 'DIRECT' : 'ADVANCE';
}

const canSubmit = computed(
  () =>
    form.description.trim().length > 0 &&
    form.source_wallet.trim().length > 0 &&
    form.deadline.trim().length > 0 &&
    form.items.length > 0 &&
    form.items.every((i) => i.amount.trim() && i.description.trim()),
);

function addItem(): void {
  form.items.push({
    number: String(form.items.length + 1),
    description: '',
    amount: '',
    recipient_type: 'SELF',
    mechanics: 'ADVANCE',
    recipient_name: '',
    requisites: '',
    payment_purpose: '',
    recipient_account: '',
  });
}

function removeItem(idx: number): void {
  form.items.splice(idx, 1);
}

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  try {
    submitting.value = true;
    await submitProposal({
      description: form.description,
      source_wallet: form.source_wallet,
      deadline: form.deadline,
      items: form.items,
    });
    SuccessAlert(t('expenses.expenseProposalCreateDialog.submittedMessage'));
    emit('created');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.field-group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
}

.items {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.item-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}

.item-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
}

.footer-bar {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
  padding: var(--p-3) var(--p-4);
  border-top: 1px solid var(--p-line);
}
</style>
