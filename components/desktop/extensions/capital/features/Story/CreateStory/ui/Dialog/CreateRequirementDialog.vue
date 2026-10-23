<template lang="pug">
CreateDialog(
  ref="dialogRef"
  :title="$t('capital.createRequirementDialog.title')"
  :submit-text="$t('common.action.create')"
  dialog-style="width: 500px; max-width: 100% !important;"
  :is-submitting="isSubmitting"
  :disabled="!canCreate"
  @submit="handleSubmit"
  @dialog-closed="clear"
)
  template(#form-fields)

    .create-requirement-form
      .crf-block
        .crf-block__head
          .crf-block__title.text-weight-medium {{ $t('capital.createRequirementDialog.formatLabel') }}
          .crf-block__caption.text-grey-7 {{ $t('capital.createRequirementDialog.formatHint') }}
        .crf-toggle-shell.q-pa-xs.rounded-borders
          q-btn-toggle.crf-toggle(
            v-model="contentFormat"
            spread
            no-caps
            dense
            rounded
            unelevated
            toggle-color="primary"
            :options="contentFormatOptions"
          )

      .crf-block
        q-input.crf-input(
          ref='titleInput'
          autofocus
          outlined
          v-model='formData.title'
          :label='$t("capital.createRequirementDialog.essenceLabel")'
          :hint='$t("capital.createRequirementDialog.essenceHint")'
          :rules='[(val) => notEmpty(val)]'
          autocomplete='off'
          @keydown='handleTitleKeydown'
        )

      .crf-extras
        q-checkbox.crf-checkbox(
          v-model='createAnother'
          dense
          :label='$t("capital.createRequirementDialog.createAnotherLabel")'
        )
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { useCreateStory } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { Zeus } from '@coopenomics/sdk';
import { t } from '../../../../../i18n';

const props = defineProps<{
  filter?: {
    project_hash?: string;
    issue_id?: string;
  };
  canCreate?: boolean;
}>();

const canCreate = computed(() => props.canCreate ?? true);

const emit = defineEmits<{
  success: [];
  error: [error: any];
}>();

const dialogRef = ref();
const titleInput = ref();
const system = useSystemStore();
const { createStory } = useCreateStory();

const createAnother = ref(false);
const isSubmitting = ref(false);

const markdownFormat = Zeus.CapitalStoryContentFormat.MARKDOWN;
const contentFormat = ref<Zeus.CapitalStoryContentFormat>(markdownFormat);
const contentFormatOptions = [
  { label: 'Markdown', value: markdownFormat },
  { label: 'BPMN', value: Zeus.CapitalStoryContentFormat.BPMN },
  { label: 'Draw.io', value: Zeus.CapitalStoryContentFormat.DRAWIO },
  { label: 'Mermaid', value: Zeus.CapitalStoryContentFormat.MERMAID },
];

const formData = ref({
  title: '',
  description: '',
});

const notEmpty = (val: any) => {
  return !!val || t('capital.createRequirementDialog.requiredFieldError');
};

const handleTitleKeydown = (e: KeyboardEvent): void => {
  if (e.key !== 'Enter') return;
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  void handleSubmit();
};

const clearForm = async () => {
  formData.value = {
    title: '',
    description: '',
  };
  contentFormat.value = markdownFormat;

  // Сбрасываем валидацию
  titleInput.value?.resetValidation();

  // Устанавливаем фокус на первое поле после очистки
  await nextTick();
  titleInput.value?.focus();
};

const clear = async () => {
  await clearForm();
  createAnother.value = false;
};

const handleSubmit = async () => {
  isSubmitting.value = true;
  try {
    const isBpmn = contentFormat.value === Zeus.CapitalStoryContentFormat.BPMN;
    const isDrawio = contentFormat.value === Zeus.CapitalStoryContentFormat.DRAWIO;
    const isMermaid = contentFormat.value === Zeus.CapitalStoryContentFormat.MERMAID;
    const inputData = {
      coopname: system.info.coopname,
      title: formData.value.title,
      description: isBpmn || isDrawio || isMermaid ? '' : formData.value.description,
      content_format: contentFormat.value,
      story_hash: '',
      ...props.filter, // Добавляем фильтр (project_hash или issue_id)
    };

    await createStory(inputData);

    SuccessAlert(t('capital.createRequirementDialog.success'));

    if (createAnother.value) {
      // Очищаем форму для создания следующего артефакта
      clearForm();
      // Диалог остается открытым
    } else {
      // Закрываем диалог после успешного создания
      dialogRef.value?.clear();
      emit('success');
    }
  } catch (error) {
    FailAlert(error);
    emit('error', error);
  } finally {
    isSubmitting.value = false;
  }
};

// Экспортируем функции для внешнего использования
defineExpose({
  openDialog: () => dialogRef.value?.openDialog(),
  clear: () => dialogRef.value?.clear(),
});
</script>

<style lang="scss" scoped>
.create-requirement-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.crf-block__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.crf-block__title {
  font-size: 0.9375rem;
  line-height: 1.35;
}

.crf-block__caption {
  font-size: 0.8125rem;
  line-height: 1.45;
}

.crf-toggle-shell {
  border: 1px solid rgba(127, 127, 127, 0.22);
}

.crf-toggle-shell :deep(.q-btn) {
  min-height: 36px;
}

.crf-input :deep(.q-field__native) {
  line-height: 1.45;
}

.crf-extras {
  margin-top: 0.125rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(127, 127, 127, 0.22);
}
</style>
