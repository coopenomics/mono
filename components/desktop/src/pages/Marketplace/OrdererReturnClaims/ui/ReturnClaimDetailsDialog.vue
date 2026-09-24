<script lang="ts" setup>
import { computed } from 'vue';
import { uiLocale } from 'src/shared/i18n';
import { BaseCard } from 'src/shared/ui/base';
import { TakeoverDialog } from 'src/widgets/Marketplace/TakeoverDialog';
import { HandoffQr } from 'src/widgets/Marketplace/HandoffQr';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { encodeReturnClaimCode } from 'src/shared/lib/marketplace';
import {
  defectCategoryLabel,
  returnClaimStatusLabel,
  returnClaimDecisionLabel,
  type MarketplaceReturnClaimView,
} from '../api';

/**
 * Story 7.1-7.4 — детали заявления для пайщика: текущий статус, причина,
 * фото (только просмотр), журнал решений председателя, и при принятии
 * возврата — снапшот compensating-forward (восстановленная сумма + tx_hash
 * композитной транзакции `accretrn`).
 */

const props = defineProps<{
  modelValue: boolean;
  claim: MarketplaceReturnClaimView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const statusKind = computed<'info' | 'success' | 'warning' | 'danger'>(() => {
  if (!props.claim) return 'info';
  switch (props.claim.status) {
    case 'ACCEPTED_BY_COUNCIL':
      return 'success';
    case 'REJECTED_REMOTELY':
    case 'REJECTED_AT_VISIT':
      return 'danger';
    case 'APPROVED_FOR_VISIT':
    case 'DECLINED_BY_COUNCIL':
      return 'warning';
    default:
      return 'info';
  }
});

function close(): void {
  emit('update:modelValue', false);
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(uiLocale());
}
</script>

<template lang="pug">
TakeoverDialog(
  :model-value="modelValue"
  :title="claim ? $t(`marketplace.returnClaimDetailsDialog.title`, { claimId: claim.id.slice(0, 8), status: returnClaimStatusLabel(claim.status) }) : $t('marketplace.returnClaimDetailsDialog.titleFallback')"
  :lead-text="claim ? $t(`marketplace.returnClaimDetailsDialog.subtitle`, { orderId: claim.order_id.slice(0, 8), quantity: claim.actual_quantity, amount: formatAsset2Digits(claim.total_refund) }) : ''"
  :kind="statusKind"
  :cancel-label="$t('common.action.close')"
  :confirm-label="$t('marketplace.returnClaimDetailsDialog.confirmLabel')"
  :disable-confirm="false"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  @confirm="close"
  @cancel="close"
)
  template(#default v-if="claim")
    .mp-return-details
      BaseCard.q-mb-md(v-if="claim.status === 'APPROVED_FOR_VISIT'")
        .flex.flex-center.column
          .text-subtitle1.q-mb-sm {{ $t('marketplace.returnClaimDetailsDialog.showCodeHint') }}
          HandoffQr(
            :value="encodeReturnClaimCode(claim.coopname, claim.id)"
            :caption="$t('marketplace.returnClaimDetailsDialog.scanCaption')"
          )

      BaseCard.q-mb-md
        .text-subtitle1 {{ $t('marketplace.returnClaimDetailsDialog.reasonLabel') }}
        .q-mt-sm {{ claim.reason_text }}
        .q-mt-sm.text-caption.text-grey(v-if="claim.defect_category")
          | {{ $t('marketplace.returnClaimDetailsDialog.defectCategoryText', { category: defectCategoryLabel(claim.defect_category) }) }}

      BaseCard.q-mb-md
        .text-subtitle1 {{ $t('marketplace.returnClaimDetailsDialog.photosTitle') }}
        .row.q-mt-sm.q-gutter-sm
          a.mp-return-details__thumb(
            v-for="(p, i) in claim.photos" :key="p.content_hash"
            :href="p.url" target="_blank" rel="noopener"
          )
            img(:src="p.url" :alt="$t(`marketplace.returnClaimDetailsDialog.photoLabel`, { index: i + 1 })")

      BaseCard.q-mb-md(v-if="claim.decision_log.length > 0")
        .text-subtitle1 {{ $t('marketplace.returnClaimDetailsDialog.historyTitle') }}
        q-timeline(layout="dense" color="primary").q-mt-sm
          q-timeline-entry(
            v-for="entry in claim.decision_log" :key="entry.tx_hash"
            :title="returnClaimDecisionLabel(entry.decision)"
            :subtitle="$t(`marketplace.returnClaimDetailsDialog.historyEntry`, { chairmanName: entry.by_chairman_name || entry.by_chairman_account, branchName: entry.braname_name || entry.braname, date: formatDateTime(entry.at) })"
            :color="entry.decision === 'council_authorized' ? 'positive' : entry.decision === 'reject_remote' || entry.decision === 'reject_at_visit' || entry.decision === 'council_declined' ? 'negative' : 'primary'"
          )
            | {{ entry.comment }}

      BaseCard.q-mb-md(v-if="claim.on_site_inspection")
        .text-subtitle1 {{ $t('marketplace.returnClaimDetailsDialog.inspectionResultTitle') }}
        .q-mt-sm {{ claim.on_site_inspection.result_text }}
        .q-mt-sm.text-caption.text-grey(v-if="claim.on_site_inspection.scanned_barcode")
          | {{ $t('marketplace.returnClaimDetailsDialog.scannedBarcodeText', { barcode: claim.on_site_inspection.scanned_barcode }) }}
        .row.q-mt-sm.q-gutter-sm(v-if="claim.on_site_inspection.photos.length > 0")
          a.mp-return-details__thumb(
            v-for="(p, i) in claim.on_site_inspection.photos" :key="p.content_hash"
            :href="p.url" target="_blank" rel="noopener"
          )
            img(:src="p.url" :alt="$t(`marketplace.returnClaimDetailsDialog.inspectionPhotoLabel`, { index: i + 1 })")

      BaseCard.q-mb-md(v-if="claim.status === 'PENDING_COUNCIL'")
        .text-subtitle1 {{ $t('marketplace.returnClaimDetailsDialog.acceptedPendingBoardTitle') }}
        .q-mt-sm
          | {{ $t('marketplace.returnClaimDetailsDialog.pendingBoardText1') }}
          | {{ $t('marketplace.returnClaimDetailsDialog.pendingBoardText2') }}
          | {{ $t('marketplace.returnClaimDetailsDialog.pendingBoardText3') }}
          | {{ $t('marketplace.returnClaimDetailsDialog.pendingBoardText4') }}

      BaseCard.q-mb-md(v-if="claim.status === 'DECLINED_BY_COUNCIL'")
        .text-subtitle1 {{ $t('marketplace.returnClaimDetailsDialog.boardDeclinedTitle') }}
        .q-mt-sm
          | {{ $t('marketplace.returnClaimDetailsDialog.boardDeclinedText') }}

      BaseCard.bg-positive.text-white(v-if="claim.ledger_snapshot")
        .text-subtitle1 {{ $t('marketplace.returnClaimDetailsDialog.boardAcceptedTitle') }}
        .q-mt-sm
          | {{ $t('marketplace.returnClaimDetailsDialog.boardAcceptedRefundLabel') }}
          strong.q-ml-xs {{ formatAsset2Digits(claim.ledger_snapshot.amount) }} ₽
        .text-caption.q-mt-sm
          | {{ $t('marketplace.returnClaimDetailsDialog.boardDecisionTxText', { txHash: claim.ledger_snapshot.tx_hash }) }}
        .text-caption
          | {{ $t('marketplace.returnClaimDetailsDialog.refundAvailableHint') }}
</template>

<style scoped lang="scss">
.mp-return-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__thumb {
    display: inline-block;
    width: 96px;
    height: 96px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}
</style>
