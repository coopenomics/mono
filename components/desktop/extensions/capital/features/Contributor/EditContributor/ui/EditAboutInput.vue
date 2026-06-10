<template lang="pug">
.edit-field
  template(v-if='!isEditing')
    .edit-field__view
      .edit-field__main
        .edit-field__label.t-sm.t-muted О себе
        .edit-field__value(:class='{ "t-muted": !hasAbout }') {{ hasAbout ? contributorStore.self?.about : 'Не указано' }}
      BaseButton(
        v-if='isOwnProfile',
        variant='ghost',
        size='sm',
        icon-only,
        aria-label='Редактировать информацию о себе',
        @click='startEditing'
      )
        template(#icon-left)
          q-icon(name='edit', size='18px')
  template(v-else)
    BaseForm(:loading='isSaving', @submit='saveAbout')
      BaseInput(
        v-model='localAbout',
        type='textarea',
        autogrow,
        label='Расскажите о себе и чем можете быть полезны кооперативу',
        :error='aboutError'
      )
      template(#footer)
        BaseButton(variant='ghost', size='sm', @click='cancelEditing') Отмена
        BaseButton(
          variant='primary',
          size='sm',
          type='submit',
          :loading='isSaving',
          :disabled='!hasChanges || !!aboutError'
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

// Валидация длины текста
const aboutError = computed(() =>
  localAbout.value.length > 1000 ? 'Максимум 1000 символов' : undefined,
);

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
  if (aboutError.value) return;
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
.edit-field__view {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
}

.edit-field__main {
  flex: 1;
  min-width: 0;
}

.edit-field__label {
  margin-bottom: var(--p-1);
}

.edit-field__value {
  white-space: pre-line;
}
</style>
