<template lang="pug">
q-input(
  v-model.number="selectedEstimate"
  type="number"
  :min="0"
  step="any"
  standout="bg-teal text-white"
  :label="label"
  :readonly="readonly"
  @update:model-value="handleEstimateChange"
  dense
)
</template>

<script setup lang="ts">
import { ref, watch, computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useUpdateIssue } from '../../model'
import { ISSUE_PAGE_KEY } from 'app/extensions/capital/pages/IssuePage/model/context'

interface Props {
  modelValue: number
  issueHash: string
  label?: string
  readonly?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Оценка (часы)',
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

// Текущая выбранная оценка
const selectedEstimate = ref<number>(props.modelValue)

// Обработчик изменения оценки
const handleEstimateChange = async (newEstimate: string | number | null) => {
  // Если поле readonly, не позволяем изменения
  if (props.readonly) return

  // Конвертируем в число, по умолчанию 0
  const numericEstimate = typeof newEstimate === 'string' ? parseFloat(newEstimate) : (newEstimate || 0)

  // Проверяем, что значение валидное и не отрицательное
  const validEstimate = isNaN(numericEstimate) ? 0 : Math.max(0, numericEstimate)

  if (validEstimate === props.modelValue) return

  try {
    const updateData = {
      issue_hash: props.issueHash,
      estimate: validEstimate,
    }

    // Автоматическое сохранение с задержкой
    debounceSave(updateData, projectHash.value)

    // Обновляем локальное значение
    emit('update:modelValue', validEstimate)
  } catch (error) {
    console.error('Failed to update estimate:', error)
  }
}

// Синхронизируем с внешним значением
watch(() => props.modelValue, (newValue) => {
  selectedEstimate.value = newValue
})
</script>
