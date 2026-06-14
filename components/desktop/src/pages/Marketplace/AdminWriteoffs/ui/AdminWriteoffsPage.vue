<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, CardListSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  createWriteoffDraft,
  getOpenWriteoffDraft,
  listWriteoffCandidates,
  listWriteoffProposals,
  type MarketplaceWriteoffCandidateView,
  type MarketplaceWriteoffProposalView,
} from '../api';
import DraftEditorDialog from './DraftEditorDialog.vue';
import SubmitToCouncilDialog from './SubmitToCouncilDialog.vue';
import WriteoffProposalDetailsDialog from './WriteoffProposalDetailsDialog.vue';

/**
 * Эпик 8: admin-стол «Списания на повестке». Лента проектов решения совета
 * о списании скоропорта.
 *
 * Раздел 1 — открытый черновик (DRAFT). Кран сервиса или ручное действие
 * предлагают председателю / общему администратору набор позиций к
 * списанию. Здесь же можно отредактировать состав и подписать Заявление
 * 1106 для отправки в совет.
 *
 * Раздел 2 — активные проекты на повестке совета (ON_AGENDA /
 * AUTHORIZED / EXECUTING). Здесь только наблюдение — действующие
 * процедуры голосования и подписания Протокола 1107 идут через
 * стандартный sov.decision-flow повестки совета.
 *
 * Раздел 3 — архив (EXECUTED / REJECTED).
 */

const draft = ref<MarketplaceWriteoffProposalView | null>(null);
const inCouncil = ref<MarketplaceWriteoffProposalView[]>([]);
const archive = ref<MarketplaceWriteoffProposalView[]>([]);
const loading = ref(false);

// Кандидаты на списание — просроченный скоропорт на складах. Председатель
// выделяет позиции и одной кнопкой собирает из них черновик проекта.
const candidates = ref<MarketplaceWriteoffCandidateView[]>([]);
const selectedCandidates = ref<MarketplaceWriteoffCandidateView[]>([]);
const creatingDraft = ref(false);

const candidateColumns = [
  { name: 'branch_name', align: 'left' as const, label: 'Кооп. участок', field: 'branch_name' },
  { name: 'asset_title', align: 'left' as const, label: 'Наименование', field: 'asset_title' },
  { name: 'quantity', align: 'right' as const, label: 'Кол-во', field: 'quantity' },
  { name: 'state', align: 'left' as const, label: 'Состояние', field: 'is_expired' },
  { name: 'expiry_date', align: 'left' as const, label: 'Срок годности', field: 'expiry_date' },
  { name: 'amount', align: 'right' as const, label: 'Сумма', field: 'amount' },
];

const draftEditorOpen = ref(false);
const submitDialogOpen = ref(false);
const detailsOpen = ref(false);
const selected = ref<MarketplaceWriteoffProposalView | null>(null);

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
      const present = new Set(candidatesList.map((c) => c.inventory_id));
      selectedCandidates.value = selectedCandidates.value.filter((c) => present.has(c.inventory_id));
    }
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить проекты списания');
  } finally {
    loading.value = false;
  }
}

function hasAmount(c: MarketplaceWriteoffCandidateView): boolean {
  return Number.parseFloat(c.amount) > 0;
}

async function createDraftFromSelection(): Promise<void> {
  const picked = selectedCandidates.value.filter(hasAmount);
  if (picked.length === 0) {
    FailAlert(
      new Error('Нет позиций с известной стоимостью'),
      'Выделите позиции с ненулевой суммой списания',
    );
    return;
  }
  creatingDraft.value = true;
  try {
    const created = await createWriteoffDraft({
      items: picked.map((c) => ({
        braname: c.braname,
        asset_title: c.asset_title,
        quantity: c.quantity,
        amount: c.amount,
        reason: c.reason,
        inventory_id: c.inventory_id,
      })),
    });
    draft.value = created;
    selectedCandidates.value = [];
    SuccessAlert('Черновик списания собран из выбранных позиций');
    void load();
  } catch (e) {
    FailAlert(e, 'Не удалось создать черновик списания');
  } finally {
    creatingDraft.value = false;
  }
}

function openDetails(proposal: MarketplaceWriteoffProposalView): void {
  selected.value = proposal;
  detailsOpen.value = true;
}

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

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ru-RU');
}

const totalActiveAmount = computed(() =>
  inCouncil.value
    .reduce((acc, p) => acc + (Number.parseFloat(p.total_amount) || 0), 0)
    .toFixed(2),
);

function onDraftCreatedOrUpdated(updated: MarketplaceWriteoffProposalView): void {
  draft.value = updated;
}

function onDraftSubmitted(): void {
  draft.value = null;
  void load();
}

