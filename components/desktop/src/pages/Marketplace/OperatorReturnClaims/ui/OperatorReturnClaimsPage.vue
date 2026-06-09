<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { debounce } from 'quasar';
import { useRoute } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import {
  listReturnClaimsByBraname,
  defectCategoryLabel,
  type MarketplaceReturnClaimView,
} from '../api';
import RemoteDecisionDialog from './RemoteDecisionDialog.vue';
import OnSiteDecisionDialog from './OnSiteDecisionDialog.vue';

/**
 * Story 7.2-7.4 — operator-стол председателя КУ: лента заявлений на
 * гарантийный возврат, привязанных к delivery_braname исходного заказа.
 *
 * - PENDING_CHAIRMAN_REVIEW → RemoteDecisionDialog (одобрить очный визит /
 *   отказать удалённо).
 * - APPROVED_FOR_VISIT      → OnSiteDecisionDialog (CodeScanner +
 *   inspection_result + accept / reject; accept атомарно выполняет
 *   compensating forward `o.mkt.return + o.mkt.return2`).
 */

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const items = ref<MarketplaceReturnClaimView[]>([]);
const loading = ref(false);

const remoteDialog = ref(false);
const onSiteDialog = ref(false);
const selectedClaim = ref<MarketplaceReturnClaimView | null>(null);

const pendingClaims = computed(() =>
  items.value.filter((c) => c.status === Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW),
);
const approvedClaims = computed(() =>
  items.value.filter((c) => c.status === Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT),
);
const archiveClaims = computed(() =>
  items.value.filter(
    (c) =>
      c.status === Zeus.MarketplaceReturnClaimStatus.ACCEPTED_AT_VISIT ||
      c.status === Zeus.MarketplaceReturnClaimStatus.REJECTED_REMOTELY ||
      c.status === Zeus.MarketplaceReturnClaimStatus.REJECTED_AT_VISIT,
  ),
);

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    items.value = await listReturnClaimsByBraname({ delivery_braname: braname.value.trim() });
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить заявления на возврат');
  } finally {
    loading.value = false;
  }
}

function startRemote(claim: MarketplaceReturnClaimView): void {
  selectedClaim.value = claim;
  remoteDialog.value = true;
}

function startOnSite(claim: MarketplaceReturnClaimView): void {
  selectedClaim.value = claim;
  onSiteDialog.value = true;
}

function onDecided(): void {
  void load();
}

/**
 * Безопасное форматирование даты, приходящей из Zeus как `unknown`
 * (GraphQL DateTime скаляр не зарегистрирован в Zeus-резолвере). Принимаем
 * `unknown`, конвертируем в строку через `String()` и парсим — формат
 * сервера ISO 8601, поэтому `new Date(<iso>)` валиден.
 */
function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU');
}

function humanStatus(status: MarketplaceReturnClaimView['status']): string {
  switch (status) {
    case Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW:
      return 'Ждёт удалённого рассмотрения';
    case Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT:
      return 'Очный визит одобрен';
    case Zeus.MarketplaceReturnClaimStatus.ACCEPTED_AT_VISIT:
      return 'Возврат принят';
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_REMOTELY:
      return 'Отказано удалённо';
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_AT_VISIT:
      return 'Отказано на месте';
    default:
      return status;
  }
}

watch(braname, () => void load());

// Realtime: пайщик подаёт заявление / второй председатель решает с другого
// устройства — лента возвратов КУ обновляется сразу, человек у стойки не ждёт.
// Сигналы приходят в служебный канал персонала КУ; чужие участки фильтруем.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  {
    MarketplaceReturnClaimStatusChangedEvent: (event) => {
      if (event.braname === braname.value.trim()) reloadLive();
    },
  },
  { onResync: () => reloadLive() },
);

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  void load();
});
</script>

