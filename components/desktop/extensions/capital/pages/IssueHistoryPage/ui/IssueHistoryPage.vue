<template lang="pug">
div.q-px-md(v-if="issueHash")
  IssueLogsTableWidget(
    :issue-hash="issueHash"
    :refresh-trigger="logsRefreshTrigger"
  )
</template>

<script lang="ts" setup>
import { computed, inject } from 'vue'
import { IssueLogsTableWidget } from 'app/extensions/capital/widgets/IssueLogsTableWidget'
import { ISSUE_PAGE_KEY } from '../../IssuePage/model/context'

const ctx = inject(ISSUE_PAGE_KEY)
if (!ctx) {
  throw new Error('IssueHistoryPage: отсутствует контекст IssuePage')
}

const issueHash = computed(() => ctx.issue.value?.issue_hash ?? '')
const logsRefreshTrigger = computed(() => ctx.logsRefreshTrigger.value)
</script>
