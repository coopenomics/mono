<template lang="pug">
div.q-px-md
  .row.items-center
    .col
      AutoSaveIndicator(
        :is-auto-saving="isAutoSaving"
        :auto-save-error="autoSaveError"
      )
    .col-auto(v-if="issue")
      RevisionsButton(
        :entity-type="Zeus.CapitalContentEntityType.ISSUE"
        :entity-hash="issue.issue_hash"
        :current-title="issue.title || ''"
        :current-description="issue.description || ''"
        :current-rev="issue.content_rev ?? 0"
        :can-edit="!!issue.permissions?.can_edit_issue"
        @restored="reloadIssue"
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
</template>

<script lang="ts" setup>
import { inject } from 'vue'
import { Zeus } from '@coopenomics/sdk'
import { Editor, AutoSaveIndicator } from 'src/shared/ui'
import { TimeEntriesWidget } from 'app/extensions/capital/widgets'
import { RevisionsButton } from 'app/extensions/capital/features/ContentRevisions'
import { ISSUE_PAGE_KEY } from '../../IssuePage/model/context'

const ctx = inject(ISSUE_PAGE_KEY)
if (!ctx) {
  throw new Error('IssueDescriptionPage: отсутствует контекст IssuePage')
}

const issue = ctx.issue
const isAutoSaving = ctx.isAutoSaving
const autoSaveError = ctx.autoSaveError
const handleDescriptionChange = () => ctx.handleDescriptionChange()
const reloadIssue = () => ctx.reloadIssue()
</script>

<style lang="scss" scoped>
.issue-worklog__title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink-2);
  margin-bottom: var(--p-2);
}
</style>
