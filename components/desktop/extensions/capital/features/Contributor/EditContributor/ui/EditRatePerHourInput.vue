<template lang="pug">
.edit-field
  .edit-field__view
    span.edit-field__icon
      q-icon(name='payments', size='20px')
    .edit-field__main
      template(v-if='!isEditing')
        .edit-field__head
          span.t-sm.t-muted Стоимость часа
          BaseButton(
            v-if='isOwnProfile',
            variant='ghost',
            size='sm',
            icon-only,
            aria-label='Редактировать стоимость часа',
            @click='startEditing'
          )
            template(#icon-left)
              q-icon(name='edit', size='16px')
        .edit-field__value.t-mono(:class='{ "t-muted": !hasRate }') {{ hasRate ? formattedRate : 'Не указано' }}
      template(v-else)
        BaseForm(:loading='isSaving', @submit='saveRate')
          AmountInput(
            v-model='localRate',
            label='Стоимость часа',
            placeholder='0,00',
            :symbol='governSymbol',
            :precision='2',
            :min='0',
            :max='3000',
            :error='rateError'
          )
          template(#footer)
            BaseButton(variant='ghost', size='sm', @click='cancelEditing') Отмена
            BaseButton(
              variant='primary',
              size='sm',
              type='submit',
              :loading='isSaving',
              :disabled='!hasChanges || !!rateError'
            ) Сохранить
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useEditContributor } from '../model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useSessionStore } from 'src/entities/Session/model';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton, BaseForm } from 'src/shared/ui/base';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

const emit = defineEmits<{
  'rate-updated': [];
}>();

const contributorStore = useContributorStore();
const { username } = useSessionStore();
const { info } = useSystemStore();
const { editContributor, isLoading } = useEditContributor();

const isEditing = ref(false);
// AmountInput эмитит number | null
const localRate = ref<number | string | null>('');
const isSaving = computed(() => isLoading.value);

const governSymbol = computed(() => info.symbols.root_govern_symbol);

// Проверяем, является ли это профилем текущего пользователя
const isOwnProfile = computed(() => {
  return contributorStore.self?.username === username;
});

// Проверяем, есть ли информация о ставке
const hasRate = computed(() => {
  return contributorStore.self?.rate_per_hour && contributorStore.self.rate_per_hour.trim().length > 0;
});

// Форматированная ставка для отображения
const formattedRate = computed(() => {
  if (!hasRate.value || !contributorStore.self || !contributorStore.self.rate_per_hour) return '';
  return formatAsset2Digits(contributorStore.self.rate_per_hour);
});

// Валидация диапазона
const rateError = computed(() => {
  if (!localRate.value || !localRate.value.toString().trim()) return undefined;
  const numericValue = parseFloat(localRate.value.toString());
  if (isNaN(numericValue)) return 'Введите число';
  return numericValue >= 0 && numericValue <= 3000 ? undefined : 'От 0 до 3000';
});

// Проверяем, есть ли изменения
const hasChanges = computed(() => {
  if (!localRate.value || !localRate.value.toString().trim()) return false;

  const currentRate = contributorStore.self?.rate_per_hour || '';
  const currentNumeric = currentRate.split(' ')[0];
  const localNumeric = parseFloat(localRate.value.toString().trim());

  if (!currentNumeric || isNaN(localNumeric)) return true;

  // Сравниваем числовые значения с точностью 2 знака
  return Math.abs(parseFloat(currentNumeric) - localNumeric) > 0.01;
});

// Начинаем редактирование
const startEditing = () => {
  const currentRate = contributorStore.self?.rate_per_hour || '';
  // Извлекаем числовое значение из строки вида "100.0000 TOKEN"
  const numericValue = currentRate.split(' ')[0];
  if (numericValue && !isNaN(parseFloat(numericValue))) {
    // Отображаем с 2 знаками после запятой для удобства редактирования
    localRate.value = parseFloat(numericValue).toFixed(2);
  } else {
    localRate.value = '';
  }
  isEditing.value = true;
};

// Отменяем редактирование
const cancelEditing = () => {
  isEditing.value = false;
  localRate.value = '';
};

// Форматируем ставку для отправки на бэкенд (всегда 4 знака)
const formatRateForBackend = (rate: string): string | undefined => {
  if (!rate || rate.trim() === '') return undefined;

  const numericValue = parseFloat(rate.trim());
  if (isNaN(numericValue)) return undefined;

  return `${numericValue.toFixed(4)} ${governSymbol.value}`;
};

// Сохраняем изменения
const saveRate = async () => {
  if (rateError.value) return;
  try {
    const formattedRate = formatRateForBackend(String(localRate.value ?? ''));

    // Отправляем все текущие значения из store + новое значение rate_per_hour
    await editContributor({
      about: contributorStore.self?.about,
      hours_per_day: contributorStore.self?.hours_per_day,
      rate_per_hour: formattedRate,
    });

    SuccessAlert('Ставка за час успешно обновлена');
    isEditing.value = false;

    // Уведомляем родительский компонент
    emit('rate-updated');
  } catch (error) {
    console.error('Ошибка при обновлении ставки за час:', error);
    FailAlert(error, 'Не удалось обновить ставку за час');
  }
};

// Следим за изменениями в store и сбрасываем локальное состояние
watch(() => contributorStore.self?.rate_per_hour, (newRate) => {
  if (!isEditing.value) {
    const numericValue = newRate?.split(' ')[0] || '';
    localRate.value = numericValue && !isNaN(parseFloat(numericValue)) ? numericValue : '';
  }
}, { immediate: true });
</script>

<style lang="scss" scoped>
.edit-field__view {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
}

.edit-field__icon {
  width: var(--p-8);
  height: var(--p-8);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--p-r-sm);
  background: var(--p-canvas-2);
  color: var(--p-ink-2);
}

.edit-field__main {
  flex: 1;
  min-width: 0;
}

.edit-field__head {
  display: flex;
  align-items: center;
  gap: var(--p-1);
}

.edit-field__value {
  font-size: var(--p-fs-h3);
  font-weight: 600;
}
</style>
