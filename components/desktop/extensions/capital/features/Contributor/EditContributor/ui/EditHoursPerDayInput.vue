<template lang="pug">
ColorCard(color='blue' :transparent="true")
  .card-label Часов в день
  template(v-if="!isEditing")
    .card-value(:class="{ 'cursor-pointer': isOwnProfile }" @click="isOwnProfile ? startEditing() : null")
      template(v-if="isOwnProfile")
        q-icon(
          name="edit"
          size="16px"
          color="grey-6"
          style="margin-right: 8px;"
        )
      | {{ hasHours ? contributorStore.self?.hours_per_day : 'Не указано' }}
  template(v-else)
    .q-pa-sm
      q-input(
        v-model.number="localHours"
        type="number"
        label="Часов в день"
        outlined
        min="1"
        max="8"
        step="1"
        :rules="[val => !val || (val >= 1 && val <= 8) || 'От 1 до 24 часов']"
        dense
      )
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
          @click="saveHours"
        )
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useEditContributor } from '../model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useSessionStore } from 'src/entities/Session/model';
import { ColorCard } from 'src/shared/ui';

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
