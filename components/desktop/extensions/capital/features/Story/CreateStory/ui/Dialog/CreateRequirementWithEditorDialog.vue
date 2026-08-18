<template lang="pug">
CreateDialog(
  ref="dialogRef"
  title="Создать артефакт"
  submit-text="Создать"
  dialog-style="width: 720px; max-width: 100% !important;"
  :is-submitting="isSubmitting"
  :disabled="!canCreate"
  @submit="handleSubmit"
  @dialog-closed="clear"
)
  template(#form-fields)

    .create-requirement-form
      .crf-block
        BaseInput(
          autofocus
          v-model='formData.title'
          label='Заголовок'
          placeholder='Кратко сформулируйте артефакт'
          autocomplete='off'
          @keydown='handleTitleKeydown'
        )

      //- Только заголовок и тип: содержимое пишется после создания
      //- в полноэкранном редакторе, который открывается сам
      .crf-block
        .crf-toggle-shell
          q-btn-toggle.crf-toggle(
            v-model="contentFormat"
            no-caps
            dense
            unelevated
            toggle-color="primary"
            :options="contentFormatOptions"
          )

EditRequirementDialog(
  ref="followUpEditRef"
  :requirement="storyForFollowUpEdit"
  :canEdit="true"
  @close="onFollowUpClose"
  @updated="onFollowUpUpdated"
)
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { BaseInput } from 'src/shared/ui/base';
import { useCreateStory } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { EditRequirementDialog } from 'app/extensions/capital/features/Story/EditRequirement';
import type { IStory } from 'app/extensions/capital/entities/Story/model';

const props = defineProps<{
  filter?: {
    project_hash?: string;
    /** Хеш задачи — артефакт привязывается к задаче и не аккумулируется на проекте/компоненте */
    issue_hash?: string;
    /** @deprecated legacy: используйте issue_hash */
    issue_id?: string;
  };
}>();

const emit = defineEmits<{
  success: [];
  error: [error: unknown];
}>();

const dialogRef = ref();
const followUpEditRef = ref();
const system = useSystemStore();
const { createStory } = useCreateStory();

const markdownFormat = Zeus.CapitalStoryContentFormat.MARKDOWN;
const mermaidFormat = Zeus.CapitalStoryContentFormat.MERMAID;
const bpmnFormat = Zeus.CapitalStoryContentFormat.BPMN;
const drawioFormat = Zeus.CapitalStoryContentFormat.DRAWIO;
const contentFormat = ref<Zeus.CapitalStoryContentFormat>(markdownFormat);
const contentFormatOptions = [
  { label: 'Markdown', value: markdownFormat, icon: 'description' },
  { label: 'BPMN', value: bpmnFormat, icon: 'account_tree' },
  { label: 'Draw.io', value: drawioFormat, icon: 'device_hub' },
  { label: 'Mermaid', value: mermaidFormat, icon: 'schema' },
];

const storyForFollowUpEdit = ref<IStory | null>(null);

const isSubmitting = ref(false);

const formData = ref({
  title: '',
});

const canCreate = computed(() => {
  return formData.value.title.trim().length > 0;
});

const clearForm = async () => {
  formData.value = {
    title: '',
  };
  contentFormat.value = markdownFormat;
  await nextTick();
};

const clear = async () => {
  await clearForm();
};

const onFollowUpClose = () => {
  storyForFollowUpEdit.value = null;
};

const onFollowUpUpdated = (updated: IStory) => {
  storyForFollowUpEdit.value = updated;

};

const handleSubmit = async () => {
  isSubmitting.value = true;
  try {
    // Содержимое всегда пишется после создания: тело пустое (диаграммным
    // форматам сервер подставляет шаблон), сразу открывается полноэкранный редактор
    const inputData = {
      coopname: system.info.coopname,
      title: formData.value.title,
      description: '',
      content_format: contentFormat.value,
      story_hash: '',
      ...props.filter,
    };

    const created = await createStory(inputData);

    SuccessAlert('Артефакт успешно создан');

    dialogRef.value?.clear();
    emit('success');

    storyForFollowUpEdit.value = created;
    await nextTick();
    followUpEditRef.value?.openDialog();
  } catch (error) {
    FailAlert(error);
    emit('error', error);
  } finally {
    isSubmitting.value = false;
  }
};

const handleTitleKeydown = (e: KeyboardEvent): void => {
  if (e.key !== 'Enter') return;
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  void handleSubmit();
};

defineExpose({
  openDialog: () => dialogRef.value?.openDialog(),
  clear: () => dialogRef.value?.clear(),
});
</script>

<style lang="scss" scoped>
.create-requirement-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

/* Выбор формата — компактный сегмент-контрол, не полоса на всю ширину */
.crf-toggle-shell {
  display: inline-flex;
  padding: var(--p-1);
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
}

.crf-toggle :deep(.q-btn) {
  min-height: 32px;
  padding: 2px 12px;
}

</style>
