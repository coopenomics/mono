<template lang="pug">
//- Процесс стола бухгалтера на всю страницу — продолжение правой панели
//- реестра процессов. Строка контекста называет процесс, ниже тот же виджет,
//- что в панели: содержание, документы, операции, проводки.
.process-page
  .process-page__context
    BackLink(:label='$t("reports.processPage.backToRegistry")', @click='backToRegistry')
    span.process-page__type(v-if='processType') · {{ processTypeLabel(processType) }}
    EntityIdBadge.q-ml-sm(:rawId='processHash' copy-on-click)
  DeskProcessView(
    :key='processHash'
    :coopname='info.coopname'
    :process-hash='processHash'
    @resolved='(type) => (processType = type)'
  )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSystemStore } from 'src/entities/System/model'
import { EntityIdBadge } from 'src/shared/ui'
import { BackLink } from 'src/shared/ui/domain'
import { processTypeLabel } from 'src/shared/lib/ledger2'
import { DeskProcessView } from '../../../shared/ui'

const { info } = useSystemStore()
const route = useRoute()
const router = useRouter()

const processHash = computed(() => String(route.params.processHash ?? '').toLowerCase())
const processType = ref<string | null>(null)

function backToRegistry(): void {
  void router.push({ name: 'reports-processes', params: { coopname: info.coopname } }) // i18n-ignore
}
</script>

<style scoped>
.process-page {
  padding: var(--p-6);
}
.process-page__context {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  margin-bottom: var(--p-4);
  color: var(--p-ink-2);
}
@media (max-width: 768px) {
  .process-page {
    padding: var(--p-4);
  }
}
</style>
