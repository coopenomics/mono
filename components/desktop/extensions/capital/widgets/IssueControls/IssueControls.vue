<template lang="pug">
div
  UpdateStatus(
    v-if='issue'
    :model-value='issue.status'
    :issue-hash='issue.issue_hash'
    label='Статус'
    :readonly='!permissions?.can_change_status'
    :allowed-transitions='(permissions)?.allowed_status_transitions'
    @update:modelValue='handleStatusUpdate'
  ).full-width.q-mb-sm

  SetCreatorButton(
    v-if='issue'
    :issue='issue'
    :dense='true'
    :permissions='permissions'
    @creators-set='handleCreatorsSet'
    @issue-updated='handleIssueUpdated'
  ).full-width.q-mb-sm

  UpdatePriority(
    v-if='issue'
    :model-value='issue.priority'
    :issue-hash='issue.issue_hash'
    label='Приоритет'
    :readonly='!permissions?.can_set_priority'
    @update:modelValue='handlePriorityUpdate'
  ).full-width.q-mb-sm

  .issue-controls-plan-fact.q-mb-sm(v-if='issue')
    UpdateEstimate(
      :model-value='issue.estimate'
      :issue-hash='issue.issue_hash'
      label='План (ч)'
      :readonly='!permissions?.can_set_estimate'
      @update:modelValue='handleEstimateUpdate'
    )
    UpdateEstimate(
      :key='`fact-${factHours}`'
      :model-value='factHours'
      :issue-hash='issue.issue_hash'
      label='Факт (ч)'
      readonly
    )

  UpdateLabels(
    v-if='issue'
    :model-value='issueLabels'
    :issue-hash='issue.issue_hash'
    label='Метки'
    :readonly='!permissions?.can_edit_issue'
    @update:modelValue='handleLabelsUpdate'
  ).full-width.q-mb-sm

</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IIssuePermissions } from 'app/extensions/capital/entities/Issue/model'
import { UpdateStatus, UpdatePriority, UpdateEstimate, UpdateLabels } from '../../features/Issue/UpdateIssue'
import { getIssueLabels } from 'app/extensions/capital/shared/lib'
import { SetCreatorButton } from '../../features/Issue/SetCreator'

interface Props {
  issue: any // IIssue тип
  permissions?: IIssuePermissions | null
}

interface Emits {
  (e: 'update:status', value: any): void
  (e: 'update:priority', value: any): void
  (e: 'update:estimate', value: number): void
  (e: 'update:labels', value: string[]): void
  (e: 'creators-set', creators: any[]): void
  (e: 'issue-updated', issue: any): void
}

const props = withDefaults(defineProps<Props>(), {
  permissions: null,
})
const emit = defineEmits<Emits>()

const issueLabels = computed(() => (props.issue ? getIssueLabels(props.issue) : []))

/** Факт = сумма записей учёта времени. */
const factHours = computed(() => Number(props.issue?.fact) || 0)

const handleStatusUpdate = (value: any) => {
  emit('update:status', value)
}

const handlePriorityUpdate = (value: any) => {
  emit('update:priority', value)
}

const handleEstimateUpdate = (value: number) => {
  emit('update:estimate', value)
}

const handleLabelsUpdate = (value: string[]) => {
  emit('update:labels', value)
}

const handleCreatorsSet = (creators: any[]) => {
  emit('creators-set', creators)
}

const handleIssueUpdated = (issue: any) => {
  emit('issue-updated', issue)
}
</script>

<style lang="scss" scoped>
.issue-controls-plan-fact {
  display: flex;
  width: 100%;
  gap: var(--p-2);

  > * {
    flex: 1 1 0;
    min-width: 0;
  }
}
</style>
