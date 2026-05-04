<template lang="pug">
CreateDialog(
  maximized
  ref="dialogRef"
  title="Создать артефакт"
  submit-text="Создать"
  :is-submitting="isSubmitting"
  :disabled="!canCreate"
  @submit="handleSubmit"
  @dialog-closed="clear"
)
  template(#form-fields)

    .create-requirement-form
      .crf-block
        q-input.crf-input(
          ref='titleInput'
          autofocus
          outlined
          v-model='formData.title'
          label='Заголовок'
          placeholder='Кратко сформулируйте артефакт'
          hint='Ctrl+Enter или ⌘+Enter — создать артефакт.'
          :rules='[(val) => notEmpty(val)]'
          autocomplete='off'
          @keydown='handleTitleKeydown'
        )

      .crf-block
        .crf-toggle-shell.q-pa-xs.rounded-borders
          q-btn-toggle.crf-toggle(
            v-model="contentFormat"
            spread
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
            .crf-block__caption.text-grey-7 Markdown: списки, выделение, ссылки — как в обычной документации.
          .crf-editor-frame(ref="createMarkdownFrameRef")
            span.editor-viewport-anchor(ref="createMarkdownTopRef" aria-hidden="true")
            Editor(
              v-model='formData.description'
              placeholder='Опишите артефакт подробно...'
              :minHeight="createMarkdownMinHeight"
              :padded="false"
              :show-focus-ring="true"
            )

      template(v-else-if="contentFormat === mermaidFormat")
        .crf-block
          .crf-block__head
            .crf-block__title.text-weight-medium Диаграмма Mermaid
            .crf-block__caption.text-grey-7 Редактор текста и предпросмотр. Пустое тело при создании заменится минимальным шаблоном на сервере.
          .crf-editor-frame
            MermaidStoryEditor(
              v-model="formData.description"
              :min-height="300"
            )

      template(v-else-if="contentFormat === bpmnFormat")
        .crf-block
          .crf-bpmn-note.q-pa-md.rounded-borders.bg-grey-2
            .row.no-wrap.items-start.q-gutter-sm
              q-icon(name="info" color="primary" size="22px").crf-bpmn-note__icon
              .col.text-body2.text-grey-8
                | Тело диаграммы создаётся автоматически. После нажатия «Создать» откроется редактор BPMN — там можно нарисовать процесс.

      template(v-else-if="contentFormat === drawioFormat")
        .crf-block
          .crf-bpmn-note.q-pa-md.rounded-borders.bg-grey-2
            .row.no-wrap.items-start.q-gutter-sm
              q-icon(name="info" color="primary" size="22px").crf-bpmn-note__icon
              .col.text-body2.text-grey-8
                | Пустая диаграмма Draw.io подставится на сервере. После «Создать» откроется редактор diagrams.net во встроенном режиме.

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
import { useEditorViewportMinHeight } from 'src/shared/lib/composables/useEditorViewportMinHeight';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { Editor } from 'src/shared/ui';
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
const titleInput = ref();
const followUpEditRef = ref();
const createMarkdownFrameRef = ref<HTMLElement | null>(null);
const createMarkdownTopRef = ref<HTMLElement | null>(null);
const createMarkdownMinHeight = useEditorViewportMinHeight(createMarkdownTopRef, {
  observeRef: createMarkdownFrameRef,
  min: 280,
  bottomGap: 48,
});
const system = useSystemStore();
const { createStory } = useCreateStory();

const markdownFormat = Zeus.CapitalStoryContentFormat.MARKDOWN;
const mermaidFormat = Zeus.CapitalStoryContentFormat.MERMAID;
const bpmnFormat = Zeus.CapitalStoryContentFormat.BPMN;
const drawioFormat = Zeus.CapitalStoryContentFormat.DRAWIO;
const contentFormat = ref<Zeus.CapitalStoryContentFormat>(markdownFormat);
const contentFormatOptions = [
  { label: 'Markdown', value: markdownFormat },
  { label: 'BPMN', value: bpmnFormat },
  { label: 'Draw.io', value: drawioFormat },
  { label: 'Mermaid', value: mermaidFormat },
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

const notEmpty = (val: string) => {
  return !!val || 'Это поле обязательно для заполнения';
};

const clearForm = async () => {
  formData.value = {
    title: '',
    description: '',
  };
  contentFormat.value = markdownFormat;

  titleInput.value?.resetValidation();

  await nextTick();
  titleInput.value?.focus();
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

.crf-toggle-shell :deep(.q-btn) {
  min-height: 36px;
}

.crf-input :deep(.q-field__native) {
  line-height: 1.45;
}

.crf-editor-frame {
  border: 1px solid rgba(127, 127, 127, 0.28);
  border-radius: 4px;
  overflow: visible;
}

.editor-viewport-anchor {
  display: block;
  height: 0;
  width: 100%;
  pointer-events: none;
}

.crf-bpmn-note {
  line-height: 1.45;
  border: 1px solid rgba(127, 127, 127, 0.22);
}

.crf-bpmn-note__icon {
  flex-shrink: 0;
  margin-top: 1px;
}
</style>
