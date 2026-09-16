<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { useRoute, useRouter } from 'vue-router';
import { BaseBadge, BaseButton, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import {
  getOpenWriteoffDraft,
  listWriteoffCandidates,
  listWriteoffProposals,
  type MarketplaceWriteoffCandidateView,
  type MarketplaceWriteoffProposalView,
} from '../api';
import { positionsLabel, proposalTitle } from '../lib/proposalDisplay';
import SubmitToCouncilDialog from './SubmitToCouncilDialog.vue';
import WriteoffProposalDetailsDialog from './WriteoffProposalDetailsDialog.vue';

/**
 * Эпик 8: admin-стол «Списания». Три вкладки: «Кандидаты» — имущество на
 * складах, председатель выделяет позиции, указывает причину списания (одна на
 * всю подборку — backend её не угадывает, см. историю 2026-07-29) и одной
 * кнопкой подписывает Заявление 1108 и выносит проект на повестку совета
 * (черновик собирается под капотом). «На повестке» — проекты в работе совета
 * (только наблюдение). «Архив» — исполненные и отклонённые.
 */

// Черновик — внутренний эфемерный артефакт: backend submitToCouncil требует
// существующий DRAFT (его proposal_hash подписывается). Собираем его перед
// подписью и сразу выносим в совет; как отдельный экран не показываем.
const draft = ref<MarketplaceWriteoffProposalView | null>(null);
const inCouncil = ref<MarketplaceWriteoffProposalView[]>([]);
const archive = ref<MarketplaceWriteoffProposalView[]>([]);
// true до первого запроса: иначе первый кадр до загрузки показывает пустое
// состояние вместо скелетона, и первая загрузка неотличима от пустого списка.
const loading = ref(true);

// Имущество на складах: председатель выделяет позиции, указывает причину и
// сразу отправляет в совет.
const candidates = ref<MarketplaceWriteoffCandidateView[]>([]);
const selectedCandidates = ref<MarketplaceWriteoffCandidateView[]>([]);

const activeKey = ref<'candidates' | 'council' | 'archive'>('candidates');
const tabs = computed<PageTab[]>(() => [
  { key: 'candidates', label: 'Кандидаты', count: candidates.value.length },
  { key: 'council', label: 'На повестке', count: inCouncil.value.length },
  { key: 'archive', label: 'Архив', count: archive.value.length },
]);
function onSelectTab(tab: PageTab): void {
  activeKey.value = tab.key as typeof activeKey.value;
}

// Лента проектов для вкладок «На повестке» / «Архив» — общая таблица.
const proposalsList = computed(() =>
  activeKey.value === 'archive' ? archive.value : inCouncil.value,
);

const candidateColumns: BaseTableColumn<MarketplaceWriteoffCandidateView>[] = [
  { key: 'asset_title', label: 'Наименование', width: '260px', sortable: true, field: 'asset_title' },
  { key: 'branch_name', label: 'Пункт выдачи', width: '220px', sortable: true, field: 'branch_name' },
  { key: 'quantity', label: 'Кол-во', width: '140px', numeric: true },
  { key: 'state', label: 'Состояние', width: '200px' },
  { key: 'expiry_date', label: 'Годен до', width: '130px', nowrap: true, sortable: true, field: 'expiry_date' },
  { key: 'amount', label: 'Сумма', width: '140px', numeric: true, sortable: true, field: (row) => Number.parseFloat(row.amount) || 0 },
];

const proposalColumns: BaseTableColumn<MarketplaceWriteoffProposalView>[] = [
  { key: 'title', label: 'Проект', width: '320px' },
  { key: 'total', label: 'Сумма', width: '150px', numeric: true },
  { key: 'status', label: 'Статус', width: '260px' },
  { key: 'date', label: 'Дата', width: '130px', nowrap: true },
];

const submitDialogOpen = ref(false);

/**
 * Открытый проект списания живёт в адресе (`?writeoff=<id>`): вид прежний —
 * тот же диалог поверх ленты, — но ссылка на конкретный проект пересылается,
 * F5 её восстанавливает, а «назад» закрывает диалог, а не уводит со страницы.
 * Сам проект берём из уже загруженных лент, отдельного запроса не нужно.
 */
const writeoffOverlay = useQueryOverlay('writeoff');
const selected = computed<MarketplaceWriteoffProposalView | null>(() => {
  const id = writeoffOverlay.value.value;
  if (!id) return null;
  return [...inCouncil.value, ...archive.value].find((p) => String(p.id) === id) ?? null;
});
const detailsOpen = computed({
  get: () => writeoffOverlay.isOpen.value && !!selected.value,
  set: (v: boolean) => {
    if (!v) writeoffOverlay.close();
  },
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [openDraft, councilPage, archivePage, candidatesList] = await Promise.all([
      getOpenWriteoffDraft(),
      listWriteoffProposals({ statuses: [
        Zeus.MarketplaceWriteoffProposalStatus.ON_AGENDA,
        Zeus.MarketplaceWriteoffProposalStatus.AUTHORIZED,
        Zeus.MarketplaceWriteoffProposalStatus.PENDING_CONFIRMATION,
        Zeus.MarketplaceWriteoffProposalStatus.EXECUTING,
      ] }),
      listWriteoffProposals({ statuses: [
        Zeus.MarketplaceWriteoffProposalStatus.EXECUTED,
        Zeus.MarketplaceWriteoffProposalStatus.REJECTED,
      ] }),
      listWriteoffCandidates(),
    ]);
    draft.value = openDraft;
    inCouncil.value = councilPage.items;
    archive.value = archivePage.items;
    candidates.value = candidatesList;
    // Позиции, уже попавшие в открытый черновик, из выбора убираем.
    if (selectedCandidates.value.length) {
      const present = new Set(candidatesList.map((c) => c.key));
      selectedCandidates.value = selectedCandidates.value.filter((c) => present.has(c.key));
    }
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить проекты списания');
  } finally {
    loading.value = false;
  }
}

function candidateQuantityLabel(c: MarketplaceWriteoffCandidateView): string {
  return marketplaceOrderSaleUnitLabel(Number.parseFloat(c.quantity) || 0, c.unit_of_measure, c.package_size);
}

function hasAmount(c: MarketplaceWriteoffCandidateView): boolean {
  return Number.parseFloat(c.amount) > 0;
}

/** Позиции без известной стоимости списывать нечем — их в проект не берём. */
const picked = computed(() => selectedCandidates.value.filter(hasAmount));

const pickedAmount = computed(() =>
  picked.value.reduce((sum, c) => sum + (Number.parseFloat(c.amount) || 0), 0),
);

// Выделил имущество → окно отправки: там причина списания (одна на подборку) и
// подпись Заявления. Черновик собирается внутри окна и наружу не показывается.
function openSubmit(): void {
  if (picked.value.length === 0) {
    FailAlert(
      new Error('Нет позиций с известной стоимостью'),
      'Выделите позиции с ненулевой суммой списания',
    );
    return;
  }
  submitDialogOpen.value = true;
}

function openDetails(proposal: MarketplaceWriteoffProposalView): void {
  writeoffOverlay.open(String(proposal.id));
}

const router = useRouter();
const route = useRoute();

function statusVariant(status: MarketplaceWriteoffProposalView['status']): BaseBadgeVariant {
  switch (status) {
    case 'DRAFT':
      return 'neutral';
    case 'ON_AGENDA':
      return 'accent';
    case 'AUTHORIZED':
    case 'PENDING_CONFIRMATION':
    case 'EXECUTING':
      return 'info';
    case 'EXECUTED':
      return 'pos';
    case 'REJECTED':
      return 'neg';
    default:
      return 'neutral';
  }
}

function humanStatus(status: MarketplaceWriteoffProposalView['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'Черновик';
    case 'ON_AGENDA':
      return 'На повестке';
    case 'AUTHORIZED':
      return 'Утверждено советом';
    case 'PENDING_CONFIRMATION':
      return 'Ожидает подтверждения склада';
    case 'EXECUTING':
      return 'Идёт списание';
    case 'EXECUTED':
      return 'Исполнено';
    case 'REJECTED':
      return 'Отклонено';
    default:
      return String(status);
  }
}

/**
 * Проект, утверждённый советом, ждёт последнего шага — подтверждения выбытия
 * на складе участка. Шаг лежит отдельным разделом стола склада, и найти его с
 * повестки было нечем: статус говорил «ожидает подтверждения склада», а куда
 * идти — нет (жалоба 2026-08-13). Отсюда прямая ссылка в этот раздел.
 */
function goToWarehouseWriteoffs(): void {
  void router.push({
    name: 'marketplace-pvz-warehouse',
    params: { coopname: route.params.coopname, section: 'writeoffs' },
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ru-RU');
}

// Дата проекта для ленты: итоговая (исполнение/отказ) либо подачи в совет.
function proposalDate(p: MarketplaceWriteoffProposalView): string | null | undefined {
  return p.executed_at ?? p.rejected_at ?? p.submitted_at ?? p.updated_at;
}


// Три состояния позиции на складе:
//  · нет даты годности (гарантия 0) → «Без гарантии» — ручное списание сразу;
//  · дата прошла → «Просрочен» — первоочередной авто-кандидат;
//  · дата в будущем → «Годен» — ещё в сроке гарантии.
function candidateStateLabel(c: MarketplaceWriteoffCandidateView): string {
  if (!c.expiry_date) return 'Без гарантии';
  return c.is_expired ? 'Просрочен' : 'Годен';
}
function candidateStateVariant(c: MarketplaceWriteoffCandidateView): BaseBadgeVariant {
  if (!c.expiry_date) return 'neutral';
  return c.is_expired ? 'neg' : 'pos';
}

function onDraftSubmitted(): void {
  draft.value = null;
  selectedCandidates.value = [];
  activeKey.value = 'council';
  void load();
}

// Realtime: дальнейшие статусы двигает совет — лента проектов обновляется
// сигналом канала совета, без ручного обновления.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  { MarketplaceWriteoffStatusChangedEvent: () => reloadLive() },
  { onResync: () => reloadLive() },
);

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.writeoffs(role="region", aria-label="Списания скоропорта")
  PageHint(storage-key="mp:admin-writeoffs:banner-dismissed")
    | Выделите имущество на складах к списанию, укажите причину и одной кнопкой подпишите Заявление — проект сразу выносится на повестку совета. Совет утверждает списание протоколом, после чего оператор участка подтверждает выбытие со склада.

  //- Главное действие страницы — в шапку (канон: CTA в топбаре). Только на
  //- вкладке «Кандидаты»: открыть окно отправки по текущему выбору.
  Teleport(to="#header-actions-host", defer)
    BaseButton(
      v-if="activeKey === 'candidates'",
      variant="primary",
      size="sm",
      :disabled="picked.length === 0",
      @click="openSubmit"
    )
      template(#icon-left)
        q-icon(name="send", size="18px")
      | Отправить{{ picked.length ? ` (${picked.length})` : '' }}

  PageTabs(:tabs="tabs", :active-key="activeKey", @select="onSelectTab")

  //- Вкладка «Кандидаты»: имущество на складах. Причину списания спрашивает
  //- окно отправки — на странице ей делать нечего, она нужна раз на подборку.
  template(v-if="activeKey === 'candidates'")
    BaseTable(
      v-if="loading || candidates.length",
      :columns="candidateColumns",
      :rows="candidates",
      row-key="key",
      hover,
      sticky-header,
      selection="multiple",
      v-model:selected="selectedCandidates",
      :loading="loading",
      min-width="1040px",
      sort-by="expiry_date"
    )
      template(#cell-asset_title="{ row }")
        .writeoffs__title {{ row.asset_title }}
        .t-muted.t-sm(v-if="row.lots_count > 1") {{ row.lots_count }} партии на складе
      template(#cell-quantity="{ row }")
        | {{ candidateQuantityLabel(row) }}
      template(#cell-state="{ row }")
        .writeoffs__state
          BaseBadge(:variant="candidateStateVariant(row)") {{ candidateStateLabel(row) }}
          BaseBadge(v-if="row.origin === 'WARRANTY_RETURN'", variant="warn") Гарантийный возврат
      template(#cell-expiry_date="{ row }")
        | {{ row.expiry_date ? formatDate(row.expiry_date) : '—' }}
      template(#cell-amount="{ row }")
        | {{ formatAsset2Digits(row.amount) }}
      template(#footer)
        .writeoffs__foot
          span Позиций на складах: {{ candidates.length }}
          span(v-if="picked.length")
            | Выбрано {{ picked.length }} на сумму {{ formatAsset2Digits(String(pickedAmount)) }}

    EmptyState(
      v-else,
      title="Списывать нечего",
      body="На складах участков нет имущества, которое можно вынести на списание."
    )
      template(#icon)
        q-icon(name="inventory_2", size="48px")

  //- Вкладки «На повестке» / «Архив»: общая лента проектов списания.
  template(v-else)
    BaseTable(
      v-if="loading || proposalsList.length",
      :columns="proposalColumns",
      :rows="proposalsList",
      row-key="id",
      hover,
      :loading="loading",
      min-width="860px",
      clickable-rows,
      @row-click="openDetails"
    )
      template(#cell-title="{ row }")
        .writeoffs__title {{ proposalTitle(row) }}
        .t-muted.t-sm {{ positionsLabel(row.items.length) }}
        .t-muted.t-sm(v-if="row.reject_reason") Причина отказа: {{ row.reject_reason }}
      template(#cell-total="{ row }")
        | {{ formatAsset2Digits(row.total_amount) }}
      template(#cell-status="{ row }")
        .writeoffs__state
          BaseBadge(:variant="statusVariant(row.status)") {{ humanStatus(row.status) }}
          BaseButton(
            v-if="row.status === 'PENDING_CONFIRMATION'",
            variant="ghost",
            size="sm",
            @click.stop="goToWarehouseWriteoffs"
          )
            template(#icon-left)
              q-icon(name="inventory_2", size="16px")
            | Подтвердить на складе
      template(#cell-date="{ row }")
        | {{ formatDate(proposalDate(row)) }}

    EmptyState(
      v-else,
      :title="activeKey === 'council' ? 'Нет проектов на повестке' : 'Архив пуст'",
      :body="activeKey === 'council' ? 'Выделите имущество на вкладке «Кандидаты» и отправьте проект в совет.' : 'Здесь появятся исполненные и отклонённые проекты списания.'"
    )
      template(#icon)
        q-icon(name="inventory_2", size="48px")

  SubmitToCouncilDialog(
    v-model="submitDialogOpen",
    :items="picked",
    :open-draft="draft",
    @submitted="onDraftSubmitted"
  )
  WriteoffProposalDetailsDialog(
    v-if="selected",
    v-model="detailsOpen",
    :proposal="selected"
  )
</template>

<style lang="scss" scoped>
.writeoffs {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__row {
    cursor: pointer;
  }

  &__title {
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  //- Состояние и пометки идут столбиком: в строку они не помещаются и
  //- расталкивают колонку.
  &__state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--p-1, 4px);
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    width: 100%;
  }
}

@media (max-width: 768px) {
  .writeoffs {
    padding: var(--p-4, 16px);
  }
}
</style>
