<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseInput, CardListSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  cancelWriteoffDraft,
  createWriteoffDraft,
  getOpenWriteoffDraft,
  listWriteoffCandidates,
  listWriteoffProposals,
  type MarketplaceWriteoffCandidateView,
  type MarketplaceWriteoffProposalView,
} from '../api';
import SubmitToCouncilDialog from './SubmitToCouncilDialog.vue';
import WriteoffProposalDetailsDialog from './WriteoffProposalDetailsDialog.vue';

/**
 * Эпик 8: admin-стол «Списания». Председатель выделяет имущество на складах,
 * при желании пишет причину и одной кнопкой подписывает Заявление 1106 и
 * выносит проект на повестку совета — без промежуточного черновика как
 * отдельного экрана (черновик собирается под капотом перед подписью).
 *
 * Ниже — лента проектов в работе совета (ON_AGENDA / AUTHORIZED /
 * PENDING_CONFIRMATION / EXECUTING; только наблюдение) и архив
 * (EXECUTED / REJECTED).
 */

// Черновик — внутренний эфемерный артефакт: backend submitToCouncil требует
// существующий DRAFT (его proposal_hash подписывается). Собираем его перед
// подписью и сразу выносим в совет; как отдельный экран не показываем.
const draft = ref<MarketplaceWriteoffProposalView | null>(null);
const inCouncil = ref<MarketplaceWriteoffProposalView[]>([]);
const archive = ref<MarketplaceWriteoffProposalView[]>([]);
const loading = ref(false);

// Имущество на складах: председатель выделяет позиции, пишет причину и сразу
// отправляет в совет.
const candidates = ref<MarketplaceWriteoffCandidateView[]>([]);
const selectedCandidates = ref<MarketplaceWriteoffCandidateView[]>([]);
const writeoffReason = ref('');
const preparing = ref(false);

const candidateColumns = [
  { name: 'branch_name', align: 'left' as const, label: 'Кооп. участок', field: 'branch_name' },
  { name: 'asset_title', align: 'left' as const, label: 'Наименование', field: 'asset_title' },
  { name: 'quantity', align: 'right' as const, label: 'Кол-во', field: 'quantity' },
  { name: 'state', align: 'left' as const, label: 'Состояние', field: 'is_expired' },
  { name: 'expiry_date', align: 'left' as const, label: 'Годен до', field: 'expiry_date' },
  { name: 'amount', align: 'right' as const, label: 'Сумма', field: 'amount' },
];

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

// Один шаг: выделил имущество + (необязательно) причину → собираем черновик
// под капотом и сразу открываем подпись Заявления для отправки в совет.
async function signAndSend(): Promise<void> {
  const picked = selectedCandidates.value.filter(hasAmount);
  if (picked.length === 0) {
    FailAlert(
      new Error('Нет позиций с известной стоимостью'),
      'Выделите позиции с ненулевой суммой списания',
    );
    return;
  }
  preparing.value = true;
  try {
    // Снимаем возможный висящий черновик (от прерванной подписи или крон-сервиса),
    // чтобы собрать свежий ровно из текущего выбора — один черновик за раз.
    if (draft.value) {
      await cancelWriteoffDraft(draft.value.id);
      draft.value = null;
    }
    const reason = writeoffReason.value.trim();
    const created = await createWriteoffDraft({
      items: picked.map((c) => ({
        braname: c.braname,
        asset_title: c.asset_title,
        quantity: c.quantity,
        amount: c.amount,
        // Пусто — причина по состоянию позиции (просрочено / ручное списание).
        reason: reason || c.reason,
        inventory_id: c.inventory_id,
      })),
    });
    draft.value = created;
    submitDialogOpen.value = true;
  } catch (e) {
    FailAlert(e, 'Не удалось подготовить проект к отправке в совет');
  } finally {
    preparing.value = false;
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

const totalActiveAmount = computed(() =>
  inCouncil.value
    .reduce((acc, p) => acc + (Number.parseFloat(p.total_amount) || 0), 0)
    .toFixed(2),
);

function onDraftSubmitted(): void {
  draft.value = null;
  selectedCandidates.value = [];
  writeoffReason.value = '';
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
    | Выделите имущество на складах к списанию, при необходимости укажите причину и одной кнопкой подпишите Заявление — проект сразу выносится на повестку совета. Совет утверждает списание протоколом, после чего председатель кооперативного участка подтверждает выбытие со склада.

  //- Главное действие страницы — в шапку (канон: CTA в топбаре, dense/primary).
  //- Один шаг: собрать проект из выбора и сразу открыть подпись + отправку в совет.
  Teleport(to="#header-actions-host", defer)
    BaseButton(
      variant="primary",
      size="sm",
      :disabled="selectedCandidates.length === 0",
      :loading="preparing",
      @click="signAndSend"
    )
      template(#icon-left)
        q-icon(name="draw", size="18px")
      | Подписать и отправить в совет{{ selectedCandidates.length ? ` (${selectedCandidates.length})` : '' }}

  //- Имущество на складах: выделяемая таблица + причина списания в этой же карточке.
  BaseCard
    .writeoffs__candidates-head
      .t-h3 Имущество на складах
      .t-muted «Просрочен» — первоочередные кандидаты; «Без гарантии» — можно списать вручную сразу (порча, использование); «Годен» — ещё в сроке гарантии, возврат возможен. Выделите позиции, при необходимости укажите причину и подпишите в шапке.
    BaseInput.q-mt-sm(
      v-model="writeoffReason",
      label="Причина списания (необязательно)",
      placeholder="Например: порча, использование. Пусто — причина по состоянию позиции",
      :disabled="selectedCandidates.length === 0"
    )
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
          BaseBadge(:variant="candidateStateVariant(props.row)") {{ candidateStateLabel(props.row) }}
      template(#body-cell-expiry_date="props")
        q-td(:props="props") {{ props.row.expiry_date ? formatDate(props.row.expiry_date) : 'Без гарантии' }}
      template(#body-cell-amount="props")
        q-td.text-right(:props="props") {{ formatAsset2Digits(props.row.amount) }}

  BaseCard
    .writeoffs__council
      div
        .t-h3 В работе совета
        .t-muted {{ inCouncil.length }} проект(ов) на сумму {{ formatAsset2Digits(totalActiveAmount) }} ₽

  //- Канон загрузки: скелетон вместо спиннера и вместо мелькающих заглушек «пусто».
  CardListSkeleton(v-if="loading && !inCouncil.length && !archive.length", :count="3")

  .writeoffs__empty(v-if="inCouncil.length === 0 && !loading")
    | Нет проектов на повестке. Выделите имущество в таблице выше и отправьте проект в совет.
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
