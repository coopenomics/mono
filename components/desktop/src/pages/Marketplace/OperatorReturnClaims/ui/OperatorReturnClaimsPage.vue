<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { BaseBadge, BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { ScannerDialog } from 'src/widgets/Marketplace/ScannerDialog';
import { useMarketplaceRealtime, decodeReturnClaimCode } from 'src/shared/lib/marketplace';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { returnClaimStatusLabel, returnClaimStatusVariant } from '../../OrdererReturnClaims';
import { listReturnClaimsByBraname, type MarketplaceReturnClaimView } from '../api';
import OnSiteDecisionDialog from './OnSiteDecisionDialog.vue';

/**
 * Story 7.2-7.4 — operator-стол председателя КУ: лента заявлений на
 * гарантийный возврат, привязанных к delivery_braname исходного заказа.
 *
 * Единая лента с табами по статусу (канон — «Мои заказы»/MyOrdersPage), не
 * три вертикальные секции подряд (см. review 2026-07-29). Карточка одна и та
 * же для любого статуса — клик по ней открывает детальную страницу заявления
 * (`marketplace-pvz-return-detail`), где виден текущий статус и контекстное
 * действие (принять решение / очный осмотр). Раньше решения принимались
 * инлайн в карточке списка, а архивная карточка была усечённой и никуда не
 * вела — вводило разнобой ровно там, где должна быть одна и та же модель.
 *
 * Исключение — «быстрый путь» сканирования QR: пайщик, пришедший на очный
 * осмотр, показывает QR своей заявки, председатель сканирует и сразу попадает
 * в решение по ней (минуя список и детальную страницу) — это осознанный
 * ярлык для живой очереди на стойке ПВЗ, а не альтернативный путь навигации.
 */

const route = useRoute();
const router = useRouter();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const items = ref<MarketplaceReturnClaimView[]>([]);
const loading = ref(true);

const onSiteDialog = ref(false);
const scanDialogOpen = ref(false);
const selectedClaim = ref<MarketplaceReturnClaimView | null>(null);

const activeKey = ref<'all' | 'pending' | 'approved' | 'archive'>('all');

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

const tabs = computed<PageTab[]>(() => [
  { key: 'all', label: 'Все', count: items.value.length },
  { key: 'pending', label: 'Ждут рассмотрения', count: pendingClaims.value.length },
  { key: 'approved', label: 'Ожидают визита', count: approvedClaims.value.length },
  { key: 'archive', label: 'Архив', count: archiveClaims.value.length },
]);

const visibleClaims = computed(() => {
  switch (activeKey.value) {
    case 'pending':
      return pendingClaims.value;
    case 'approved':
      return approvedClaims.value;
    case 'archive':
      return archiveClaims.value;
    default:
      return items.value;
  }
});

function onSelectTab(tab: PageTab): void {
  activeKey.value = tab.key as typeof activeKey.value;
}

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

function openDetail(claim: MarketplaceReturnClaimView): void {
  void router.push({
    name: 'marketplace-pvz-return-detail',
    params: { coopname: coopname.value, claimId: claim.id },
  });
}

/**
 * Пайщик, пришедший на очный осмотр, показывает QR своей заявки — председатель
 * сканирует и сразу попадает в решение по НЕЙ, не листая список руками.
 */
function onQrScanned(code: string): void {
  scanDialogOpen.value = false;
  const claimId = decodeReturnClaimCode(code, coopname.value);
  if (!claimId) {
    FailAlert(new Error('Нераспознанный код. Отсканируйте QR-код возврата, который показывает пайщик.'));
    return;
  }
  const claim = items.value.find((c) => c.id === claimId);
  if (!claim) {
    FailAlert(new Error('Заявление с этим кодом не найдено на вашем участке.'));
    return;
  }
  if (claim.status !== Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT) {
    FailAlert(new Error('По этой заявке пока не одобрен очный осмотр.'));
    return;
  }
  selectedClaim.value = claim;
  onSiteDialog.value = true;
}

function claimQuantityLabel(c: MarketplaceReturnClaimView): string {
  const saleUnit = marketplaceOrderSaleUnit(c.actual_quantity, c.unit_of_measure, c.package_size);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
}

function onDecided(): void {
  void load();
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
    v-if='store.loaded && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Рассмотрение гарантийных возвратов доступно председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    //- Действие страницы — в шапку (канон Teleport): пайщик показывает QR
    //- своей заявки, председатель сканирует и сразу попадает в решение по ней.
    Teleport(to="#header-actions-host", defer)
      BaseButton(variant='primary', size='sm', @click='scanDialogOpen = true')
        template(#icon-left)
          q-icon(name='qr_code_scanner', size='16px')
        | Сканировать код

    PageHint(storage-key='mp:operator-returns:banner-dismissed')
      | Рассматривайте заявления пайщиков: удалённое решение по заявке, затем очный осмотр и приём возврата на пункте выдачи. Пайщик, пришедший на осмотр, показывает QR из своей заявки — отсканируйте его кнопкой «Сканировать код» сверху. Откройте карточку заявления, чтобы увидеть подробности и принять решение.

    PageTabs(:tabs='tabs', :active-key='activeKey', @select='onSelectTab')

    //- Канон загрузки: скелетон вместо мелькающих заглушек «пусто» на первичной загрузке.
    CardListSkeleton(v-if='loading && !items.length', :count='2')

    EmptyState(
      v-else-if='!visibleClaims.length',
      :title='activeKey === "archive" ? "Архив пуст" : "Заявлений нет"'
    )
      template(#icon)
        q-icon(name='inbox', size='40px')

    .returns__list(v-else)
      .return-row(v-for='c in visibleClaims', :key='c.id', @click='openDetail(c)')
        .return-row__main
          .return-row__title Заказ {{ c.order_id.slice(0, 8) }} · заказчик {{ c.orderer_name || c.orderer_account }}
          .return-row__sub
            span.return-row__num №&nbsp;{{ c.id.slice(0, 8) }}
            span(aria-hidden='true') ·
            span {{ c.reason_text }}
        BaseBadge.return-row__status(:variant='returnClaimStatusVariant(c.status)') {{ returnClaimStatusLabel(c.status) }}
        .return-row__fact
          .return-row__fact-label Кол-во
          .return-row__fact-value {{ claimQuantityLabel(c) }}
        .return-row__fact
          .return-row__fact-label Сумма
          .return-row__fact-value.return-row__fact-value--money {{ formatAsset2Digits(c.fact_cost) }} ₽
        q-icon.return-row__chevron(name='chevron_right', size='20px')

  OnSiteDecisionDialog(
    v-model='onSiteDialog',
    :claim='selectedClaim',
    :braname='braname',
    @decided='onDecided'
  )
  ScannerDialog(
    v-model='scanDialogOpen',
    title='Сканирование кода возврата',
    idle-caption='Наведите камеру на QR-код, который показывает пайщик',
    @scanned='onQrScanned'
  )
</template>

<style scoped lang="scss">
.returns {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }
}

// Универсальная строка списка — одна и та же для любого статуса заявления
// (на рассмотрении / ожидает визита / архив), тот же приём, что и у
// OrderCard(layout="row") в «Моих заказах»: вся сводка в один ряд, клик
// открывает детальную страницу. Раньше архивная карточка была урезанной
// (без тела и без клика) — теперь везде одна и та же модель.
.return-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3, 12px) var(--p-6, 24px);
  padding: var(--p-4, 16px) var(--p-5, 20px);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  background: var(--p-surface);
  cursor: pointer;
  transition: border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);

  &:hover {
    border-color: var(--p-ink-3);
  }

  &__main {
    flex: 1 1 260px;
    min-width: 0;
  }

  &__title {
    min-width: 0;
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__sub {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--p-1, 4px) var(--p-2, 8px);
    margin-top: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  &__num {
    font-family: var(--p-mono);
  }

  &__status {
    flex-shrink: 0;
    white-space: nowrap;
  }

  &__fact {
    flex: 0 0 auto;
    min-width: 88px;
  }

  &__fact-label {
    font-size: var(--p-fs-eyebrow, 11px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
    margin-bottom: 2px;
  }

  &__fact-value {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    white-space: nowrap;

    &--money {
      font-weight: 700;
      font-feature-settings: 'tnum' 1;
    }
  }

  &__chevron {
    flex-shrink: 0;
    color: var(--p-ink-3);
    margin-left: auto;
  }
}

@media (max-width: 768px) {
  .returns {
    padding: var(--p-4, 16px);
  }
}
</style>
