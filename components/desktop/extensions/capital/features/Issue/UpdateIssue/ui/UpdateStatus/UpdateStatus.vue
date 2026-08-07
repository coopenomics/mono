<template lang="pug">
q-select(
  tabIndex=100
  ref="selectRef"
  v-model="selectedStatusOption"
  :options="statusOptions"
  option-value="value"
  option-label="label"

  dense
  standout="bg-teal text-white"
  :label="label"
  :readonly="isReadonly"
  @update:model-value="handleStatusChange"
)
</template>

<script setup lang="ts">
import { ref, computed, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'

import { useUpdateIssue } from '../../model'
import { useIssueStore } from 'app/extensions/capital/entities/Issue/model'
import { getIssueStatusLabel } from 'app/extensions/capital/shared/lib'
import { ISSUE_PAGE_KEY } from 'app/extensions/capital/pages/IssuePage/model/context'

interface Props {
  modelValue: Zeus.IssueStatus
  issueHash: string
  label?: string
  readonly?: boolean
  allowedTransitions?: string[]
}

interface Emits {
  (e: 'update:modelValue', value: Zeus.IssueStatus): void
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Статус',
  readonly: false
})

const emit = defineEmits<Emits>()

const route = useRoute()
const issuePage = inject(ISSUE_PAGE_KEY, null)
const projectHash = computed(
  () => issuePage?.projectHash.value || (route.params.project_hash as string) || '',
)

// Ref для доступа к q-select компоненту
const selectRef = ref()

// Используем composable для обновления задач
const { debounceSave } = useUpdateIssue()
const issueStore = useIssueStore()

// Все возможные опции статуса
const allStatusOptions = [
  { value: Zeus.IssueStatus.BACKLOG, label: getIssueStatusLabel(Zeus.IssueStatus.BACKLOG) },
  { value: Zeus.IssueStatus.TODO, label: getIssueStatusLabel(Zeus.IssueStatus.TODO) },
  { value: Zeus.IssueStatus.IN_PROGRESS, label: getIssueStatusLabel(Zeus.IssueStatus.IN_PROGRESS) },
  { value: Zeus.IssueStatus.ON_REVIEW, label: getIssueStatusLabel(Zeus.IssueStatus.ON_REVIEW) },
  { value: Zeus.IssueStatus.DONE, label: getIssueStatusLabel(Zeus.IssueStatus.DONE) },
  { value: Zeus.IssueStatus.CANCELED, label: getIssueStatusLabel(Zeus.IssueStatus.CANCELED) },
]

// Текущий выбранный статус - объект с value и label
const selectedStatusOption = ref(allStatusOptions.find(option => option.value === props.modelValue))

// Синхронизируем с внешним значением
watch(() => props.modelValue, (newValue) => {
  selectedStatusOption.value = allStatusOptions.find(option => option.value === newValue)
})

// Вычисляемое свойство для определения readonly
const isReadonly = computed(() => {
  // Если явно указан readonly, используем его
  if (props.readonly) return true

  // Если нет доступных переходов, компонент тоже должен быть readonly
  if (!props.allowedTransitions || props.allowedTransitions.length === 0) return true

  return false
})

// Отфильтрованные опции для выбора статуса (только допустимые переходы)
const statusOptions = computed(() => {
  if (!props.allowedTransitions || props.allowedTransitions.length === 0) {
    // Если нет доступных переходов, показываем только текущий статус
    const currentStatusOption = allStatusOptions.find(option => option.value === props.modelValue)
    return currentStatusOption ? [currentStatusOption] : allStatusOptions
  }

  // Фильтруем опции по допустимым переходам (текущий статус уже исключен на бэкенде)
  const filteredOptions = allStatusOptions.filter(option =>
    (props.allowedTransitions || []).includes(option.value as Zeus.IssueStatus)
  )

  return filteredOptions
})

// Обработчик изменения статуса
const handleStatusChange = async (option: { value: Zeus.IssueStatus; label: string } | null) => {
  if (!option || option.value === props.modelValue) return

  // Сохраняем предыдущее состояние для возможного отката
  const previousStatus = props.modelValue

  try {
    const updateData = {
      issue_hash: props.issueHash,
      status: option.value,
    }

    // Обновляем локальное значение оптимистично
    emit('update:modelValue', option.value)

    // Автоматическое сохранение с задержкой
    await debounceSave(updateData, projectHash.value)

    // После успешного сохранения перезагружаем задачу для получения свежих permissions
    await issueStore.updateIssueByHash(projectHash.value, props.issueHash)
  } catch (error) {
    console.error('Failed to update status:', error)

    // Откатываем к предыдущему состоянию в случае ошибки
    emit('update:modelValue', previousStatus)
  }
}
</script>
