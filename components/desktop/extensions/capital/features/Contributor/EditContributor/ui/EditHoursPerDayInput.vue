<template lang="pug">
.edit-field
  .edit-field__view
    span.edit-field__icon
      q-icon(name='schedule', size='20px')
    .edit-field__main
      template(v-if='!isEditing')
        .edit-field__head
          span.t-sm.t-muted Часов в день
          BaseButton(
            v-if='isOwnProfile',
            variant='ghost',
            size='sm',
            icon-only,
            aria-label='Редактировать количество часов в день',
            @click='startEditing'
          )
            template(#icon-left)
              q-icon(name='edit', size='16px')
        .edit-field__value(:class='{ "t-muted": !hasHours }') {{ hasHours ? contributorStore.self?.hours_per_day : 'Не указано' }}
      template(v-else)
        BaseForm(:loading='isSaving', @submit='saveHours')
          BaseInput(
            v-model.number='localHours',
            type='number',
            label='Часов в день',
            :error='hoursError'
          )
          template(#footer)
            BaseButton(variant='ghost', size='sm', @click='cancelEditing') Отмена
            BaseButton(
              variant='primary',
              size='sm',
              type='submit',
              :loading='isSaving',
              :disabled='!hasChanges || !!hoursError'
            ) Сохранить
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useEditContributor } from '../model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useSessionStore } from 'src/entities/Session/model';
import { BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';

const emit = defineEmits<{
  'hours-updated': [];
}>();

const contributorStore = useContributorStore();
const { username } = useSessionStore();
const { editContributor, isLoading } = useEditContributor();

const isEditing = ref(false);
const localHours = ref<number | undefined>();
const isSaving = computed(() => isLoading.value);

// Проверяем, является ли это профилем текущего пользователя
const isOwnProfile = computed(() => {
  return contributorStore.self?.username === username;
});

// Проверяем, есть ли информация о часах
const hasHours = computed(() => {
  return contributorStore.self?.hours_per_day && contributorStore.self.hours_per_day > 0;
});

// Валидация диапазона
const hoursError = computed(() => {
  if (localHours.value === undefined || localHours.value === null) return undefined;
  return localHours.value >= 1 && localHours.value <= 8
    ? undefined
    : 'От 1 до 8 часов';
});

// Проверяем, есть ли изменения
const hasChanges = computed(() => {
  const currentHours = contributorStore.self?.hours_per_day;
  return localHours.value !== currentHours;
});

// Начинаем редактирование
const startEditing = () => {
  localHours.value = contributorStore.self?.hours_per_day ?? undefined;
  isEditing.value = true;
};

// Отменяем редактирование
const cancelEditing = () => {
  isEditing.value = false;
  localHours.value = undefined;
};

// Сохраняем изменения
const saveHours = async () => {
  if (hoursError.value) return;
  try {
    // Отправляем все текущие значения из store + новое значение hours_per_day
    await editContributor({
      about: contributorStore.self?.about,
      hours_per_day: localHours.value,
      rate_per_hour: contributorStore.self?.rate_per_hour,
    });

    SuccessAlert('Количество часов успешно обновлено');
    isEditing.value = false;

    // Уведомляем родительский компонент
    emit('hours-updated');
  } catch (error) {
    console.error('Ошибка при обновлении количества часов:', error);
    FailAlert(error, 'Не удалось обновить количество часов');
  }
};

// Следим за изменениями в store и сбрасываем локальное состояние
watch(() => contributorStore.self?.hours_per_day, (newHours) => {
  if (!isEditing.value) {
    localHours.value = newHours ?? undefined;
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