<template lang="pug">
q-page.returns(role='region', aria-label='Гарантийные возвраты')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Рассмотрение гарантийных возвратов доступно председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-returns:banner-dismissed')
      | Рассматривайте заявления пайщиков: удалённое решение по заявке, затем очный осмотр и приём возврата на пункте выдачи.

    //- Канон загрузки: скелетон вместо мелькающих заглушек «пусто» на первичной загрузке.
    CardListSkeleton(
      v-if='loading && !pendingClaims.length && !approvedClaims.length && !archiveClaims.length',
      :count='2'
    )

    section.returns__section
      .t-h3 Ждут удалённого рассмотрения ({{ pendingClaims.length }})
      q-list.returns__list(v-if='pendingClaims.length > 0', bordered, separator)
        q-item(v-for='c in pendingClaims', :key='c.id')
          q-item-section
            q-item-label.text-weight-medium Заказ {{ c.order_id.slice(0, 8) }} · заказчик {{ c.orderer_account }}
            q-item-label(caption) {{ c.actual_quantity }} ед. · {{ c.fact_cost }} ₽
            q-item-label(caption) {{ c.reason_text.slice(0, 240) }}{{ c.reason_text.length > 240 ? '…' : '' }}
            q-item-label(caption, v-if='c.defect_category')
              | Категория: {{ defectCategoryLabel(c.defect_category) }}
            .returns__thumbs
              a.returns__thumb(
                v-for='(p, i) in c.photos',
                :key='p.content_hash',
                :href='p.url',
                target='_blank',
                rel='noopener'
              )
                img(:src='p.url', :alt='`Фото ${i + 1}`')
          q-item-section(side)
            BaseButton(variant='primary', size='sm', @click='startRemote(c)')
              template(#icon-left)
                q-icon(name='gavel', size='16px')
              | Принять решение
      .returns__empty(v-if='pendingClaims.length === 0 && !loading') Нет заявлений, ожидающих удалённого рассмотрения.

    section.returns__section
      .t-h3 Ожидают очного визита ({{ approvedClaims.length }})
      q-list.returns__list(v-if='approvedClaims.length > 0', bordered, separator)
        q-item(v-for='c in approvedClaims', :key='c.id')
          q-item-section
            q-item-label.text-weight-medium Заказ {{ c.order_id.slice(0, 8) }} · заказчик {{ c.orderer_account }}
            q-item-label(caption) Возврат на сумму {{ c.fact_cost }} ₽
            q-item-label(caption) Дата одобрения: {{ c.decision_log.length > 0 ? formatDateTime(c.decision_log[c.decision_log.length - 1].at) : '—' }}
          q-item-section(side)
            BaseButton(variant='secondary', size='sm', @click='startOnSite(c)')
              template(#icon-left)
                q-icon(name='fact_check', size='16px')
              | Очный осмотр
      .returns__empty(v-if='approvedClaims.length === 0 && !loading') Нет заявлений, по которым ожидается очный визит.

    section.returns__section
      .t-h3 Архив ({{ archiveClaims.length }})
      q-list.returns__list(v-if='archiveClaims.length > 0', bordered, separator)
        q-item(v-for='c in archiveClaims', :key='c.id')
          q-item-section
            q-item-label Заказ {{ c.order_id.slice(0, 8) }} · {{ c.orderer_account }}
            q-item-label(caption) {{ humanStatus(c.status) }}{{ c.ledger_snapshot ? ` · ${c.ledger_snapshot.amount} ₽ восстановлено` : '' }}
      .returns__empty(v-if='archiveClaims.length === 0 && !loading') Архив пуст.

  RemoteDecisionDialog(
    v-model='remoteDialog',
    :claim='selectedClaim',
    :braname='braname',
    @decided='onDecided'
  )
  OnSiteDecisionDialog(
    v-model='onSiteDialog',
    :claim='selectedClaim',
    :braname='braname',
    @decided='onDecided'
  )
</template>

<style scoped lang="scss">
.returns {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__empty {
    color: var(--p-ink-3);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
  }

  &__thumbs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
    margin-top: var(--p-2, 8px);
  }

  &__thumb {
    display: inline-block;
    width: 56px;
    height: 56px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-xs, 6px);
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}

@media (max-width: 768px) {
  .returns {
    padding: var(--p-4, 16px);
  }
}
</style>
