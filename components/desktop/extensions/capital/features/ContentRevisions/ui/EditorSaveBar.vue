<template lang="pug">
//- Полоска над редактором: слева состояние, справа текстовая кнопка «Редакции» и «Сохранить»
.row.items-center.editor-save-bar
  .col
    .text-caption(:class="statusClass") {{ statusText }}
  .col-auto.row.items-center.q-gutter-xs
    BaseButton(variant="ghost" size="sm" @click="revisionsOpen = true") Редакции
    BaseButton(
      v-if="canEdit"
      variant="primary"
      size="sm"
      :disabled="!hasChanges || saving"
      :loading="saving"
      @click="emit('save')"
    ) Сохранить
  RevisionsDialog(
    v-model="revisionsOpen"
    :entity-type="entityType"
    :entity-hash="entityHash"
    :current-title="currentTitle"
    :current-description="currentDescription"
    :current-rev="currentRev"
    :can-restore="canEdit"
    @restored="(s) => emit('restored', s)"
  )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaseButton } from 'src/shared/ui/base'
import RevisionsDialog from './RevisionsDialog.vue'
import type { IContentEntityType, IContentRevisionSummary } from '../api'

const props = defineProps<{
  entityType: IContentEntityType
  entityHash: string
  currentTitle: string
  currentDescription: string
  currentRev: number
  canEdit: boolean
  hasChanges: boolean
  saving: boolean
  /** Подпись после удачного сохранения (например, «слито с чужими правками») */
  note?: string | null
}>()

const emit = defineEmits<{
  save: []
  restored: [summary: IContentRevisionSummary]
}>()

const revisionsOpen = ref(false)

const statusText = computed(() => {
  if (props.saving) return 'Сохранение…'
  if (props.hasChanges) return 'Есть несохранённые изменения'
  if (props.note) return props.note
  return props.currentRev > 0 ? `Редакция №${props.currentRev}` : ''
})
const statusClass = computed(() => ({
  'text-warning': props.hasChanges && !props.saving,
  'text-grey-7': !props.hasChanges,
}))
</script>

<style lang="scss" scoped>
.editor-save-bar {
  min-height: var(--p-8);
  padding-bottom: var(--p-2);
}
</style>
