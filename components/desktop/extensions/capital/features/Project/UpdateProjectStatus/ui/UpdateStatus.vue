<template lang="pug">
q-select(
  ref="selectRef"
  v-model="selectedStatus"
  :options="statusOptions"
  option-value="value"
  option-label="label"
  emit-value
  map-options
  dense
  standout="bg-teal text-white"
  :label="label"
  :readonly="readonly"
  @click="handleClick"
  @update:model-value="handleStatusChange"
)

//- Отмена необратима и возвращает средства в программу — спрашиваем прежде,
//- чем выполнять. Пока это простое подтверждение; решение совета будет позже.
BaseDialog(
  v-model="confirmCancelOpen"
  title="Отменить проект?"
  size="sm"
  @update:model-value="onConfirmDialogToggle"
)
  .cancel-confirm
    p.cancel-confirm__text Работы по проекту прекратятся, а неизрасходованные средства вернутся в программу.
    p.cancel-confirm__text.t-sm.t-muted Возобновить отменённый проект нельзя.

  template(#footer)
    .cancel-confirm__actions
      BaseButton(variant="ghost" @click="rejectCancel") Не отменять
      BaseButton(
        variant="danger"
        :loading="cancelling"
        @click="confirmCancel"
      ) Отменить проект
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Zeus } from '@coopenomics/sdk'
import type { IProject } from 'app/extensions/capital/entities/Project/model'

import { useUpdateProjectStatus } from '../model'
import { getProjectStatusLabel } from 'app/extensions/capital/shared/lib/projectStatus'
import { FailAlert } from 'src/shared/api/alerts'
import { BaseDialog } from 'src/shared/ui/base/BaseDialog'
import { BaseButton } from 'src/shared/ui/base/BaseButton'

interface Props {
  project: IProject | undefined
  label?: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Статус',
  readonly: false
})

// Ref для доступа к q-select компоненту
const selectRef = ref()

// Используем composable для обновления проекта
const { updateProjectStatus } = useUpdateProjectStatus()

// Текущий выбранный статус, инициализируем из project.status
const selectedStatus = ref<Zeus.ProjectStatus>(props.project?.status || Zeus.ProjectStatus.UNDEFINED)

// Предыдущий статус для сравнения
const previousStatus = ref<Zeus.ProjectStatus>(props.project?.status || Zeus.ProjectStatus.UNDEFINED)

// Computed свойство для определения readonly на основе permissions
const readonly = computed(() => {
  return props.readonly || !props.project?.permissions?.can_change_project_status
})


// Опции для выбора статуса
const statusOptions = [
  { value: Zeus.ProjectStatus.PENDING, label: getProjectStatusLabel(Zeus.ProjectStatus.PENDING) },
  { value: Zeus.ProjectStatus.ACTIVE, label: getProjectStatusLabel(Zeus.ProjectStatus.ACTIVE) },
  { value: Zeus.ProjectStatus.VOTING, label: getProjectStatusLabel(Zeus.ProjectStatus.VOTING) },
  { value: Zeus.ProjectStatus.RESULT, label: getProjectStatusLabel(Zeus.ProjectStatus.RESULT) },
  { value: Zeus.ProjectStatus.FINALIZED, label: getProjectStatusLabel(Zeus.ProjectStatus.FINALIZED) },
  { value: Zeus.ProjectStatus.CANCELLED, label: getProjectStatusLabel(Zeus.ProjectStatus.CANCELLED) },
]

// Обработчик клика по селекту - переключает dropdown
const handleClick = () => {
  if (!readonly.value && selectRef.value) {
    // selectRef.value.togglePopup() //TODO: не работает потому что не существует
  }
}

// Подтверждение отмены: статус выбран, но действие ещё не выполнено.
const confirmCancelOpen = ref(false)
const cancelling = ref(false)

/** Возврат селекта к тому статусу, который реально стоит у проекта. */
const revertSelection = () => {
  selectedStatus.value = previousStatus.value
}

const rejectCancel = () => {
  confirmCancelOpen.value = false
  revertSelection()
}

/** Закрытие диалога мимо кнопок (крестик, клик вне) — тоже отказ. */
const onConfirmDialogToggle = (open: boolean) => {
  if (!open && !cancelling.value) revertSelection()
}

const confirmCancel = async () => {
  cancelling.value = true
  try {
    await applyStatusChange(Zeus.ProjectStatus.CANCELLED)
    confirmCancelOpen.value = false
  } finally {
    cancelling.value = false
  }
}

/** Собственно смена статуса — общая для обычных переходов и подтверждённой отмены. */
const applyStatusChange = async (newStatus: Zeus.ProjectStatus) => {
  if (!props.project) return

  const oldStatus = previousStatus.value

  try {
    selectedStatus.value = newStatus

    const coopname = (props.project as any).coopname || ''
    await updateProjectStatus(props.project.project_hash, newStatus, coopname)

    previousStatus.value = newStatus
  } catch (error) {
    selectedStatus.value = oldStatus
    FailAlert(error)
    console.error('Failed to update status:', error)
  }
}

// Обработчик изменения статуса
const handleStatusChange = async (newStatus: Zeus.ProjectStatus) => {
  if (!newStatus || !props.project || newStatus === previousStatus.value || readonly.value) return

  // Отмена необратима — сначала спрашиваем, и только потом выполняем.
  if (newStatus === Zeus.ProjectStatus.CANCELLED) {
    confirmCancelOpen.value = true
    return
  }

  await applyStatusChange(newStatus)
}

// Синхронизируем локальное состояние с project.status при изменении пропса
watch(() => props.project?.status, (newStatus) => {
  if (newStatus) {
    selectedStatus.value = newStatus
    previousStatus.value = newStatus
  }
})
</script>

<style lang="scss" scoped>
.cancel-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.cancel-confirm__text {
  margin: 0;
}

.cancel-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