// Realtime: DRAFT строит cron, дальнейшие статусы двигает совет — лента
// проектов обновляется сигналом канала совета, без ручного обновления.
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
    | Сначала собирается черновик списания — вручную председателем или автоматически по сроку годности. Затем председатель подписывает заявление и выносит проект на повестку совета. Совет утверждает списание протоколом, после чего имущество списывается со склада.

  //- Главное действие страницы — в шапку (канон: CTA в топбаре, dense/primary).
  //- Активна только когда выделены позиции-кандидаты; собирает из них черновик.
  Teleport(to="#header-actions-host", defer)
    BaseButton(
      v-if="!draft",
      variant="primary",
      size="sm",
      :disabled="selectedCandidates.length === 0",
      :loading="creatingDraft",
      @click="createDraftFromSelection"
    )
      template(#icon-left)
        q-icon(name="add", size="18px")
      | Новый черновик{{ selectedCandidates.length ? ` (${selectedCandidates.length})` : '' }}

  //- Кандидаты на списание: выделяемая таблица имущества на складах.
  //- Один черновик за раз — пока есть открытый черновик, таблицу прячем.
  BaseCard(v-if="!draft")
    .writeoffs__candidates-head
      .t-h3 Кандидаты на списание
      .t-muted Имущество на складах кооператива. Просроченный скоропорт — первоочередные кандидаты (подсвечены); ещё годное можно списать вручную при порче или невозврате. Выделите позиции и нажмите «Новый черновик» в шапке.
    q-table.full-width.q-mt-sm(
      flat,
      :rows="candidates",
      :columns="candidateColumns",
      row-key="inventory_id",
      selection="multiple",
      v-model:selected="selectedCandidates",
      :loading="loading",
      :rows-per-page-options="[0]",
      hide-bottom,
      no-data-label="Позиций на складах не найдено"
    )
      template(#body-cell-quantity="props")
        q-td.text-right(:props="props") {{ props.row.quantity }}
      template(#body-cell-state="props")
        q-td(:props="props")
          BaseBadge(:variant="props.row.is_expired ? 'neg' : 'neutral'") {{ props.row.is_expired ? 'Просрочено' : 'Годно' }}
      template(#body-cell-expiry_date="props")
        q-td(:props="props") {{ props.row.expiry_date ? formatDate(props.row.expiry_date) : 'Без срока' }}
      template(#body-cell-amount="props")
        q-td.text-right(:props="props") {{ formatAsset2Digits(props.row.amount) }}

  BaseCard(v-if="draft")
    .writeoffs__draft
      .writeoffs__draft-info
        .t-h3 Открытый черновик
        .t-muted {{ draft.items.length }} позиций · {{ formatAsset2Digits(draft.total_amount) }}
        .t-muted Источник: {{ draft.trigger === Zeus.MarketplaceWriteoffProposalTrigger.CRON ? 'крон-сервис' : 'ручное создание' }} · {{ formatDate(draft.created_at) }}
      .writeoffs__draft-actions
        BaseButton(variant="secondary", @click="draftEditorOpen = true")
          template(#icon-left)
            q-icon(name="edit", size="16px")
          | Изменить состав
        BaseButton(variant="primary", @click="submitDialogOpen = true")
          template(#icon-left)
            q-icon(name="send", size="16px")
          | Подписать и отправить в совет

  BaseCard
    .writeoffs__council
      div
        .t-h3 В работе совета
        .t-muted {{ inCouncil.length }} проект(ов) на сумму {{ formatAsset2Digits(totalActiveAmount) }} ₽

  //- Канон загрузки: скелетон вместо спиннера и вместо мелькающих заглушек «пусто».
  CardListSkeleton(v-if="loading && !inCouncil.length && !archive.length", :count="3")

  .writeoffs__empty(v-if="inCouncil.length === 0 && !loading")
    | Нет проектов на повестке. Откройте новый черновик или дождитесь, пока крон-сервис подберёт скоропорт.
  q-list(v-if="inCouncil.length > 0", bordered, separator)
    q-item(v-for="p in inCouncil", :key="p.id", clickable, @click="openDetails(p)")
      q-item-section
        q-item-label.text-weight-medium {{ p.items.length }} позиций · {{ formatAsset2Digits(p.total_amount) }}
        q-item-label(caption) Подал {{ p.proposed_by_account ?? '—' }} · {{ formatDate(p.submitted_at) }}
      q-item-section(side)
        BaseBadge(:variant="statusVariant(p.status)") {{ humanStatus(p.status) }}

  .t-h3 Архив
  .writeoffs__empty(v-if="archive.length === 0 && !loading") Архив пуст.
  q-list(v-if="archive.length > 0", bordered, separator)
    q-item(v-for="p in archive", :key="p.id", clickable, @click="openDetails(p)")
      q-item-section
        q-item-label.text-weight-medium {{ p.items.length }} позиций · {{ formatAsset2Digits(p.total_amount) }}
        q-item-label(caption) {{ humanStatus(p.status) }} · {{ formatDate(p.executed_at ?? p.rejected_at ?? p.updated_at) }}
        q-item-label(caption, v-if="p.reject_reason") Причина отказа: {{ p.reject_reason }}
      q-item-section(side)
        BaseBadge(:variant="statusVariant(p.status)") {{ humanStatus(p.status) }}

  DraftEditorDialog(
    v-model="draftEditorOpen",
    :existing-draft="draft",
    @saved="onDraftCreatedOrUpdated"
  )
  SubmitToCouncilDialog(
    v-if="draft",
    v-model="submitDialogOpen",
    :draft="draft",
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

  &__toolbar {
    display: flex;
    align-items: center;
  }

  &__draft {
    display: flex;
    justify-content: space-between;
    gap: var(--p-4, 16px);
    flex-wrap: wrap;
  }

  &__draft-info {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__draft-actions {
    display: flex;
    gap: var(--p-2, 8px);
    align-items: flex-start;
    flex-wrap: wrap;
  }

  &__council {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
  }

  &__empty {
    color: var(--p-ink-2);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
    font-size: var(--p-fs-body-sm);
  }
}

@media (max-width: 768px) {
  .writeoffs {
    padding: var(--p-4, 16px);
  }
}
</style>
