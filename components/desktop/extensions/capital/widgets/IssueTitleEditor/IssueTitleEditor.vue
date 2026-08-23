<template lang="pug">
q-input(
  v-if="issue"
  v-model='title'
  :label='label || "Задача"'
  outline
  :readonly="!permissions?.can_edit_issue"
  @input="handleTitleChange"
  :hide-bottom-space="!$slots.hint"
  :rules="[val => !!val || 'Название задачи обязательно']"
  type="textarea"
  autogrow
).full-width.capital-title-editor-input
  template(#prepend)
    // Показываем иконку отмены при наличии изменений, иначе - слот с иконкой
    q-btn(
      v-if="hasChanges && permissions?.can_edit_issue"
      flat
      round
      dense
      color="negative"
      icon="undo"
      size="sm"
      @click="resetChanges"
    )
      q-tooltip Отменить изменения
    .row.items-center.no-wrap.q-gutter-xs(v-else)
      PrivateShieldIcon(:show='isPrivateIssue')
      slot(name="prepend-icon")
        q-icon(name='task', size='24px', color='primary')

  template(#append)
    .capital-title-editor-append.column.items-end.justify-center.q-gutter-y-sm
      q-btn(
        v-if="hasChanges && permissions?.can_edit_issue"
        round
        dense
        color="primary"
        icon="save"
        size="sm"
        :loading="isSaving"
        @click="saveChanges"
      )
        q-tooltip Сохранить изменения
      .row.items-center.no-wrap(v-if="!(hasChanges && permissions?.can_edit_issue)")
        FavoriteStarButton(
          v-if='issue?.issue_hash',
          :target-type='FavoriteTargetType.ISSUE',
          :target-hash='issue.issue_hash'
        )
        EntityIdBadge(
          :raw-id="issue?.id"
          copy-on-click
          address-clipboard
        )

  template(v-if="$slots.hint", #hint)
    slot(name="hint")
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { IIssue, IIssuePermissions } from 'app/extensions/capital/entities/Issue/model'
import { useUpdateIssue } from 'app/extensions/capital/features/Issue/UpdateIssue'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { EntityIdBadge } from 'src/shared/ui'
import { PrivateShieldIcon } from 'app/extensions/capital/shared/ui'
import { useProjectStore } from 'app/extensions/capital/entities/Project/model'
import { FavoriteStarButton } from 'app/extensions/capital/features/Favorite/ToggleFavorite'
import { Zeus } from '@coopenomics/sdk'

const FavoriteTargetType = Zeus.CapitalFavoriteTargetType

const props = defineProps<{
  issue: IIssue | null | undefined
  label?: string
}>()

const emit = defineEmits<{
  fieldChange: []
  'update:title': [value: string]
}>()

const route = useRoute()
const projectHash = computed(() => route.params.project_hash as string)
const projectStore = useProjectStore()

const isPrivateIssue = computed(() => {
  if (!props.issue?.project_hash) return true
  const project =
    projectStore.getProject(props.issue.project_hash) ||
    (projectHash.value ? projectStore.getProject(projectHash.value) : undefined)
  return project?.origin === 'local'
})

// Используем composable для обновления задач
const { debounceSave, saveImmediately } = useUpdateIssue()

// Локальное состояние
const originalTitle = ref('')
const localTitle = ref('')
const isSaving = ref(false)

// Computed свойства для двухсторонней привязки
const title = computed({
  get: () => localTitle.value,
  set: (value: string) => {
    localTitle.value = value
    emit('update:title', value)
  }
})

// Computed для разрешений
const permissions = computed((): IIssuePermissions | null => {
  return props.issue?.permissions || null
})

// Вычисляемое свойство для определения наличия изменений
const hasChanges = computed(() => {
  if (!originalTitle.value) return false
  return localTitle.value !== originalTitle.value
})

// Сохранение изменений
const saveChanges = async () => {
  if (!props.issue) return

  try {
    isSaving.value = true

    const updateData = {
      issue_hash: props.issue.issue_hash,
      title: props.issue.title,
    }

    await saveImmediately(updateData, projectHash.value)

    // Обновляем оригинальное состояние после успешного сохранения
    if (props.issue) {
      originalTitle.value = props.issue.title
    }

    SuccessAlert('Название задачи сохранено успешно')
  } catch (error) {
    console.error('Ошибка при сохранении названия задачи:', error)
    FailAlert('Не удалось сохранить название задачи')
  } finally {
    isSaving.value = false
  }
}

// Сброс изменений
const resetChanges = () => {
  if (!originalTitle.value) return

  // Восстанавливаем оригинальные значения
  localTitle.value = originalTitle.value
  emit('update:title', originalTitle.value)
}

// Обработчик изменения title
const handleTitleChange = () => {
  if (!props.issue) return

  const updateData = {
    issue_hash: props.issue.issue_hash,
    title: props.issue.title,
  }

  // Запускаем авто-сохранение с задержкой
  debounceSave(updateData, projectHash.value)

  emit('fieldChange')
}

// Watcher для отслеживания изменений issue
watch(() => props.issue, (newIssue) => {
  if (newIssue) {
    // Инициализируем оригинальное состояние при первой загрузке
    if (!originalTitle.value) {
      originalTitle.value = newIssue.title || ''
    }
    if (localTitle.value !== newIssue.title) {
    localTitle.value = newIssue.title || ''
    }
  }
}, { immediate: true, deep: true })
</script>

<style lang="scss" scoped>
.capital-title-editor-input :deep(.q-field__append) {
  align-items: center;
  align-self: stretch;
}

.capital-title-editor-append {
  min-height: 100%;
  max-width: min(100%, 14rem);
}
</style>
