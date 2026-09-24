<template lang="pug">
.push-result
  BaseButton(
    variant='primary',
    size='sm',
    :loading='loading || isSubmitting',
    @click.stop='showDialog = true'
  ) {{ $t('capital.pushResultButton.label') }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("capital.pushResultButton.dialogTitle")',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    BaseForm(:loading='isSubmitting', @submit='handlePushResult')
      .push-result__body
        WalletCard(
          compact,
          neutral,
          :title='$t("capital.pushResultButton.shareContributionTitle")',
          :balance='contributionBalance',
          :symbol='governSymbol',
          :balance-label='$t("capital.pushResultButton.amountBalanceLabel")',
          icon='account_balance'
        )
        WalletCard(
          v-if='hasDebt',
          compact,
          neutral,
          :title='$t("capital.pushResultButton.loanRepaymentTitle")',
          :balance='debtBalance',
          :symbol='governSymbol',
          :balance-label='$t("capital.pushResultButton.loanBalanceLabel")',
          icon='payments'
        )

      template(#footer)
        BaseButton(variant='ghost', :disabled='isSubmitting', @click='clear')
          | {{ $t('common.action.cancel') }}
        BaseButton(
          variant='primary',
          type='submit',
          :loading='isSubmitting'
        ) {{ $t('common.action.confirm') }}
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePushResult } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseButton, BaseDialog, BaseForm } from 'src/shared/ui/base';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useSystemStore } from 'src/entities/System/model';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import { t } from '../../../../i18n';

interface Props {
  segment: ISegment;
}

const props = defineProps<Props>();

/** Заявление меняет статус доли — список обязан перечитать строку */
const emit = defineEmits<{ submitted: [] }>();

const { info } = useSystemStore();
const { pushResultWithGeneratedStatement } = usePushResult();

const loading = ref(false);
const showDialog = ref(false);
const isSubmitting = ref(false);

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const formatMoneyBalance = (raw: string | number | undefined): string => {
  const src =
    typeof raw === 'string' && /\s[A-Z]{3,7}$/.test(raw.trim())
      ? raw
      : `${raw || 0} ${governSymbol.value}`;
  const formatted = formatAsset2Digits(src);
  return formatted.replace(/\s*[A-Z]{3,7}\s*$/, '').trim() || '0,00';
};

const contributionBalance = computed(() =>
  formatMoneyBalance(props.segment?.intellectual_cost),
);

const debtBalance = computed(() =>
  formatMoneyBalance(props.segment?.debt_amount),
);

const hasDebt = computed(
  () => parseFloat(String(props.segment?.debt_amount || '0')) > 0,
);

const clear = () => {
  showDialog.value = false;
  isSubmitting.value = false;
};

const handlePushResult = async () => {
  try {
    isSubmitting.value = true;
    await pushResultWithGeneratedStatement(
      props.segment.project_hash,
      props.segment.username,
    );
    SuccessAlert(t('capital.pushResultButton.success'));
    emit('submitted');
    clear();
  } catch (error) {
    FailAlert(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.push-result__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-1) 0 var(--p-2);
  min-width: 0;
}
</style>
