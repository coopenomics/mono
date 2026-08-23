<template lang="pug">
.push-result
  BaseButton(
    variant='primary',
    size='sm',
    :loading='loading || isSubmitting',
    @click.stop='showDialog = true'
  ) Внести результат

  BaseDialog(
    v-model='showDialog',
    title='Внесение результата',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    BaseForm(:loading='isSubmitting', @submit='handlePushResult')
      .push-result__body
        WalletCard(
          compact,
          neutral,
          title='Паевой взнос',
          :balance='contributionBalance',
          :symbol='governSymbol',
          balance-label='сумма',
          icon='account_balance'
        )
        WalletCard(
          v-if='hasDebt',
          compact,
          neutral,
          title='Погашаемая ссуда',
          :balance='debtBalance',
          :symbol='governSymbol',
          balance-label='ссуда',
          icon='payments'
        )

      template(#footer)
        BaseButton(variant='ghost', :disabled='isSubmitting', @click='clear')
          | Отмена
        BaseButton(
          variant='primary',
          type='submit',
          :loading='isSubmitting'
        ) Подтвердить
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
    SuccessAlert('Заявление отправлено в совет на рассмотрение');
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
