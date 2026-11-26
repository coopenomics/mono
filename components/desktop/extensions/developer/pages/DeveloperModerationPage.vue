<template lang="pug">
q-page(padding)
  .q-pa-md
    BaseBanner.q-mb-md(variant='info')
      | {{ $t('developer.moderation.intro') }}

    BaseBanner.q-mb-md(v-if='error', variant='neg')
      | {{ error }}

    EmptyState(
      v-else-if='!firstLoad && !items.length',
      :title="$t('developer.moderation.emptyTitle')",
      :body="$t('developer.moderation.emptyBody')"
    )
      template(#icon)
        q-icon(name='fact_check', size='28px')

    //- Зоны строки: опознание (пакет, версия, кто и когда подал) → пояснение
    //- издателя → деньги (цена издателя) → состояние → действия.
    BaseTable(
      v-else,
      :columns='columns',
      :rows='items',
      row-key='id',
      :loading='firstLoad',
      :skeleton-rows='3',
      min-width='920px'
    )
      template(#cell-package='{ row }')
        .t-mono {{ row.packageId }}@{{ row.version }}
        .t-sm.t-muted {{ row.submittedBy }} · {{ formatDate(row.submittedAt) }}
      template(#cell-brief='{ row }')
        .moderation__brief {{ row.brief }}
      template(#cell-price='{ row }')
        template(v-if='row.rubPerMonth == null')
          BaseBadge(variant='warn') {{ $t('developer.moderation.priceNotSet') }}
          .t-sm.t-muted.q-mt-xs {{ $t('developer.moderation.priceRequired') }}
        template(v-else)
          .moderation__amount {{ row.rubPerMonth === 0 ? $t('developer.pricing.free') : $t('developer.perMonth', { amount: formatPrice(row.rubPerMonth) }) }}
          .t-sm.t-muted {{ row.trialDays > 0 ? $t('developer.pricing.trialDays', { days: row.trialDays }) : $t('developer.pricing.noTrial') }}
      template(#cell-status='{ row }')
        BaseBadge(:variant="statusMap[row.status]?.variant ?? 'neutral'")
          | {{ statusMap[row.status]?.label ?? row.status }}
        BaseBadge.q-ml-xs(v-if='row.requiresOverride', variant='neg')
          | {{ $t('developer.moderation.vulnerability') }}
      template(#cell-actions='{ row }')
        .moderation__actions
          BaseButton(
            variant='primary',
            size='sm',
            :disabled='!isSubmitted(row) || row.rubPerMonth == null',
            @click='openApprove(row)'
          ) {{ $t('developer.moderation.approve') }}
          BaseButton(
            variant='danger',
            size='sm',
            :disabled='!isSubmitted(row)',
            @click='openReject(row)'
          ) {{ $t('developer.moderation.reject') }}

  BaseDialog(v-model='approveDialog', :title="$t('developer.moderation.approveTitle')", size='sm')
    p.t-sm.t-muted.q-mb-sm
      | {{ $t('developer.moderation.releaseLabel') }}
      |
      span.t-mono {{ selected?.packageId }}@{{ selected?.version }}
      |
      | {{ $t('developer.moderation.approveForAll') }}
    BaseCheckbox(
      v-if='selected?.requiresOverride',
      v-model='approveOverride',
      :label="$t('developer.moderation.overrideLabel')"
    )
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg')
      | {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='actionLoading', @click='approveDialog = false')
        | {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='actionLoading', @click='confirmApprove')
        | {{ $t('developer.moderation.approve') }}

  BaseDialog(v-model='rejectDialog', :title="$t('developer.moderation.rejectTitle')", size='sm')
    p.t-sm.t-muted.q-mb-sm
      | {{ $t('developer.moderation.rejectText') }}
      |
      span.t-mono {{ selected?.packageId }}
      | .
    BaseInput(
      v-model='rejectReason',
      :label="$t('developer.moderation.rejectReason')",
      :error='rejectReasonError',
      required
    )
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg')
      | {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='actionLoading', @click='rejectDialog = false')
        | {{ $t('common.action.cancel') }}
      BaseButton(variant='danger', :loading='actionLoading', @click='confirmReject')
        | {{ $t('developer.moderation.reject') }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseCheckbox,
  BaseDialog,
  BaseInput,
  BaseTable,
  EmptyState,
} from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable/BaseTable.types';
import { useFirstLoad } from 'src/shared/lib/composables';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { api as extensionApi } from 'src/entities/Extension/api';
import { Zeus, type Queries } from '@coopenomics/sdk';
import { t } from '../i18n';

type ModerationRow = Queries.Extensions.AppsCatalogPendingModerations.IOutput[
  typeof Queries.Extensions.AppsCatalogPendingModerations.name
][number];

const items = ref<ModerationRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const firstLoad = useFirstLoad(loading);

const columns: BaseTableColumn<ModerationRow>[] = [
  { key: 'package', label: t('developer.column.package'), width: '220px' },
  { key: 'brief', label: t('developer.column.description') },
  { key: 'price', label: t('developer.column.price'), width: '170px' },
  { key: 'status', label: t('developer.column.status'), width: '170px', nowrap: true },
  { key: 'actions', label: t('developer.column.actions'), width: '210px', align: 'right', nowrap: true },
];

/** Заявка ждёт решения модератора: только такую одобряют и отклоняют. */
function isSubmitted(row: ModerationRow): boolean {
  return row.status === Zeus.ModerationStatusEnum.SUBMITTED;
}

function formatPrice(rub: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(rub);
}

const statusMap: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  SUBMITTED: { label: t('developer.moderation.status.submitted'), variant: 'warn' },
  APPROVED: { label: t('developer.moderation.status.approved'), variant: 'pos' },
  APPROVED_PENDING_CHAIN: { label: t('developer.moderation.status.approvedPendingChain'), variant: 'info' },
  REJECTED: { label: t('developer.moderation.status.rejected'), variant: 'neg' },
  WITHDRAWN: { label: t('developer.moderation.status.withdrawn'), variant: 'neutral' },
};

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    items.value = await extensionApi.loadPendingModerations();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const selected = ref<ModerationRow | null>(null);
const approveDialog = ref(false);
const rejectDialog = ref(false);
const approveOverride = ref(false);
const rejectReason = ref('');
const rejectReasonError = ref('');
const actionLoading = ref(false);
const actionError = ref<string | null>(null);

function openApprove(m: ModerationRow) {
  selected.value = m;
  approveOverride.value = false;
  actionError.value = null;
  approveDialog.value = true;
}

function openReject(m: ModerationRow) {
  selected.value = m;
  rejectReason.value = '';
  rejectReasonError.value = '';
  actionError.value = null;
  rejectDialog.value = true;
}

async function confirmApprove() {
  if (!selected.value) return;
  actionLoading.value = true;
  actionError.value = null;
  try {
    const result = await extensionApi.approveModeration({
      moderationId: selected.value.id,
      scope: { type: Zeus.ReleaseScopeType.ALL },
      ...(approveOverride.value ? { override: true } : {}),
    });
    if (
      result.status === Zeus.ApproveModerationStatus.APPLIED ||
      result.status === Zeus.ApproveModerationStatus.PENDING_CHAIN
    ) {
      approveDialog.value = false;
      await load();
    } else if (result.status === Zeus.ApproveModerationStatus.REQUIRES_OVERRIDE) {
      actionError.value = t('developer.moderation.overrideRequired');
    } else {
      actionError.value = result.error || t('developer.moderation.approveFailed');
    }
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
  } finally {
    actionLoading.value = false;
  }
}

async function confirmReject() {
  if (!selected.value) return;
  rejectReasonError.value = '';
  const reason = rejectReason.value.trim();
  if (reason.length < 3) {
    rejectReasonError.value = t('developer.moderation.reasonTooShort');
    return;
  }
  actionLoading.value = true;
  actionError.value = null;
  try {
    const result = await extensionApi.rejectModeration({
      moderationId: selected.value.id,
      reason,
    });
    if (result.status === Zeus.RejectModerationStatus.APPLIED) {
      rejectDialog.value = false;
      await load();
    } else {
      actionError.value = result.error || t('developer.moderation.rejectFailed');
    }
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
  } finally {
    actionLoading.value = false;
  }
}

// realtime: нет источника — заявки живут во внешнем каталоге, лента цепи кооператива о них не сообщает.
onMounted(load);
</script>

<style scoped lang="scss">
.moderation__brief {
  max-width: 320px;
}

.moderation__amount {
  font-weight: 600;
}

.moderation__actions {
  display: flex;
  gap: var(--p-2);
  justify-content: flex-end;
}
</style>
