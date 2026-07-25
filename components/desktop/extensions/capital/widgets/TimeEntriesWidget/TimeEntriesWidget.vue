<template lang="pug">
.time-entries(v-if="issueHash")
  .time-entries__empty.t-sm.t-muted(v-if="!loading && !rows.length")
    | Записей рабочего времени пока нет

  .time-entries__list(v-else-if="rows.length")
    .time-entries__row(v-for="row in rows", :key="row._id")
      .time-entries__who {{ contributorLabel(row.contributor_hash) }}
      .time-entries__meta
        span.time-entries__hours {{ formatHours(row.hours) }}
        span.time-entries__sep ·
        span.time-entries__date {{ formatDate(row.date) }}
      BaseBadge.time-entries__commit(v-if="row.commit_hash", variant="accent")
        | {{ String(row.commit_hash).substring(0, 8) }}

  .row.justify-center.q-py-sm(v-if="loading")
    q-spinner(color="primary", size="24px")
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert } from 'src/shared/api'
import { useTimeEntriesStore } from 'app/extensions/capital/entities/TimeEntries/model'
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model'
import { formatHours } from 'src/shared/lib/utils'
import { BaseBadge } from 'src/shared/ui/base'

const props = defineProps<{
  issueHash: string
  coopname?: string
  username?: string
}>()

const { info } = useSystemStore()
const timeEntriesStore = useTimeEntriesStore()
const contributorStore = useContributorStore()

const timeEntries = ref<{ items?: Array<Record<string, unknown>>; totalCount?: number } | null>(null)
const loading = ref(false)

const rows = computed(() => timeEntries.value?.items ?? [])

const contributorByHash = computed(() => {
  const map = new Map<string, string>()
  for (const c of contributorStore.contributors?.items ?? []) {
    if (c.contributor_hash) {
      map.set(c.contributor_hash, c.display_name || c.username || c.contributor_hash)
    }
  }
  return map
})

const contributorLabel = (hash?: string) => {
  if (!hash) return 'Участник'
  return contributorByHash.value.get(hash) || `${hash.slice(0, 8)}…`
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const loadTimeEntries = async () => {
  if (!props.issueHash) return
  loading.value = true
  try {
    const entries = await timeEntriesStore.loadTimeEntries({
      filter: {
        coopname: props.coopname || info.coopname,
        issue_hash: props.issueHash,
        username: props.username,
      },
      options: {
        page: 1,
        limit: 100,
        sortBy: '_created_at',
        sortOrder: 'DESC',
      },
    })
    timeEntries.value = entries
  } catch (error) {
    console.error('Ошибка при загрузке записей времени:', error)
    FailAlert('Не удалось загрузить записи времени')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!contributorStore.contributors?.items?.length) {
    try {
      await contributorStore.loadContributors({})
    } catch {
      // имена подтянем позже / покажем короткий hash
    }
  }
  await loadTimeEntries()
})

watch(
  () => props.issueHash,
  () => {
    loadTimeEntries()
  },
)
</script>

<style lang="scss" scoped>
.time-entries__empty {
  padding: var(--p-2) 0;
}

.time-entries__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.time-entries__row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--p-2);
  padding: var(--p-2) 0;
  border-bottom: 1px solid var(--p-line);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);

  &:last-child {
    border-bottom: 0;
  }
}

.time-entries__who {
  font-weight: 500;
  color: var(--p-ink);
  min-width: 8rem;
}

.time-entries__meta {
  color: var(--p-ink-2);
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
}

.time-entries__hours {
  color: var(--p-ink);
  font-weight: 500;
}

.time-entries__sep {
  opacity: 0.5;
}

.time-entries__commit {
  margin-left: auto;
}
</style>
