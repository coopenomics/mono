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
          hint='Ctrl+Enter или ⌘+Enter — создать артефакт.'
          autocomplete='off'
          @keydown='handleTitleKeydown'
        )

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


      template(v-if="contentFormat === markdownFormat")
        .crf-block
          .crf-block__head
            .crf-block__title.text-weight-medium Описание
            .crf-block__caption Markdown: списки, выделение, ссылки — как в обычной документации.
          .crf-editor-frame
            Editor(
              v-model='formData.description'
              placeholder='Опишите артефакт подробно...'
              :minHeight="240"
              :padded="false"
              :show-focus-ring="true"
            )

      template(v-else-if="contentFormat === mermaidFormat")
        .crf-block
          .crf-block__head
            .crf-block__title.text-weight-medium Диаграмма Mermaid
            .crf-block__caption Редактор текста и предпросмотр. Пустое тело при создании заменится минимальным шаблоном на сервере.
          .crf-editor-frame
            MermaidStoryEditor(
              v-model="formData.description"
              :min-height="240"
            )

      template(v-else-if="contentFormat === bpmnFormat")
        .crf-block
          .banner.banner--info
            q-icon.banner__icon(name="info")
            .banner__body Тело диаграммы создаётся автоматически. После нажатия «Создать» откроется редактор BPMN — там можно нарисовать процесс.

      template(v-else-if="contentFormat === drawioFormat")
        .crf-block
          .banner.banner--info
            q-icon.banner__icon(name="info")
            .banner__body Пустая диаграмма Draw.io подставится на сервере. После «Создать» откроется редактор diagrams.net во встроенном режиме.

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
import { Editor } from 'src/shared/ui';
import { BaseInput } from 'src/shared/ui/base';
import { useCreateStory } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { EditRequirementDialog } from 'app/extensions/capital/features/Story/EditRequirement';
import { MermaidStoryEditor } from 'app/extensions/capital/features/Story/MermaidStoryEditor';
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
  description: '',
});

const canCreate = computed(() => {
  return formData.value.title.trim().length > 0;
});

const clearForm = async () => {
  formData.value = {
    title: '',
    description: '',
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
    const isBpmn = contentFormat.value === Zeus.CapitalStoryContentFormat.BPMN;
    const isDrawio = contentFormat.value === Zeus.CapitalStoryContentFormat.DRAWIO;
    const inputData = {
      coopname: system.info.coopname,
      title: formData.value.title,
      description: isBpmn || isDrawio ? '' : formData.value.description,
      content_format: contentFormat.value,
      story_hash: '',
      ...props.filter,
    };

    const created = await createStory(inputData);

    SuccessAlert('Артефакт успешно создан');

    dialogRef.value?.clear();
    emit('success');

    if (
      created.content_format === Zeus.CapitalStoryContentFormat.BPMN ||
      created.content_format === Zeus.CapitalStoryContentFormat.DRAWIO ||
      created.content_format === Zeus.CapitalStoryContentFormat.MERMAID
    ) {
      storyForFollowUpEdit.value = created;
      await nextTick();
      followUpEditRef.value?.openDialog();
    }
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

.crf-block__head {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  margin-bottom: var(--p-2);
}

.crf-block__title {
  font-size: var(--p-fs-body-sm);
  line-height: 1.35;
}

.crf-block__caption {
  font-size: var(--p-fs-meta);
  line-height: 1.45;
  color: var(--p-ink-2);
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

.crf-editor-frame {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  overflow: visible;
}
</style>
