<template lang="pug">
div.full-width
  q-select(
    v-if="!readonly"
    v-model="selected"
    multiple
    use-chips
    use-input
    new-value-mode="add-unique"
    input-debounce="0"
    hide-dropdown-icon
    standout="bg-teal text-white"
    :label="label"
    dense
    @update:model-value="onSelectUpdate"
  )
  .readonly-labels(v-else)
    .row.items-center.wrap.q-gutter-xs
      q-chip(
        v-for="tag in modelValue"
        :key="tag"
        dense
        size="sm"
        color="grey-4"
        text-color="dark"
      ) {{ tag }}
      span.text-caption.text-grey-7(v-if="!modelValue.length") Нет меток
</template>

<script setup lang="ts">
import { ref, watch, computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { normalizeIssueLabels } from 'app/extensions/capital/shared/lib'
import { useUpdateIssue } from '../../model'
import { ISSUE_PAGE_KEY } from 'app/extensions/capital/pages/IssuePage/model/context'

function labelsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

interface Props {
  modelValue: string[]
  issueHash: string
  label?: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Метки',
  readonly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const route = useRoute()
const issuePage = inject(ISSUE_PAGE_KEY, null)
const projectHash = computed(
  () => issuePage?.projectHash.value || (route.params.project_hash as string) || '',
)
const { debounceSave } = useUpdateIssue()

const selected = ref<string[]>([...props.modelValue])

watch(
  () => props.modelValue,
  (v) => {
    const next = [...v]
    if (!labelsEqual(next, selected.value)) {
      selected.value = next
    }
  },
  { deep: true },
)

const onSelectUpdate = (val: string[] | string | null) => {
  if (props.readonly) return
  const arr = Array.isArray(val) ? [...val] : []
  const next = normalizeIssueLabels(arr)
  selected.value = next
  const prevNorm = normalizeIssueLabels(props.modelValue)
  if (labelsEqual(next, prevNorm)) return
  debounceSave({ issue_hash: props.issueHash, labels: next }, projectHash.value)
  emit('update:modelValue', next)
}
</script>
