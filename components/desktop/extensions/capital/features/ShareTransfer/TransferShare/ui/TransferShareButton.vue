<template lang="pug">
div
  //- Иконка обязательна: на узком экране шапка прячет текст кнопки.
  BaseButton(
    variant='primary',
    :loading='isSubmitting',
    :aria-label='$t("capital.shareTransfer.action")',
    @click='open'
  )
    template(#icon-left)
      q-icon(name='move_up', size='18px')
    | {{ $t('capital.shareTransfer.action') }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("capital.shareTransfer.dialogTitle")',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    BaseForm(:loading='isSubmitting', @submit='submit')
      .transfer-dialog__text {{ $t('capital.shareTransfer.dialogText') }}
      AmountInput(
        v-model='quantity',
        :label='$t("capital.shareTransfer.amountLabel")',
        placeholder='0,00',
        :symbol='currency',
        :precision='2',
        :min='0',
        :max='available',
        :balance='available',
        show-balance,
        show-max,
        :error='amountError'
      )
      template(#footer)
        BaseButton(variant='ghost', @click='clear') {{ $t('common.action.cancel') }}
        BaseButton(
          variant='primary',
          type='submit',
          :loading='isSubmitting',
          :disabled='!isValidAmount'
        ) {{ $t('capital.shareTransfer.submit') }}
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BaseButton, BaseDialog, BaseForm } from 'src/shared/ui/base';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useSystemStore } from 'src/entities/System/model';
import { useShareTransferStore } from 'app/extensions/capital/entities/ShareTransfer';
import { useTransferShare } from '../model';
import { t } from '../../../../i18n';

const system = useSystemStore();
const store = useShareTransferStore();
const { transfer, isSubmitting } = useTransferShare();

const quantity = ref<number | string | null>(null);
const showDialog = ref(false);

const currency = computed(() => system.info?.symbols?.root_govern_symbol ?? 'RUB');
// Правило контракта «не больше остатка» видно до отправки: поле не пускает сумму сверх него.
const available = computed(() => Number.parseFloat(store.state?.blagorost_balance ?? '0') || 0);
const amount = computed(() => Number(quantity.value));
const isValidAmount = computed(() => amount.value > 0 && amount.value <= available.value);

// Ошибку показываем только после ввода, чтобы пустой диалог не открывался красным.
const amountError = computed(() => {
  if (quantity.value == null || quantity.value === '') return undefined;
  if (!(amount.value > 0)) return t('capital.shareTransfer.amountPositiveError');
  if (amount.value > available.value) return t('capital.shareTransfer.amountOverBalanceError');
  return undefined;
});

function open(): void {
  showDialog.value = true;
}

function clear(): void {
  showDialog.value = false;
  quantity.value = null;
}

async function submit(): Promise<void> {
  if (!isValidAmount.value) return;
  try {
    await transfer(amount.value);
    SuccessAlert(t('capital.shareTransfer.success'));
    clear();
  } catch (e: unknown) {
    FailAlert(e);
  }
}
</script>

<style scoped lang="scss">
.transfer-dialog__text {
  margin-bottom: var(--p-4);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}
</style>
