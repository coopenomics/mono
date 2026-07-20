<template lang="pug">
q-dialog(
  v-model='isOpen',
  persistent,
  :maximized='$q.screen.lt.md'
)
  q-card.modal-convert-segment
    q-card-section.modal-header
      .text-h6 Получить долю в объекте авторских прав
      .text-subtitle2 Распределите средства между Главным Кошельком и кошельком программы "Благорост"


    q-card-section.modal-body
      // Всего к распределению
      ColorCard(color='blue')
        .card-label Всего к получению
        .card-value {{ formatAmount(displayTotalToReceive) }}

      // Слайдер распределения
      .distribution-section.q-mt-lg
        .row.justify-between.q-mb-lg
          .distribution-item
            q-icon(name='account_balance_wallet', color='teal', size='24px')
            .distribution-label.text-caption.text-grey-7 Главный Кошелек
            .distribution-value.text-h6.text-weight-bold.text-teal {{ formatAmount(displayWalletAmount) }}
          .distribution-item

            q-icon(name='savings', color='teal', size='24px')
            .distribution-label.text-caption.text-grey-7 Программа Благорост
            .distribution-value.text-h6.text-weight-bold.text-teal {{ formatAmount(displayCapitalAmount) }}

        q-slider.balance-slider(
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
          track-size="28px"
          thumb-size="55px"
        )
        .text-caption.text-center.q-mt-sm.text-grey-7(v-if='canMoveSlider')
          | 0% = всё доступное в главный кошелек · 100% = всё в программу Благорост
        .text-caption.text-center.q-mt-sm.text-grey-6(v-if='!canMoveSlider')
          | Все средства автоматически направляются в программу Благорост



    q-card-actions.modal-actions(
      align='right'
    )
      q-btn(
        flat,
        label='Отмена',
        color='primary',
        v-close-popup
      )
      q-btn(
        :loading='loading',
        label='Получить',
        color='primary',
        @click='handleConvert',
        :disable='!isValidDistribution'
      )
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import { useConvertSegment } from '../model';
import { useSegmentStore } from 'app/extensions/capital/entities/Segment/model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import ColorCard from 'src/shared/ui/ColorCard/ui/ColorCard.vue';

interface Props {
  segment: ISegment;
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'converted': [segment: ISegment];
}>();

const { convertSegmentWithDocumentGeneration } = useConvertSegment();
const segmentStore = useSegmentStore();
const loading = ref(false);

// Реактивные состояния для диалога
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

// Доступная сумма для конвертации в кошелек
const availableForWallet = computed(() => {
  return parseFloat(props.segment.available_for_wallet || '0');
});

// Доступная сумма для конвертации в программу (без investor_base — она уже в _capital_program)
const availableForProgram = computed(() => {
  return parseFloat(props.segment.available_for_program || '0');
});

// Максимум что можно в кошелек (provisional_amount - debt_amount)
const maxWalletAmount = computed(() => availableForWallet.value);


// Проверка - можно ли вообще таскать слайдер (если нет средств для кошелька)
const canMoveSlider = computed(() => {
  return maxWalletAmount.value > 0;
});

// Readonly если нельзя таскать слайдер
const isReadonly = computed(() => !canMoveSlider.value);

// Значения для управления (суммы КОНВЕРТАЦИИ, без возврата)
const sliderPercentage = ref(0); // 0% = все в кошелек, 100% = все в программу
const walletAmountValue = ref(0); // Сумма КОНВЕРТАЦИИ в кошелек
const capitalAmountValue = ref(0); // Сумма конвертации в программу

// Отображаемые суммы (с учетом возврата)
const displayTotalToReceive = computed(() => {
  // Всего к получению = конвертация
  return availableForProgram.value;
});

const displayWalletAmount = computed(() => {
  // В кошелек = конвертация
  return walletAmountValue.value;
});

const displayCapitalAmount = computed(() => {
  // В программу = только конвертация
  return capitalAmountValue.value;
});

// Watch на процент слайдера - пересчитываем суммы
watch(sliderPercentage, (newPercentage) => {
  if (!canMoveSlider.value) {
    // Если нельзя таскать слайдер - все в программу
    walletAmountValue.value = 0;
    capitalAmountValue.value = availableForProgram.value;
    return;
  }

  // Слайдер от 0% (все в кошелек) до 100% (все в программу)
  // wallet_amount = maxWallet * (1 - percentage/100)
  walletAmountValue.value = maxWalletAmount.value * (1 - newPercentage / 100);
  capitalAmountValue.value = availableForProgram.value - walletAmountValue.value;
});

