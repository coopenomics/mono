<template lang="pug">
//- Корень — плоская колонка без карточки: панель уже стоит в оверлее или на
//- странице, вторая рамка карточки вокруг текста только отнимает место
.column.no-wrap.edit-req-panel(
  ref='panelRootRef'
  :class='{ "edit-req-panel--dialog": variant === "dialog", "edit-req-panel--page": variant === "page" }'
)
  //- Шапка — тот же паттерн, что ProjectTitleEditor/IssueTitleEditor: outline-textarea
  //- с иконкой типа в prepend; при изменениях слева undo; close в диалоге справа.
  //- Сохранение/редакции/избранное — в EditorSaveBar ниже, как у проекта и компонента
  //- Обёртка и отступы — как у заголовка задачи на IssuePage: .q-px-md.q-pb-sm
  //- В оверлее тело панели без отступов (DetailsDrawer flush) — верхнее поле даёт сама шапка
  .edit-req-panel__head.q-px-md.q-pb-sm(:class='{ "q-pt-md": variant === "dialog" }')
    q-input.full-width.capital-title-editor-input(
      v-model='localTitle'
      :label='$t("capital.editRequirementPanel.titleFieldLabel")'
      :readonly='!canEdit'
      outline
      type='textarea'
      autogrow
      hide-bottom-space
      :rules='[(val) => !!val?.trim() || $t("capital.editRequirementPanel.titleRequiredError")]'
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
          q-tooltip {{ $t('capital.editRequirementPanel.cancelChanges') }}
        q-icon(v-else :name='formatIcon' size='24px' color='primary')
      template(#append)
        //- «Открыть» — как у оверлея задачи: полная страница артефакта с
        //- постоянной ссылкой; кнопку показывает только хост, знающий адрес
        BaseButton(
          v-if='variant === "dialog" && expandable'
          variant='ghost'
          size='sm'
          :aria-label='$t("capital.editRequirementPanel.openFullPageAriaLabel")'
          @click='emit("expand")'
        )
          template(#icon-left)
            q-icon(name='open_in_full' size='16px')
          | {{ $t('capital.editRequirementPanel.openFullPage') }}
        BaseButton(
          v-if='variant === "dialog"'
          variant='ghost'
          size='sm'
          icon-only
          :aria-label='$t("common.action.close")'
          @click='handleClose'
        )
          template(#icon-left)
            q-icon(name='close' size='18px')
    //- Как у проекта/компонента: состояние слева, справа «Редакции», избранное и «Сохранить» — всегда на месте.
    //- На полной странице команды стоят в строке разделов проекта вместо «+ Артефакт»
    //- (решение владельца 24.11.2026): телепорт в хост оболочки, без хоста — на месте
    Teleport(:to='tabActionsHost' :disabled='!saveBarInTabs')
      EditorSaveBar(
        v-if='requirement'
        :inline='saveBarInTabs'
        :entity-type='Zeus.CapitalContentEntityType.STORY'
        :entity-hash='requirement.story_hash'
        :current-title='localTitle'
        :current-description='localDescription'
        :current-rev='currentRev'
        :can-edit='canEdit'
        :has-changes='hasChanges && titleOk'
        :saving='isSaving'
        :note='saveNote'
        @save='handleSave'
        @restored='handleRestored'
      )
        template(#actions)
          FavoriteStarButton(
            :target-type='FavoriteTargetType.ARTIFACT'
            :target-hash='requirement.story_hash'
          )

  //- Диаграммы встают вплотную к краям панели; у текста — обычные поля
  .col.scroll.column.no-wrap.edit-req-panel__body(
    :class='isDiagramFormat ? "edit-req-panel__body--diagram" : "q-pa-md"'
  )
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
        :placeholder='canEdit ? $t("capital.editRequirementPanel.descriptionPlaceholder") : $t("capital.editRequirementPanel.descriptionEmpty")'
        :minHeight='markdownViewportMinHeight'
        :padded='false'
      )
  ConflictDialog(v-model='conflictOpen' :conflict='conflict' @resolve='applyConflictResolution')

</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useEditorViewportMinHeight } from 'src/shared/lib/composables/useEditorViewportMinHeight';
import { Zeus } from '@coopenomics/sdk';
import { ClientOnly } from 'src/shared/ui/ClientOnly';
import { Editor } from 'src/shared/ui';
import { BaseButton } from 'src/shared/ui/base';
import { useEntityTabActionsHost } from 'app/extensions/capital/shared/lib/entityTabActions';
import { FavoriteStarButton } from 'app/extensions/capital/features/Favorite/ToggleFavorite';
import { storyContentIcon } from 'app/extensions/capital/shared/lib/storyContentIcon';
import { BpmnStoryEditor } from 'app/extensions/capital/features/Story/BpmnStoryEditor';
import { MermaidStoryEditor } from 'app/extensions/capital/features/Story/MermaidStoryEditor';
import { DrawioStoryEmbedEditor } from 'app/extensions/capital/features/Story/DrawioStoryEmbedEditor';
import { useUpdateStory } from '../../UpdateStory/model';
import {
  ConflictDialog,
  EditorSaveBar,
  extractContentConflict,
  type IContentConflict,
  type IContentRevisionSummary,
} from 'app/extensions/capital/features/ContentRevisions';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import type { IStory } from 'app/extensions/capital/entities/Story/model';
import { api as StoryApi } from 'app/extensions/capital/entities/Story/api';
import { t } from '../../../../i18n';

export type EditRequirementPanelVariant = 'dialog' | 'page';

const props = withDefaults(
  defineProps<{
    requirement?: IStory | null;
    canEdit?: boolean;
    /** dialog — панель в оверлее поверх списка (своя шапка с крестиком); page — полная страница артефакта */
    variant?: EditRequirementPanelVariant;
    /** Показать в шапке оверлея кнопку «Открыть» на полную страницу */
    expandable?: boolean;
  }>(),
  {
    requirement: null,
    canEdit: true,
    variant: 'page',
    expandable: false,
  },
);

const emit = defineEmits<{
  /** Запрос закрыть (только для variant dialog; родитель снимает диалог) */
  close: [];
  updated: [requirement: IStory];
  /** Запрос открыть артефакт на полной странице (кнопка «Открыть» в оверлее) */
  expand: [];
}>();

const FavoriteTargetType = Zeus.CapitalFavoriteTargetType;

// Хост строки разделов проекта/компонента; вне оболочки — null, команды на месте
const tabActionsHost = useEntityTabActionsHost();
const saveBarInTabs = computed(() => props.variant === 'page' && !!tabActionsHost.value);

const formatIcon = computed(() =>
  props.requirement ? storyContentIcon(props.requirement) : 'description',
);

const localTitle = ref('');
const localDescription = ref('');
const originalTitle = ref('');
const originalDescription = ref('');
const isSaving = ref(false);
const { updateStory } = useUpdateStory();

/** Редакция, относительно которой идёт сохранение: content_rev артефакта, после конфликта — current_rev сервера */
const baseRevOverride = ref<number | null>(null);
const currentRev = computed(() => baseRevOverride.value ?? props.requirement?.content_rev ?? 0);
const conflict = ref<IContentConflict | null>(null);
const conflictOpen = ref(false);
const saveNote = ref<string | null>(null);

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

const isDiagramFormat = computed(
  () => isBpmnFormat.value || isMermaidFormat.value || isDrawioFormat.value,
);

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
      confirm(t('capital.editRequirementPanel.unsavedCloseConfirm'))
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
      base_rev: currentRev.value,
    };

    const updatedRequirement = await updateStory(updateData);

    // Сервер мог слить текст с параллельной правкой — показываем итог, а не то, что отправили
    const merged =
      (updatedRequirement.description || '') !== localDescription.value ||
      (updatedRequirement.title || '') !== localTitle.value;
    localTitle.value = updatedRequirement.title || '';
    localDescription.value = updatedRequirement.description || '';
    originalTitle.value = localTitle.value;
    originalDescription.value = localDescription.value;
    baseRevOverride.value = null;

    saveNote.value = merged ? t('capital.editRequirementPanel.savedMergedSuccess') : t('capital.editRequirementPanel.savedSuccess');
    SuccessAlert(merged ? t('capital.editRequirementPanel.savedMergedFullSuccess') : t('capital.editRequirementPanel.updatedSuccess'));
    emit('updated', updatedRequirement);
  } catch (error) {
    const c = extractContentConflict(error);
    if (c) {
      conflict.value = c;
      conflictOpen.value = true;
      return;
    }
    console.error('Ошибка при обновлении артефакта:', error);
    FailAlert(t('capital.editRequirementPanel.updateError'));
  } finally {
    isSaving.value = false;
  }
};

