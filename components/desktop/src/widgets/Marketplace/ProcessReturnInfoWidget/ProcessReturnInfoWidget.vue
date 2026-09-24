<template lang="pug">
.process-return-info
  Loader(v-if='loading', :text='$t("marketplace.processReturnInfo.loadingText")')
  div(v-else-if='snapshot')
    .row.q-col-gutter-md
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processReturnInfo.processTypeLabel') }}
        .text-body2.text-weight-medium {{ $t('marketplace.processReturnInfo.processTypeValue') }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processReturnInfo.kuLabel') }}
        .text-body2 {{ field('braname') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processReturnInfo.ordererLabel') }}
        .text-body2.font-monospace {{ field('orderer') || field('orderer_account') || '—' }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processReturnInfo.statusLabel') }}
        .text-body2 {{ statusLabel }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processReturnInfo.sourceOrderLabel') }}
        .text-body2.font-monospace {{ shortHash(field('order_hash') || field('parent_order_hash')) }}
      .col-12.col-sm-6
        .text-caption.text-grey-7 {{ $t('marketplace.processReturnInfo.reasonLabel') }}
        .text-body2 {{ field('reason') || '—' }}
    .row.q-mt-md
      q-btn(
        flat
        no-caps
        color='primary'
        icon='fa-solid fa-up-right-from-square'
        :label='$t("marketplace.processReturnInfo.openAtPvzButton")'
        :to='deepLink'
      )
  div(v-else)
    .text-caption.text-grey-7 {{ $t('marketplace.processReturnInfo.contentUnavailable') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useProcessStore, type IProcessSnapshot } from 'src/entities/Process'
import { Loader } from 'src/shared/ui/Loader'
import { t } from 'src/shared/i18n';

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

function shortHash(v: string): string {
  if (!v) return '—'
  return v.length > 16 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v
}

// Подписи статусов гарантийного возврата — канон ReturnClaimDetailsDialog.
const RETURN_STATUS_LABEL: Record<string, string> = {
  PENDING_CHAIRMAN_REVIEW: t('marketplace.return.status.pendingOperator'),
  APPROVED_FOR_VISIT: t('marketplace.return.status.invitedToKu'),
  REJECTED_REMOTELY: t('marketplace.return.status.rejectedRemotely'),
  REJECTED_AT_VISIT: t('marketplace.return.status.rejectedOnSite'),
  PENDING_COUNCIL: t('marketplace.return.status.pendingCouncil'),
  ACCEPTED_BY_COUNCIL: t('marketplace.return.status.councilApproved'),
  DECLINED_BY_COUNCIL: t('marketplace.return.status.councilDeclined'),
  HANDED_BACK: t('marketplace.return.status.returnedToMember'),
}
const statusLabel = computed(() => {
  const raw = field('status')
  return RETURN_STATUS_LABEL[raw] || raw || '—'
})

const deepLink = computed(() => ({
  name: 'marketplace-pvz-returns',
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