// Watch на сумму кошелька - обновляем процент и программу
watch(walletAmountValue, (newWallet) => {
  if (!canMoveSlider.value) return;

  // Пересчитываем программу
  capitalAmountValue.value = availableForProgram.value - newWallet;

  // Обновляем процент слайдера
  if (maxWalletAmount.value > 0) {
    const calculatedPercentage = ((maxWalletAmount.value - newWallet) / maxWalletAmount.value) * 100;
    sliderPercentage.value = Math.max(0, Math.min(100, calculatedPercentage));
  }
});

// Watch на сумму программы - обновляем кошелек
watch(capitalAmountValue, (newCapital) => {
  if (!canMoveSlider.value) return;

  const newWallet = availableForProgram.value - newCapital;
  if (newWallet !== walletAmountValue.value) {
    walletAmountValue.value = Math.max(0, Math.min(newWallet, maxWalletAmount.value));
  }
});

// Цвет слайдера в зависимости от положения
const sliderColor = computed(() => {
  if (!canMoveSlider.value) return 'grey';
  // Красный: только когда все в кошелек (0%)
  if (sliderPercentage.value < 38) return 'red';
  // Teal: любое смещение вправо (1-100%)
  return 'teal';
});

// Цвет selection (трека) слайдера
const sliderSelectionColor = computed(() => {
  if (!canMoveSlider.value) return 'grey-4';
  if (sliderPercentage.value < 38) return 'red';
  return 'teal';
});

// Подсказка для слайдера
const sliderLabel = computed(() => {
  return `${Math.round(sliderPercentage.value)}%`;
});

// Валидация распределения (как в контракте)
const isValidDistribution = computed(() => {
  const total = walletAmountValue.value + capitalAmountValue.value;
  // total_convert == available_for_program
  const totalMatches = Math.abs(total - availableForProgram.value) < 1;
  // wallet_amount <= available_for_wallet
  const walletValid = walletAmountValue.value <= availableForWallet.value;
  // capital_amount == available_for_program - wallet_amount
  const capitalValid = Math.abs(capitalAmountValue.value - (availableForProgram.value - walletAmountValue.value)) < 1;

  return totalMatches && walletValid && capitalValid;
});

// Форматирование сумм
const formatAmount = (amount: number) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Инициализация значений при открытии диалога
watch(isOpen, (newValue) => {
  if (newValue) {
    if (!canMoveSlider.value) {
      // Если нельзя таскать слайдер - все в программу
      sliderPercentage.value = 100;
      walletAmountValue.value = 0;
      capitalAmountValue.value = availableForProgram.value;
    } else {
      // По умолчанию все доступное в кошелек (0% на слайдере)
      sliderPercentage.value = 0;
      walletAmountValue.value = maxWalletAmount.value;
      capitalAmountValue.value = availableForProgram.value - walletAmountValue.value;
    }
  }
});

// Получение доли
const handleConvert = async () => {
  if (!isValidDistribution.value) return;

  loading.value = true;
  try {
    // Генерируем документ, подписываем и конвертируем сегмент
    // capital_amount для контракта = то что пользователь распределил + investor_base (уже в _capital_program)
    // Контракт ожидает: wallet_amount + capital_amount == total_segment_cost - debt_amount
    const updatedSegment = await convertSegmentWithDocumentGeneration({
      coopname: props.segment.coopname,
      username: props.segment.username,
      project_hash: props.segment.project_hash,
      wallet_amount: walletAmountValue.value,
      capital_amount: capitalAmountValue.value,
    });

    // Обновляем сегмент в сторе, если он был возвращен
    if (updatedSegment) {
      segmentStore.addSegmentToList(props.segment.project_hash, updatedSegment);
      SuccessAlert('Доля в объекте интеллектуальной собственности успешно получена');
      isOpen.value = false;
    } else {
      throw new Error('Не удалось получить обновленную долю после конвертации');
    }
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.modal-convert-segment {
  min-width: 600px;
  max-width: 800px;
}

.modal-header {
  background: var(--q-primary);
  color: white;
}

.modal-body {
  padding: 24px;
}

.inputs-section {
  .q-input {
    max-width: 200px;
  }
}

.modal-actions {
  padding: 16px 24px;
  background: var(--q-grey-1);
}

.card-input {
  margin-top: 8px;
}

.distribution-section {
  padding: 20px;
  background: var(--q-grey-2);
  border-radius: 8px;
}

.distribution-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.distribution-label {
  margin-top: 4px;
}

.distribution-value {
  margin-top: 2px;
}

.return-notice {
  padding: 16px;
  background: var(--q-orange-1);
  border-radius: 8px;
  border: 1px solid var(--q-orange-2);
}

.card-value {
  font-size: 16px;
  font-weight: 500;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}

.card-label {
  font-size: var(--p-fs-body);
  color: var(--p-ink-2);
  margin-bottom: var(--p-1);
}
</style>
