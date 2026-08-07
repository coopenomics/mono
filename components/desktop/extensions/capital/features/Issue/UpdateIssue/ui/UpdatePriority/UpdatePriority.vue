<template lang="pug">
q-select(
  v-model="selectedPriority"
  :options="priorityOptions"
  option-value="value"
  option-label="label"
  emit-value
  map-options
  standout="bg-teal text-white"
  dense
  :label="label"
  :readonly="readonly"
  :disabled="readonly"
  @update:model-value="handlePriorityChange"
)
</template>

<script setup lang="ts">
import { ref, watch, computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { getIssuePriorityLabel } from 'app/extensions/capital/shared/lib'
import { useUpdateIssue } from '../../model'
import { ISSUE_PAGE_KEY } from 'app/extensions/capital/pages/IssuePage/model/context'

interface Props {
  modelValue: Zeus.IssuePriority
  issueHash: string
  label?: string
  readonly?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: Zeus.IssuePriority): void
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Приоритет',
  readonly: false
})

const emit = defineEmits<Emits>()

const route = useRoute()
const issuePage = inject(ISSUE_PAGE_KEY, null)
const projectHash = computed(
  () => issuePage?.projectHash.value || (route.params.project_hash as string) || '',
)

// Используем composable для обновления задач
const { debounceSave } = useUpdateIssue()

// Текущий выбранный приоритет
const selectedPriority = ref<Zeus.IssuePriority>(props.modelValue)

// Опции для выбора приоритета
const priorityOptions = [
  { value: Zeus.IssuePriority.LOW, label: getIssuePriorityLabel(Zeus.IssuePriority.LOW) },
  { value: Zeus.IssuePriority.MEDIUM, label: getIssuePriorityLabel(Zeus.IssuePriority.MEDIUM) },
  { value: Zeus.IssuePriority.HIGH, label: getIssuePriorityLabel(Zeus.IssuePriority.HIGH) },
  { value: Zeus.IssuePriority.URGENT, label: getIssuePriorityLabel(Zeus.IssuePriority.URGENT) },
]

// Обработчик изменения приоритета
const handlePriorityChange = async (newPriority: Zeus.IssuePriority) => {
  if (!newPriority || newPriority === props.modelValue) return

  try {
    const updateData = {
      issue_hash: props.issueHash,
      priority: newPriority,
    }

    // Автоматическое сохранение с задержкой
    debounceSave(updateData, projectHash.value)

    // Обновляем локальное значение
    emit('update:modelValue', newPriority)
  } catch (error) {
    console.error('Failed to update priority:', error)
  }
}

// Синхронизируем с внешним значением
watch(() => props.modelValue, (newValue) => {
  selectedPriority.value = newValue
})
</script>
