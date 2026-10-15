<template lang="pug">
.edit-field
  .edit-field__view
    span.edit-field__icon
      q-icon(name='notes', size='20px')
    .edit-field__main
      template(v-if='!isEditing')
        .edit-field__head
          span.t-sm.t-muted {{ $t('capital.editAboutInput.label') }}
          BaseButton(
            v-if='isOwnProfile',
            variant='ghost',
            size='sm',
            icon-only,
            :aria-label='$t("capital.editAboutInput.editAriaLabel")',
            @click='startEditing'
          )
            template(#icon-left)
              q-icon(name='edit', size='16px')
        .edit-field__value(:class='{ "t-muted": !hasAbout }') {{ hasAbout ? contributorStore.self?.about : $t('capital.editAboutInput.notSpecified') }}
      template(v-else)
        BaseForm(:loading='isSaving', @submit='saveAbout')
          BaseInput(
            v-model='localAbout',
            type='textarea',
            autogrow,
            :label='$t("capital.editAboutInput.inputLabel")',
            :error='aboutError'
          )
          template(#footer)
            BaseButton(variant='ghost', size='sm', @click='cancelEditing') {{ $t('common.action.cancel') }}
            BaseButton(
              variant='primary',
              size='sm',
              type='submit',
              :loading='isSaving',
              :disabled='!hasChanges || !!aboutError'
            ) {{ $t('common.action.save') }}
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useEditContributor } from '../model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useSessionStore } from 'src/entities/Session/model';
import { BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';
import { t } from '../../../../i18n';

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
  localAbout.value.length > 1000 ? t('capital.editAboutInput.maxLengthHint') : undefined,
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

    SuccessAlert(t('capital.editAboutInput.updateSuccess'));
    isEditing.value = false;

    // Уведомляем родительский компонент
    emit('about-updated');
  } catch (error) {
    console.error('Ошибка при обновлении информации о себе:', error);
    FailAlert(error, t('capital.editAboutInput.updateError'));
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
  white-space: pre-line;
  font-weight: 500;
}
</style>
