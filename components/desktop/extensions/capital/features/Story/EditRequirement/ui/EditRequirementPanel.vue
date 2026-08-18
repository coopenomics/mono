<template lang="pug">
q-card.column.no-wrap.edit-req-panel(
  ref='panelRootRef'
  :class='{ "edit-req-panel--dialog": variant === "dialog", "edit-req-panel--page": variant === "page" }'
  flat
)
  //- Шапка — тот же паттерн, что ProjectTitleEditor/IssueTitleEditor: outline-textarea
  //- с иконкой типа в prepend; при изменениях слева undo, справа save; в покое
  //- справа звёздочка избранного (и close в диалоге)
  //- Обёртка и отступы — как у заголовка задачи на IssuePage: .q-px-md.q-pb-sm
  .edit-req-panel__head.q-px-md.q-pb-sm
    q-input.full-width.capital-title-editor-input(
      v-model='localTitle'
      label='Артефакт'
      :readonly='!canEdit'
      outline
      type='textarea'
      autogrow
      hide-bottom-space
      :rules='[(val) => !!val?.trim() || "Заголовок обязателен"]'
    )
      template(#prepend)
        q-btn(
          v-if='canEdit && hasChanges'
          flat
          round
          dense
          color='negative'
          icon='undo'
          size='sm'
          :disable='isSaving'
          @click='resetChanges'
        )
          q-tooltip Отменить изменения
        q-icon(v-else :name='formatIcon' size='24px' color='primary')
      template(#append)
        .capital-title-editor-append.column.items-end.justify-center
          q-btn(
            v-if='canEdit && hasChanges'
            round
            dense
            color='primary'
            icon='save'
            size='sm'
            :loading='isSaving'
            :disable='!titleOk'
            @click='handleSave'
          )
            q-tooltip Сохранить изменения
          .row.items-center.no-wrap(v-else)
            FavoriteStarButton(
              v-if='requirement'
              :target-type='FavoriteTargetType.ARTIFACT'
              :target-hash='requirement.story_hash'
            )
            EntityIdBadge(
              v-if='shortId'
              :raw-id='shortId'
              copy-on-click
              :copy-value='requirement?.story_hash'
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
import { BaseButton } from 'src/shared/ui/base';
import { EntityIdBadge } from 'src/shared/ui';
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

// Своего короткого id у артефактов нет — показываем начало хеша, копируется полный
const shortId = computed(() =>
  props.requirement?.story_hash ? props.requirement.story_hash.slice(0, 6).toUpperCase() : '',
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
}

/* Как в Project/IssueTitleEditor: append по центру высоты поля */
.capital-title-editor-input :deep(.q-field__append) {
  align-items: center;
  align-self: stretch;
}

.capital-title-editor-append {
  min-height: 100%;
  max-width: min(100%, 14rem);
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
