<template lang="pug">
div.q-px-md
  AutoSaveIndicator(
    :is-auto-saving="isAutoSaving"
    :auto-save-error="autoSaveError"
  )

  Editor(
    v-if="issue"
    v-model="issue.description"
    label="Описание задачи"
    placeholder="Опишите задачу подробно..."
    :readonly="!issue.permissions?.can_edit_issue"
    :padded="false"
    @change="handleDescriptionChange"
  )

  .issue-worklog.q-mt-md(v-if="issue")
    .issue-worklog__title История рабочего времени
    TimeEntriesWidget(
      :issue-hash="issue.issue_hash"
      :creators="issue.creators || []"
    )

  .issue-metric-bindings.q-mt-md(v-if="issue && projectHash")
    q-separator.q-mb-md
    IssueMetricBindingsPanel(
      :issue-hash="issue.issue_hash"
      :project-hash="projectHash"
    )
</template>

<script lang="ts" setup>
import { inject } from 'vue'
import { Editor, AutoSaveIndicator } from 'src/shared/ui'
import { TimeEntriesWidget } from 'app/extensions/capital/widgets'
import { ISSUE_PAGE_KEY } from '../../IssuePage/model/context'
import { IssueMetricBindingsPanel } from 'app/extensions/capital/features/Metric/BindIssueMetrics'

const ctx = inject(ISSUE_PAGE_KEY)
if (!ctx) {
  throw new Error('IssueDescriptionPage: отсутствует контекст IssuePage')
}

const issue = ctx.issue
const projectHash = ctx.projectHash
const isAutoSaving = ctx.isAutoSaving
const autoSaveError = ctx.autoSaveError
const handleDescriptionChange = () => ctx.handleDescriptionChange()
</script>

<style lang="scss" scoped>
.issue-worklog__title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink-2);
  margin-bottom: var(--p-2);
}
</style>
