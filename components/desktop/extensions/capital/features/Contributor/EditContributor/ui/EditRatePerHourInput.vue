<template lang="pug">
ColorCard(color='orange' :transparent="true")
  .card-label Стоимость часа
  template(v-if="!isEditing")
    .card-value(:class="{ 'cursor-pointer': isOwnProfile }" @click="isOwnProfile ? startEditing() : null")
      template(v-if="isOwnProfile")
        q-icon(
          name="edit"
          size="16px"
          color="grey-6"
          style="margin-right: 8px;"
        )
      | {{ hasRate ? formattedRate : 'Не указано' }}
  template(v-else)
    .q-pa-sm
      q-input(
        v-model="localRate"
        type="number"
        label="Стоимость часа"
        outlined
        min="0"
        max="3000"
        step="0.01"
        :rules="[val => !val || (val >= 0 && val <= 3000) || 'От 0 до 3000']"
        dense
      )
        template(#append)
          .text-body2 RUB
      .row.q-gutter-sm.q-mt-sm.justify-end
        q-btn(
          flat
          dense
          label="Отмена"
          color="grey-7"
          @click="cancelEditing"
        )
        q-btn(
          color="primary"
          dense
          label="Сохранить"
          :loading="isSaving"
          :disable="!hasChanges"
          @click="saveRate"
        )
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useEditContributor } from '../model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useSessionStore } from 'src/entities/Session/model';
import { useSystemStore } from 'src/entities/System/model';
import { ColorCard } from 'src/shared/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

const emit = defineEmits<{
  'rate-updated': [];
}>();

const contributorStore = useContributorStore();
const { username } = useSessionStore();
const { info } = useSystemStore();
const { editContributor, isLoading } = useEditContributor();

const isEditing = ref(false);
const localRate = ref<string>('');
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

// Проверяем, есть ли изменения
const hasChanges = computed(() => {
  if (!localRate.value.trim()) return false;

  const currentRate = contributorStore.self?.rate_per_hour || '';
  const currentNumeric = currentRate.split(' ')[0];
  const localNumeric = parseFloat(localRate.value.trim());

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
  try {
    const formattedRate = formatRateForBackend(localRate.value);

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
