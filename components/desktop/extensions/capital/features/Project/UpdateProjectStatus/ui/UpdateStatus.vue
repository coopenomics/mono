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

</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Zeus } from '@coopenomics/sdk'
import type { IProject } from 'app/extensions/capital/entities/Project/model'

import { useUpdateProjectStatus } from '../model'
import { getProjectStatusLabel } from 'app/extensions/capital/shared/lib/projectStatus'
import { FailAlert } from 'src/shared/api/alerts'

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


// Опции для выбора статуса.
// «Отменён» не предлагаем: прекращение проекта — это его удаление, при котором
// средства возвращаются в программу. Отдельный статус отмены дублировал бы его.
const statusOptions = [
  { value: Zeus.ProjectStatus.PENDING, label: getProjectStatusLabel(Zeus.ProjectStatus.PENDING) },
  { value: Zeus.ProjectStatus.ACTIVE, label: getProjectStatusLabel(Zeus.ProjectStatus.ACTIVE) },
  { value: Zeus.ProjectStatus.VOTING, label: getProjectStatusLabel(Zeus.ProjectStatus.VOTING) },
  { value: Zeus.ProjectStatus.RESULT, label: getProjectStatusLabel(Zeus.ProjectStatus.RESULT) },
  { value: Zeus.ProjectStatus.FINALIZED, label: getProjectStatusLabel(Zeus.ProjectStatus.FINALIZED) },
]

// Обработчик клика по селекту - переключает dropdown
const handleClick = () => {
  if (!readonly.value && selectRef.value) {
    // selectRef.value.togglePopup() //TODO: не работает потому что не существует
  }
}

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

