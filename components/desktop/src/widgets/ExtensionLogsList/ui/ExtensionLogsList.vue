<template lang="pug">
.extension-logs
  //- Фильтр по диапазону дат
  .extension-logs__filters
    BaseInput.extension-logs__date(
      v-model="dateFrom"
      type="date"
      label="Дата от"
      clearable
      @clear="handleFilterChange"
      @update:model-value="handleFilterChange"
    )
    BaseInput.extension-logs__date(
      v-model="dateTo"
      type="date"
      label="Дата до"
      clearable
      @clear="handleFilterChange"
      @update:model-value="handleFilterChange"
    )

  //- Скелетон при первичной загрузке
  .extension-logs__skeleton(v-if="loading && !logs.length")
    .log-card(v-for="n in 4", :key="n")
      .log-card__head
        q-skeleton(type="text", width="80px")
        q-skeleton(type="text", width="120px")
      q-skeleton.q-mt-sm(type="rect", height="60px")

  //- Список записей лога
  .extension-logs__list(v-else-if="logs.length")
    .log-card(v-for="row in logs", :key="row.id")
      .log-card__head
        span.log-card__id \#{{ showGlobalIds ? row.id : row.extension_local_id }}
        span.log-card__date {{ formatDate(row.created_at) }}
      .log-card__body
        slot(
          name="log-item",
          :log="parseData(row.data)",
          :row="row",
          :showGlobalIds="showGlobalIds"
        )
          pre.log-card__raw {{ row.data }}

    .extension-logs__foot
      span.extension-logs__count {{ rangeLabel }}
      BaseButton(
        v-if="hasMore",
        variant="ghost",
        size="sm",
        :loading="loading",
        @click="loadMore"
      ) Загрузить ещё

  //- Пусто
  EmptyState(
    v-else,
    title="Логи не найдены",
    body="За выбранный период записей нет."
  )
    template(#icon)
      q-icon(name="receipt_long", size="48px")
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useExtensionStore, type IExtensionLogsResult } from 'src/entities/Extension/model/store'
import { BaseButton } from 'src/shared/ui/base/BaseButton'
import { BaseInput } from 'src/shared/ui/base/BaseInput'
import { EmptyState } from 'src/shared/ui/base/EmptyState'
import { date } from 'quasar'

interface Props {
  extensionName?: string
  showGlobalIds?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  extensionName: undefined,
  showGlobalIds: false
})

const extensionStore = useExtensionStore()

const logs = ref<any[]>([])
const loading = ref(false)
const dateFrom = ref('')
const dateTo = ref('')

const LIMIT = 25
const currentPage = ref(1)
const totalCount = ref(0)

const hasMore = computed(() => logs.value.length < totalCount.value)

const rangeLabel = computed(() =>
  logs.value.length ? `1–${logs.value.length} из ${totalCount.value}` : `0 из ${totalCount.value}`,
)

const formatDate = (dateString: string) => {
  return date.formatDate(new Date(dateString), 'DD.MM.YYYY HH:mm')
}

const parseData = (data: string) => {
  try {
    return JSON.parse(data || '{}')
  } catch {
    return {}
  }
}

const handleFilterChange = () => {
  currentPage.value = 1
  loadLogs(1)
}

const loadMore = () => {
  if (loading.value || !hasMore.value) return
  loadLogs(currentPage.value + 1)
}

const loadLogs = async (page = 1) => {
  loading.value = true
  try {
    const filter: any = {}

    if (props.extensionName) {
      filter.name = props.extensionName
    }
    if (dateFrom.value) {
      filter.createdFrom = new Date(dateFrom.value)
    }
    if (dateTo.value) {
      filter.createdTo = new Date(dateTo.value)
    }

    const options = {
      page,
      limit: LIMIT,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    }

    const result: IExtensionLogsResult = await extensionStore.loadExtensionLogs({ data: filter, options })

    // Первая страница — замена, последующие — дозагрузка.
    logs.value = page === 1 ? result.items : [...logs.value, ...result.items]
    totalCount.value = result.totalCount
    currentPage.value = result.currentPage
  } catch (error) {
    console.error('Error loading extension logs:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadLogs(1)
})
</script>

<style lang="scss" scoped>
.extension-logs {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
}

.extension-logs__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
}

.extension-logs__date {
  flex: 1 1 200px;
  min-width: 0;
}

.extension-logs__list,
.extension-logs__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.log-card {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  padding: var(--p-4, 16px);
}

.log-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding-bottom: var(--p-3, 12px);
  margin-bottom: var(--p-3, 12px);
  border-bottom: 1px solid var(--p-line);
}

.log-card__id {
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  color: var(--p-ink-3);
}

.log-card__date {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-2);
}

.log-card__raw {
  margin: 0;
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  color: var(--p-ink-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.extension-logs__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding-top: var(--p-2, 8px);
}

.extension-logs__count {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-3);
}
</style>
