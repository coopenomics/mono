<template lang="pug">
div(
  :class="compactMobile ? 'capital-sidebar-mobile-compact q-px-md q-pb-sm' : 'capital-sidebar-root-desktop q-pa-md'"
)
  template(v-if="compactMobile")
    q-btn.capital-sidebar-details-btn(
      flat
      dense
      no-caps
      align="left"
      size="sm"
      padding="xs sm"
      color="primary"
      :icon="detailsOpen ? 'expand_less' : 'expand_more'"
      :label="detailsOpen ? 'Свернуть' : 'Подробнее'"
      @click="detailsOpen = !detailsOpen"
    )
    q-slide-transition
      div(v-show="detailsOpen")
        IssueControls(
          :issue='issue'
          :permissions='permissions'
          @update:status='handleStatusUpdate'
          @update:priority='handlePriorityUpdate'
          @update:estimate='handleEstimateUpdate'
          @update:labels='handleLabelsUpdate'
          @creators-set='handleCreatorsSet'
          @issue-updated='handleIssueUpdated'
        ).full-width.q-mt-xs

        IssueMetricBindingsPanel.q-mb-sm(
          v-if='issue && projectHash'
          :issue-hash='issue.issue_hash'
          :project-hash='projectHash'
          :readonly='isMetricsReadonly'
        )

        MoveIssueButton(
          v-if='issue && (projectHash || permissions?.can_move_issue || permissions?.can_edit_issue)'
          :issue='issue'
          :project-hash='projectHash'
          :permissions='permissions'
          :parent-project-hash='parentProjectHash'
          @moved='emit("issue-moved", $event)'
        ).q-mb-xs

        DeleteIssueButton(
          v-if='issue && permissions?.can_delete_issue'
          :issue-hash='issue.issue_hash'
          :project-hash='projectHash || ""'
          :can-delete='true'
          @deleted='emit("issue-deleted")'
        )

  template(v-else)
    .capital-sidebar-body
      IssueControls(
        :issue='issue'
        :permissions='permissions'
        @update:status='handleStatusUpdate'
        @update:priority='handlePriorityUpdate'
        @update:estimate='handleEstimateUpdate'
        @update:labels='handleLabelsUpdate'
        @creators-set='handleCreatorsSet'
        @issue-updated='handleIssueUpdated'
      ).full-width

      IssueMetricBindingsPanel.q-mt-sm(
        v-if='issue && projectHash'
        :issue-hash='issue.issue_hash'
        :project-hash='projectHash'
        :readonly='isMetricsReadonly'
      )

      MoveIssueButton(
        v-if='issue && (projectHash || permissions?.can_move_issue || permissions?.can_edit_issue)'
        :issue='issue'
        :project-hash='projectHash'
        :permissions='permissions'
        :parent-project-hash='parentProjectHash'
        @moved='emit("issue-moved", $event)'
      ).q-mt-sm

    .capital-sidebar-delete-footer(
      v-if="issue && permissions?.can_delete_issue"
    )
      DeleteIssueButton(
        :issue-hash='issue.issue_hash'
        :project-hash='projectHash || ""'
        :can-delete='true'
        @deleted='emit("issue-deleted")'
      )
</template>

<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import type { IIssue, IIssuePermissions } from 'app/extensions/capital/entities/Issue/model'
import { IssueControls } from 'app/extensions/capital/widgets/IssueControls'
import { DeleteIssueButton } from 'app/extensions/capital/features/Issue/DeleteIssue'
import { MoveIssueButton } from 'app/extensions/capital/features/Issue/MoveIssue'
import { IssueMetricBindingsPanel } from 'app/extensions/capital/features/Metric/BindIssueMetrics'
import { Zeus } from '@coopenomics/sdk'

interface Props {
  issue: IIssue | null | undefined
  permissions?: IIssuePermissions | null
  /** Мобильный layout: контролы и удаление по кнопке «Подробнее» */
  compactMobile?: boolean
  /** Хеш проекта/компонента-владельца списка задач (для стора и удаления) */
  projectHash?: string
  /** parent_hash родительского проекта текущего компонента (для списка других компонентов того же проекта) */
  parentProjectHash?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  compactMobile: false,
})

const detailsOpen = ref(false)

/** Привязки метрик фиксируются при DONE — дальше только просмотр */
const isMetricsReadonly = computed(
  () =>
    !(props.permissions?.can_edit_issue) ||
    props.issue?.status === Zeus.IssueStatus.DONE,
)

watch(
  () => props.compactMobile,
  (enabled) => {
    if (!enabled) {
      detailsOpen.value = false
    }
  },
)

const emit = defineEmits<{
  'update:status': [value: unknown]
  'update:priority': [value: unknown]
  'update:estimate': [value: number]
  'update:labels': [value: string[]]
  'creators-set': [creators: unknown[]]
  'issue-updated': [issue: unknown]
  'issue-deleted': []
  'issue-moved': [
    payload: { updatedIssue: IIssue; fromProjectHash: string; toProjectHash: string },
  ]
}>()

const handleStatusUpdate = (value: unknown) => {
  emit('update:status', value)
}

const handlePriorityUpdate = (value: unknown) => {
  emit('update:priority', value)
}

const handleEstimateUpdate = (value: number) => {
  emit('update:estimate', value)
}

const handleLabelsUpdate = (value: string[]) => {
  emit('update:labels', value)
}

const handleCreatorsSet = (creators: unknown[]) => {
  emit('creators-set', creators)
}

const handleIssueUpdated = (issue: unknown) => {
  emit('issue-updated', issue)
}
</script>

<style lang="scss" scoped>
// Родитель (.issue-sidebar-pane) — column + full-height + .col на этом корне.
// Заполняем высоту flex-ом и прижимаем удаление margin-top: auto.
.capital-sidebar-root-desktop {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
}

.capital-sidebar-body {
  flex: 0 0 auto;
}

.capital-sidebar-delete-footer {
  margin-top: auto;
  flex-shrink: 0;
  border-top: 1px solid var(--p-line);
  padding-top: var(--p-3);
  background: var(--p-surface);
}

.capital-sidebar-mobile-compact {
  padding-top: 0;
}

.capital-sidebar-details-btn {
  margin-top: 0;
  margin-bottom: 0;
  width: 100%;
}
</style>
