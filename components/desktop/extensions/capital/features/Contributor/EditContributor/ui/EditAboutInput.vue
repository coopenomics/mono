<template lang="pug">
ColorCard
  .card-label О себе
  template(v-if="!isEditing")
    .card-value(:class="{ 'cursor-pointer': isOwnProfile }" :style="{ 'white-space': 'pre-line' }" @click="isOwnProfile ? startEditing() : null")
      template(v-if="isOwnProfile")
        q-icon(
          name="edit"
          size="16px"
          color="grey-6"
          style="margin-right: 8px;"
        )
      | {{ hasAbout ? contributorStore.self?.about : 'Не указано' }}
  template(v-else)
    .q-pa-sm
      q-input(
        v-model="localAbout"
        type="textarea"
        label="Расскажите о себе и чем можете быть полезны кооперативу"
        outlined
        rows="3"
        :rules="[val => !val || val.length <= 1000 || 'Максимум 1000 символов']"
        dense
        autogrow
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
          @click="saveAbout"
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
  'about-updated': [];
}>();

const contributorStore = useContributorStore();
const { username } = useSessionStore();
const { editContributor, isLoading } = useEditContributor();

const isEditing = ref(false);
const localAbout = ref('');
const isSaving = computed(() => isLoading.value);

// Проверяем, является ли это профилем текущего пользователя
const isOwnProfile = computed(() => {
  return contributorStore.self?.username === username;
});

// Проверяем, есть ли информация "О себе"
const hasAbout = computed(() => {
  return contributorStore.self?.about && contributorStore.self.about.trim().length > 0;
});

// Проверяем, есть ли изменения
const hasChanges = computed(() => {
  const currentAbout = contributorStore.self?.about || '';
  return localAbout.value.trim() !== currentAbout.trim();
});

// Начинаем редактирование
const startEditing = () => {
  localAbout.value = contributorStore.self?.about || '';
  isEditing.value = true;
};

// Отменяем редактирование
const cancelEditing = () => {
  isEditing.value = false;
  localAbout.value = '';
};

// Сохраняем изменения
const saveAbout = async () => {
  try {
    const aboutValue = localAbout.value.trim() || undefined;

    // Отправляем все текущие значения из store + новое значение about
    await editContributor({
      about: aboutValue,
      hours_per_day: contributorStore.self?.hours_per_day,
      rate_per_hour: contributorStore.self?.rate_per_hour,
    });

    SuccessAlert('Информация о себе успешно обновлена');
    isEditing.value = false;

    // Уведомляем родительский компонент
    emit('about-updated');
  } catch (error) {
    console.error('Ошибка при обновлении информации о себе:', error);
    FailAlert(error, 'Не удалось обновить информацию о себе');
  }
};

// Следим за изменениями в store и сбрасываем локальное состояние
watch(() => contributorStore.self?.about, (newAbout) => {
  if (!isEditing.value) {
    localAbout.value = newAbout || '';
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
