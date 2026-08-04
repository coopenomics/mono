<template lang="pug">
BaseDialog(
  v-model='isOpen',
  title='Получить долю в объекте авторских прав',
  size='lg',
  :close-on-backdrop='false'
)
  BaseForm(:loading='loading', @submit='handleConvert')
    .convert-dialog
      p.convert-dialog__lead.t-sm.t-muted
        | Распределите средства между главным кошельком и кошельком программы «Благорост».

      WalletCard(
        compact,
        neutral,
        title='Всего к получению',
        :balance='formatBalance(displayTotalToReceive)',
        :symbol='governSymbol',
        balance-label='сумма',
        icon='payments'
      )

      .convert-dialog__wallets
        WalletCard(
          compact,
          program='wallet',
          title='Главный кошелёк',
          :balance='formatBalance(displayWalletAmount)',
          :symbol='governSymbol',
          balance-label='получите',
          icon='account_balance_wallet'
        )
        WalletCard(
          compact,
          program='blagorost',
          title='Программа «Благорост»',
          :balance='formatBalance(displayCapitalAmount)',
          :symbol='governSymbol',
          balance-label='получите',
          icon='savings'
        )

      .convert-dialog__slider
        q-slider(
          v-model='sliderPercentage',
          :min='0',
          :max='100',
          :step='1',
          :color='sliderColor',
          track-color='grey-3',
          :selection-color='sliderSelectionColor',
          :readonly='isReadonly',
          markers,
          label,
          :label-value='sliderLabel',
          track-size='28px',
          thumb-size='55px'
        )
        p.convert-dialog__hint.t-sm.t-muted(v-if='canMoveSlider')
          | 0% — всё доступное в главный кошелёк · 100% — всё в программу «Благорост»
        p.convert-dialog__hint.t-sm.t-muted(v-else)
          | Все средства автоматически направляются в программу «Благорост»

    template(#footer)
      BaseButton(variant='ghost', :disabled='loading', @click='isOpen = false')
        | Отмена
      BaseButton(
        variant='primary',
        type='submit',
        :loading='loading',
        :disabled='!isValidDistribution'
      ) Получить
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import { useConvertSegment } from '../model';
import { useSegmentStore } from 'app/extensions/capital/entities/Segment/model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseButton, BaseDialog, BaseForm } from 'src/shared/ui/base';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useSystemStore } from 'src/entities/System/model';

interface Props {
  segment: ISegment;
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  converted: [segment: ISegment];
}>();

const { info } = useSystemStore();
const { convertSegmentWithDocumentGeneration } = useConvertSegment();
const segmentStore = useSegmentStore();
const loading = ref(false);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const availableForWallet = computed(() => {
  return parseFloat(props.segment.available_for_wallet || '0');
});

const availableForProgram = computed(() => {
  return parseFloat(props.segment.available_for_program || '0');
});

const maxWalletAmount = computed(() => availableForWallet.value);

const canMoveSlider = computed(() => maxWalletAmount.value > 0);

const isReadonly = computed(() => !canMoveSlider.value);

const sliderPercentage = ref(0);
const walletAmountValue = ref(0);
const capitalAmountValue = ref(0);

const displayTotalToReceive = computed(() => availableForProgram.value);

const displayWalletAmount = computed(() => walletAmountValue.value);

const displayCapitalAmount = computed(() => capitalAmountValue.value);

watch(sliderPercentage, (newPercentage) => {
  if (!canMoveSlider.value) {
    walletAmountValue.value = 0;
    capitalAmountValue.value = availableForProgram.value;
    return;
  }

  walletAmountValue.value = maxWalletAmount.value * (1 - newPercentage / 100);
  capitalAmountValue.value = availableForProgram.value - walletAmountValue.value;
});

watch(walletAmountValue, (newWallet) => {
  if (!canMoveSlider.value) return;

  capitalAmountValue.value = availableForProgram.value - newWallet;

  if (maxWalletAmount.value > 0) {
    const calculatedPercentage =
      ((maxWalletAmount.value - newWallet) / maxWalletAmount.value) * 100;
    sliderPercentage.value = Math.max(0, Math.min(100, calculatedPercentage));
  }
});

watch(capitalAmountValue, (newCapital) => {
  if (!canMoveSlider.value) return;

  const newWallet = availableForProgram.value - newCapital;
  if (newWallet !== walletAmountValue.value) {
    walletAmountValue.value = Math.max(
      0,
      Math.min(newWallet, maxWalletAmount.value),
    );
  }
});

const sliderColor = computed(() => {
  if (!canMoveSlider.value) return 'grey';
  if (sliderPercentage.value < 38) return 'red';
  return 'teal';
});

const sliderSelectionColor = computed(() => {
  if (!canMoveSlider.value) return 'grey-4';
  if (sliderPercentage.value < 38) return 'red';
  return 'teal';
});

const sliderLabel = computed(() => `${Math.round(sliderPercentage.value)}%`);

const isValidDistribution = computed(() => {
  const total = walletAmountValue.value + capitalAmountValue.value;
  const totalMatches = Math.abs(total - availableForProgram.value) < 1;
  const walletValid = walletAmountValue.value <= availableForWallet.value;
  const capitalValid =
    Math.abs(
      capitalAmountValue.value -
        (availableForProgram.value - walletAmountValue.value),
    ) < 1;

  return totalMatches && walletValid && capitalValid;
});

const formatBalance = (amount: number) => {
  return formatAsset2Digits(`${amount} ${governSymbol.value}`)
    .replace(/\s*[A-Z]{3,7}\s*$/, '')
    .trim();
};

watch(isOpen, (newValue) => {
  if (newValue) {
    if (!canMoveSlider.value) {
      sliderPercentage.value = 100;
      walletAmountValue.value = 0;
      capitalAmountValue.value = availableForProgram.value;
    } else {
      sliderPercentage.value = 0;
      walletAmountValue.value = maxWalletAmount.value;
      capitalAmountValue.value =
        availableForProgram.value - walletAmountValue.value;
    }
  }
});

const handleConvert = async () => {
  if (!isValidDistribution.value) return;

  loading.value = true;
  try {
    const updatedSegment = await convertSegmentWithDocumentGeneration({
      coopname: props.segment.coopname,
      username: props.segment.username,
      project_hash: props.segment.project_hash,
      wallet_amount: walletAmountValue.value,
      capital_amount: capitalAmountValue.value,
    });

    if (updatedSegment) {
      segmentStore.addSegmentToList(props.segment.project_hash, updatedSegment);
      SuccessAlert(
        'Доля в объекте интеллектуальной собственности успешно получена',
      );
      isOpen.value = false;
      emit('converted', updatedSegment);
    } else {
      throw new Error(
        'Не удалось получить обновленную долю после конвертации',
      );
    }
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.convert-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;
  padding: var(--p-1) 0 var(--p-2);
}

.convert-dialog__lead {
  margin: 0;
  line-height: 1.45;
}

.convert-dialog__wallets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--p-3);
}

.convert-dialog__slider {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  min-width: 0;
}

.convert-dialog__hint {
  margin: 0;
  text-align: center;
  line-height: 1.4;
}

@media (max-width: 640px) {
  .convert-dialog__wallets {
    grid-template-columns: 1fr;
  }
}
</style>
