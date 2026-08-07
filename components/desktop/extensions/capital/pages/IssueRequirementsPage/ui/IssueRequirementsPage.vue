<template lang="pug">
div.q-px-md(v-if="issue")
  RequirementsListWidget(
    :filter="requirementsFilter"
    :max-items="50"
    :permissions="issue.permissions"
    empty-title="Артефактов пока нет"
    empty-body="Добавьте первый артефакт, чтобы зафиксировать требования к задаче."
  )
</template>

<script lang="ts" setup>
import { computed, inject } from 'vue'
import { RequirementsListWidget } from 'app/extensions/capital/widgets/RequirementsListWidget'
import { ISSUE_PAGE_KEY } from '../../IssuePage/model/context'

const ctx = inject(ISSUE_PAGE_KEY)
if (!ctx) {
  throw new Error('IssueRequirementsPage: отсутствует контекст IssuePage')
}

const issue = computed(() => ctx.issue.value)
const requirementsFilter = computed(() => ctx.requirementsFilter.value)
</script>