/** Выбор в диалоге конфликта: текст в редактор, дальнейшее сохранение — относительно серверной редакции */
const applyConflictResolution = (value: { title: string; description: string; base_rev: number }) => {
  localTitle.value = value.title;
  localDescription.value = value.description;
  baseRevOverride.value = value.base_rev;
};

/** После отката к редакции перечитываем артефакт с сервера и сообщаем родителю как об обновлении */
const handleRestored = async (_summary: IContentRevisionSummary) => {
  if (!props.requirement) return;
  baseRevOverride.value = null;
  try {
    const row = await StoryApi.loadStory({ story_hash: props.requirement.story_hash });
    if (row) {
      syncFromRequirement(row);
      emit('updated', row);
    }
  } catch (error) {
    FailAlert(error);
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
    t('capital.editRequirementPanel.unsavedLeaveConfirm'),
  );
}

defineExpose({
  resetFromProps,
  tryNavigateAway,
});
</script>

<style lang="scss" scoped>
.edit-req-panel--dialog {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  background: var(--p-surface);
}

.edit-req-panel--page {
  background: var(--p-surface);
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


.edit-req-panel__body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* Холст диаграммы без своей рамки: от шапки его отделяет одна линия */
.edit-req-panel__body--diagram {
  padding: 0;
  border-top: 1px solid var(--p-line);
}
.edit-req-panel__body--diagram > :deep(.bpmn-story-editor),
.edit-req-panel__body--diagram > :deep(.drawio-story-embed-editor) {
  border: 0;
  border-radius: 0;
}
.edit-req-panel__body--diagram > :deep(.mermaid-story-editor) {
  padding: var(--p-4);
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
