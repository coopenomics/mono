<template lang="pug">
.transcription-memo-editor
  .transcription-memo-editor__card(:class="{ 'transcription-memo-editor__card--readonly': !canEditMemo }")
    Editor.transcription-memo-editor__editor(
      :model-value="draft"
      :readonly="isSaving || !canEditMemo"
      :placeholder="canEditMemo ? 'Кратко, о чём был разговор. Первая строка — одно предложение-резюме до 150 символов.' : 'Заметка не заполнена.'"
      :min-height="180"
      :padded="true"
      :show-focus-ring="false"
      @update:model-value="onInput"
    )
    .transcription-memo-editor__actions(v-if="canEditMemo")
      q-btn(
        flat
        dense
        no-caps
        color="primary"
        icon="fa-solid fa-floppy-disk"
        :label="isSaving ? 'Сохраняем…' : 'Сохранить'"
        :loading="isSaving"
        :disable="!isDirty || isSaving"
        @click="onSave"
      )
  p.transcription-memo-editor__hint(v-if="!canEditMemo")
    | Редактирование доступно председателю и членам совета
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { FailAlert } from 'src/shared/api';
import { Editor } from 'src/shared/ui/Editor';
import { useSessionStore } from 'src/entities/Session';
import { useSaveTranscriptionMemo } from '../model';

const props = defineProps<{
  transcriptionId: string;
  memo: string;
}>();

const sessionStore = useSessionStore();
const { isChairman, isMember } = storeToRefs(sessionStore);
const canEditMemo = computed(() => isChairman.value || isMember.value);

const { save, isSaving } = useSaveTranscriptionMemo();
const draft = ref(props.memo);

watch(
  () => [props.transcriptionId, props.memo] as const,
  ([, memo]) => {
    draft.value = memo;
  }
);

const isDirty = computed(() => draft.value !== props.memo);

function onInput(value: string): void {
  draft.value = value;
}

async function onSave(): Promise<void> {
  if (!canEditMemo.value || !isDirty.value || isSaving.value) return;
  const ok = await save(props.transcriptionId, draft.value);
  if (!ok) {
    FailAlert('Не удалось сохранить заметку');
  }
}
</script>

<style scoped>
.transcription-memo-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transcription-memo-editor__card {
  position: relative;
  border: 1px solid var(--tr-border, rgba(0, 0, 0, 0.12));
  border-radius: 10px;
  background: var(--tr-card-bg, #fff);
  overflow: hidden;
}

.body--dark .transcription-memo-editor__card {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.12);
}

.transcription-memo-editor__card--readonly {
  background: var(--tr-card-bg-readonly, rgba(0, 0, 0, 0.02));
}

.body--dark .transcription-memo-editor__card--readonly {
  background: rgba(255, 255, 255, 0.03);
}

.transcription-memo-editor__editor {
  width: 100%;
}

.transcription-memo-editor__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--tr-border, rgba(0, 0, 0, 0.08));
  background: rgba(0, 0, 0, 0.015);
}

.body--dark .transcription-memo-editor__actions {
  border-top-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.transcription-memo-editor__hint {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.55);
}

.body--dark .transcription-memo-editor__hint {
  color: rgba(255, 255, 255, 0.55);
}
</style>
