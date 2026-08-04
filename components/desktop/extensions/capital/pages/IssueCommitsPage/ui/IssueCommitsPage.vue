<template lang="pug">
div.q-px-md
  IssueLinkedGitCommitsWidget(
    v-if="linkedGitCommits.length"
    :commits="linkedGitCommits"
  )
  CapitalSectionEmpty.capital-section-empty--centered(
    v-else
    icon="code"
    title="Коммитов пока нет"
    body="Привязанные коммиты появятся здесь после связи задачи с репозиторием."
  )
</template>

<script lang="ts" setup>
import { computed, inject } from 'vue'
import { Zeus } from '@coopenomics/sdk'
import { IssueLinkedGitCommitsWidget } from 'app/extensions/capital/widgets'
import { CapitalSectionEmpty } from 'app/extensions/capital/shared/ui/CapitalSectionEmpty'
import { ISSUE_PAGE_KEY } from '../../IssuePage/model/context'

type LinkedGitCommit = Zeus.ModelTypes['CapitalIssueLinkedGitCommit']

const ctx = inject(ISSUE_PAGE_KEY)
if (!ctx) {
  throw new Error('IssueCommitsPage: отсутствует контекст IssuePage')
}

const linkedGitCommits = computed(
  () => (ctx.linkedGitCommits.value ?? []) as LinkedGitCommit[],
)
</script>
