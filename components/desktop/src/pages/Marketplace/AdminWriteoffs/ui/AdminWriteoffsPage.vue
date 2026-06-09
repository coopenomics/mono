<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, CardListSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  getOpenWriteoffDraft,
  listWriteoffProposals,
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

const draftEditorOpen = ref(false);
const submitDialogOpen = ref(false);
const detailsOpen = ref(false);
const selected = ref<MarketplaceWriteoffProposalView | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [openDraft, councilPage, archivePage] = await Promise.all([
      getOpenWriteoffDraft(),
      listWriteoffProposals({ statuses: [
        Zeus.MarketplaceWriteoffProposalStatus.ON_AGENDA,
        Zeus.MarketplaceWriteoffProposalStatus.AUTHORIZED,
        Zeus.MarketplaceWriteoffProposalStatus.EXECUTING,
      ] }),
      listWriteoffProposals({ statuses: [
        Zeus.MarketplaceWriteoffProposalStatus.EXECUTED,
        Zeus.MarketplaceWriteoffProposalStatus.REJECTED,
      ] }),
    ]);
    draft.value = openDraft;
    inCouncil.value = councilPage.items;
    archive.value = archivePage.items;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить проекты списания');
  } finally {
    loading.value = false;
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
      return 'Утверждено';
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
  Teleport(to="#header-actions-host", defer)
    BaseButton(v-if="!draft", variant="primary", size="sm", @click="draftEditorOpen = true")
      template(#icon-left)
        q-icon(name="add", size="18px")
      | Новый черновик

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
