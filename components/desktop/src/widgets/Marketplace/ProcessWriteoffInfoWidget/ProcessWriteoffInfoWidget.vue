<template lang="pug">
.process-writeoff-info
  Loader(v-if='loading', :text='$t("marketplace.processWriteoffInfo.loadingText")')
  div(v-else-if='snapshot')
    .row.q-col-gutter-md
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processWriteoffInfo.processTypeLabel') }}
        .text-body2.text-weight-medium {{ $t('marketplace.processWriteoffInfo.processTypeValue') }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processWriteoffInfo.sourceLabel') }}
        .text-body2 {{ triggerLabel }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processWriteoffInfo.statusLabel') }}
        .text-body2 {{ statusLabel }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processWriteoffInfo.cycleStartedLabel') }}
        .text-body2 {{ formatDate(field('cycle_started_at')) }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processWriteoffInfo.totalAmountLabel') }}
        .text-body2.font-monospace {{ field('total_amount') ? formatAsset2Digits(field('total_amount')) : '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processWriteoffInfo.councilDecisionLabel') }}
        .text-body2 {{ field('decision_id') || $t('marketplace.processWriteoffInfo.notRegistered') }}
    .row.q-mt-md
      q-btn(
        flat
        no-caps
        color='primary'
        icon='fa-solid fa-up-right-from-square'
        :label='$t("marketplace.processWriteoffInfo.openAtWriteoffDeskButton")'
        :to='deepLink'
      )
  div(v-else)
    .text-caption.text-grey-7 {{ $t('marketplace.processWriteoffInfo.contentUnavailable') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { uiLocale, t } from 'src/shared/i18n';
import { useProcessStore, type IProcessSnapshot } from 'src/entities/Process'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { Loader } from 'src/shared/ui/Loader'

interface Props {
  processHash: string
  processType: string
  coopname: string
}
const props = defineProps<Props>()

const processStore = useProcessStore()
const loading = ref(true)
const snapshot = ref<IProcessSnapshot | null>(null)

function field(name: string): string {
  const v = snapshot.value?.[name]
  return typeof v === 'string' ? v : v != null ? String(v) : ''
}

const triggerLabel = computed(() => {
  const v = field('trigger')
  if (v === 'cron') return t('marketplace.processWriteoffInfo.sourceAutomatic')
  if (v === 'manual') return t('marketplace.processWriteoffInfo.sourceManual')
  return '—'
})

// Подписи статусов проекта списания — согласованы с админ-столом
// (AdminWriteoffs) и столом ПВЗ (PvzWriteoffs).
const WRITEOFF_STATUS_LABEL: Record<string, string> = {
  DRAFT: t('marketplace.writeoff.status.draft'),
  PROPOSED: t('marketplace.writeoff.status.onAgenda'),
  ON_AGENDA: t('marketplace.writeoff.status.onAgenda'),
  AUTHORIZED: t('marketplace.writeoff.status.approved'),
  EXECUTING: t('marketplace.writeoff.status.inProgress'),
  EXECUTED: t('marketplace.writeoff.status.executed'),
  REJECTED: t('marketplace.writeoff.status.rejected'),
  DECLINED: t('marketplace.writeoff.status.rejected'),
}
const statusLabel = computed(() => {
  const raw = field('status')
  return WRITEOFF_STATUS_LABEL[raw] || raw || '—'
})

function formatDate(value: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(uiLocale())
}

const deepLink = computed(() => ({
  name: 'marketplace-writeoffs',
  params: { coopname: props.coopname },
  query: { process_hash: props.processHash },
}))

onMounted(async () => {
  try {
    snapshot.value = await processStore.loadLatestSnapshot({
      coopname: props.coopname,
      hash: props.processHash,
    })
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
</style>
