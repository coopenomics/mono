<template lang="pug">
q-card.column.no-wrap.edit-req-panel(
  ref='panelRootRef'
  :class='{ "edit-req-panel--dialog": variant === "dialog", "edit-req-panel--page": variant === "page" }'
  flat
)
  //- Шапка — как у задачи: заголовок-поле с иконкой типа слева; при изменениях
  //- слева undo, справа save; в покое справа звёздочка избранного (и close в диалоге)
  .edit-req-panel__head
    BaseInput.full-width(
      v-model='localTitle'
      type='textarea'
      autogrow
      :rows='1'
      label='Артефакт'
      placeholder='Заголовок артефакта'
      :readonly='!canEdit'
      :error="canEdit && !titleOk ? 'Заголовок обязателен' : undefined"
    )
      template(#prepend)
        BaseButton(
          v-if='canEdit && hasChanges'
          variant='ghost'
          size='sm'
          icon-only
          aria-label='Отменить изменения'
          :disabled='isSaving'
          @click='resetChanges'
        )
          template(#icon-left)
            q-icon(name='undo' size='18px')
            q-tooltip Отменить изменения
        q-icon(v-else :name='formatIcon' size='24px' color='primary')
      template(#append)
        BaseButton(
          v-if='canEdit && hasChanges'
          variant='primary'
          size='sm'
          icon-only
          aria-label='Сохранить'
          :loading='isSaving'
          :disabled='isSaving || !titleOk'
          @click='handleSave'
        )
          template(#icon-left)
            q-icon(name='save' size='18px')
            q-tooltip Сохранить
        FavoriteStarButton(
          v-else-if='requirement'
          :target-type='FavoriteTargetType.ARTIFACT'
          :target-hash='requirement.story_hash'
        )
        BaseButton(
          v-if='variant === "dialog"'
          variant='ghost'
          size='sm'
          icon-only
          aria-label='Закрыть'
          @click='handleClose'
        )
          template(#icon-left)
            q-icon(name='close' size='18px')

  q-card-section.col.scroll.column.no-wrap.edit-req-panel__body
    template(v-if='requirement && isBpmnFormat')
      ClientOnly
        template(#fallback)
          .flex.flex-center.bpmn-fallback
            q-spinner(color='primary' size='48px')
        BpmnStoryEditor(
          v-model='localDescription'
          :readonly='!canEdit'
          :min-height='editorMinHeight'
        )
    template(v-else-if='requirement && isMermaidFormat')
      MermaidStoryEditor(
        v-model='localDescription'
        :readonly='!canEdit'
        :min-height='editorMinHeight'
      )
    template(v-else-if='requirement && isDrawioFormat')
      ClientOnly
        template(#fallback)
          .flex.flex-center.drawio-fallback
            q-spinner(color='primary' size='48px')
        DrawioStoryEmbedEditor(
          v-model='localDescription'
          :readonly='!canEdit'
          :min-height='editorMinHeight'
        )
    template(v-else-if='requirement')
      span.edit-req-panel__editor-top-anchor(ref='markdownEditorTopRef' aria-hidden='true')
      Editor(
        v-model='localDescription'
        :readonly='!canEdit'
        :placeholder='canEdit ? "Опишите артефакт подробно..." : "Описание отсутствует"'
        :minHeight='markdownViewportMinHeight'
        :padded='false'
        :show-focus-ring="variant === 'dialog'"
      )

</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useEditorViewportMinHeight } from 'src/shared/lib/composables/useEditorViewportMinHeight';
import { Zeus } from '@coopenomics/sdk';
import { ClientOnly } from 'src/shared/ui/ClientOnly';
import { Editor } from 'src/shared/ui';
import { BaseButton, BaseInput } from 'src/shared/ui/base';
import { FavoriteStarButton } from 'app/extensions/capital/features/Favorite/ToggleFavorite';
import { storyContentIcon } from 'app/extensions/capital/shared/lib/storyContentIcon';
import { BpmnStoryEditor } from 'app/extensions/capital/features/Story/BpmnStoryEditor';
import { MermaidStoryEditor } from 'app/extensions/capital/features/Story/MermaidStoryEditor';
import { DrawioStoryEmbedEditor } from 'app/extensions/capital/features/Story/DrawioStoryEmbedEditor';
import { useUpdateStory } from '../../UpdateStory/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import type { IStory } from 'app/extensions/capital/entities/Story/model';

export type EditRequirementPanelVariant = 'dialog' | 'page';

const props = withDefaults(
  defineProps<{
    requirement?: IStory | null;
    canEdit?: boolean;
    /** dialog — полноэкранный режим в q-dialog; page — встроенная карточка на странице */
    variant?: EditRequirementPanelVariant;
  }>(),
  {
    requirement: null,
    canEdit: true,
    variant: 'page',
  },
);

const emit = defineEmits<{
  /** Запрос закрыть (только для variant dialog; родитель снимает диалог) */
  close: [];
  updated: [requirement: IStory];
}>();

const FavoriteTargetType = Zeus.CapitalFavoriteTargetType;

const formatIcon = computed(() =>
  props.requirement ? storyContentIcon(props.requirement) : 'description',
);

const localTitle = ref('');
const localDescription = ref('');
const originalTitle = ref('');
const originalDescription = ref('');
const isSaving = ref(false);
const { updateStory } = useUpdateStory();

const editorMinHeight = computed(() => (props.variant === 'dialog' ? 480 : 520));

const panelRootRef = ref<HTMLElement | null>(null);
const markdownEditorTopRef = ref<HTMLElement | null>(null);
const markdownViewportMinHeight = useEditorViewportMinHeight(markdownEditorTopRef, {
  observeRef: panelRootRef,
  min: 280,
  bottomGap: 20,
});

const isBpmnFormat = computed(() => {
  const fmt = props.requirement?.content_format;
  return fmt === Zeus.CapitalStoryContentFormat.BPMN;
});

const isMermaidFormat = computed(() => {
  const fmt = props.requirement?.content_format;
  return fmt === Zeus.CapitalStoryContentFormat.MERMAID;
});

const isDrawioFormat = computed(() => {
  const fmt = props.requirement?.content_format;
  return fmt === Zeus.CapitalStoryContentFormat.DRAWIO;
});

const hasChanges = computed(() => {
  return (
    localTitle.value !== originalTitle.value ||
    localDescription.value !== originalDescription.value
  );
});

const titleOk = computed(() => !!localTitle.value?.trim());

function syncFromRequirement(row: IStory | null) {
  if (row) {
    localTitle.value = row.title || '';
    localDescription.value = row.description || '';
    originalTitle.value = row.title || '';
    originalDescription.value = row.description || '';
  }
}

watch(
  () => props.requirement,
  (newRequirement) => {
    syncFromRequirement(newRequirement ?? null);
  },
  { immediate: true },
);

const handleClose = () => {
  if (hasChanges.value) {
    if (
      confirm('У вас есть несохранённые изменения. Вы уверены, что хотите закрыть?')
    ) {
      if (props.variant === 'dialog') {
        emit('close');
      }
    }
  } else if (props.variant === 'dialog') {
    emit('close');
  }
};

const resetChanges = () => {
  localTitle.value = originalTitle.value;
  localDescription.value = originalDescription.value;
};

const handleSave = async () => {
  if (!props.requirement || !hasChanges.value) return;

  isSaving.value = true;
  try {
    const updateData = {
      story_hash: props.requirement.story_hash,
      title: localTitle.value,
      description: localDescription.value,
    };

    const updatedRequirement = await updateStory(updateData);

    originalTitle.value = localTitle.value;
    originalDescription.value = localDescription.value;

    SuccessAlert('Артефакт успешно обновлён');
    emit('updated', updatedRequirement);
  } catch (error) {
    console.error('Ошибка при обновлении артефакта:', error);
    FailAlert('Не удалось обновить артефакт');
  } finally {
    isSaving.value = false;
  }
};

/** Сброс полей из текущего requirement (например после открытия диалога) */
function resetFromProps() {
  syncFromRequirement(props.requirement ?? null);
}

/** Для «Назад»: true — можно уходить, false — пользователь отменил */
function tryNavigateAway(): boolean {
  if (!hasChanges.value) {
    return true;
  }
  return confirm(
    'У вас есть несохранённые изменения. Уйти со страницы?',
  );
}

defineExpose({
  resetFromProps,
  tryNavigateAway,
});
</script>

<style lang="scss" scoped>
.edit-req-panel--dialog.q-card {
  height: 100vh;
}

.edit-req-panel--page.q-card {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.edit-req-panel__head {
  flex-shrink: 0;
  padding: var(--p-3) var(--p-4) 0;
}

.edit-req-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* Растягиваем редактор на оставшуюся высоту карточки (страница не 100vh, в отличие от диалога) */
.edit-req-panel__body > :deep(.bpmn-story-editor),
.edit-req-panel__body > :deep(.drawio-story-embed-editor) {
  flex: 1 1 auto;
  min-height: 0;
  align-self: stretch;
}

.bpmn-fallback,
.drawio-fallback {
  min-height: 480px;
  width: 100%;
}

.edit-req-panel__editor-top-anchor {
  display: block;
  height: 0;
  width: 100%;
  pointer-events: none;
}
</style>
