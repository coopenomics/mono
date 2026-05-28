<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
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
 * процедуры голосования и подписания Протокола 1105 идут через
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

function statusColor(status: MarketplaceWriteoffProposalView['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'grey';
    case 'ON_AGENDA':
      return 'primary';
    case 'AUTHORIZED':
    case 'EXECUTING':
      return 'info';
    case 'EXECUTED':
      return 'positive';
    case 'REJECTED':
      return 'negative';
    default:
      return 'grey';
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

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.mp-role-admin.mp-writeoffs.q-pa-md
  .row.items-center.q-mb-sm
    .text-h6 Списания скоропорта
    q-space
    q-btn(
      v-if="!draft"
      unelevated no-caps color="primary"
      icon="fa-solid fa-plus"
      label="Новый черновик"
      @click="draftEditorOpen = true"
    )

  .text-body2.text-grey.q-mb-md
    | Сначала собирается черновик списания — вручную председателем или автоматически по сроку годности. Затем председатель подписывает заявление и выносит проект на повестку совета. Совет рассматривает проект и утверждает списание протоколом, после чего имущество списывается со склада.

  q-card.q-mb-md(v-if="draft" flat bordered)
    q-card-section
      .row.items-center
        .col
          .text-subtitle1 Открытый черновик
          .text-caption.text-grey {{ draft.items.length }} позиций · {{ formatAsset2Digits(draft.total_amount) }}
          .text-caption.text-grey Источник: {{ draft.trigger === Zeus.MarketplaceWriteoffProposalTrigger.CRON ? 'крон-сервис' : 'ручное создание' }} · {{ formatDate(draft.created_at) }}
        q-btn(
          flat color="primary" no-caps
          icon="fa-solid fa-pen"
          label="Изменить состав"
          @click="draftEditorOpen = true"
        )
        q-btn.q-ml-sm(
          unelevated color="primary" no-caps
          icon="fa-solid fa-paper-plane"
          label="Подписать и отправить в совет"
          @click="submitDialogOpen = true"
        )

  q-card.q-mb-md(flat bordered)
    q-card-section.row.items-center
      q-spinner-tabs(v-if="loading" indeterminate)
      .col
        .text-subtitle1 В работе совета
        .text-caption.text-grey {{ inCouncil.length }} проект(ов) на сумму {{ formatAsset2Digits(totalActiveAmount) }} ₽

  q-card(v-if="inCouncil.length === 0" flat bordered).q-pa-md.q-mb-md
    .text-grey Нет проектов на повестке. Откройте новый черновик или дождитесь, пока крон-сервис подберёт скоропорт.

  q-list(v-else bordered separator).q-mb-md
    q-item(
      v-for="p in inCouncil" :key="p.id" clickable @click="openDetails(p)"
    )
      q-item-section
        q-item-label.text-weight-medium {{ p.items.length }} позиций · {{ formatAsset2Digits(p.total_amount) }}
        q-item-label(caption) Подал {{ p.proposed_by_account ?? '—' }} · {{ formatDate(p.submitted_at) }}
      q-item-section(side)
        q-chip(:color="statusColor(p.status)" text-color="white" dense) {{ humanStatus(p.status) }}

  .text-subtitle1.q-mb-sm Архив
  q-card(v-if="archive.length === 0" flat bordered).q-pa-md
    .text-grey Архив пуст.
  q-list(v-else bordered separator)
    q-item(
      v-for="p in archive" :key="p.id" clickable @click="openDetails(p)"
    )
      q-item-section
        q-item-label.text-weight-medium {{ p.items.length }} позиций · {{ formatAsset2Digits(p.total_amount) }}
        q-item-label(caption) {{ humanStatus(p.status) }} · {{ formatDate(p.executed_at ?? p.rejected_at ?? p.updated_at) }}
        q-item-label(caption v-if="p.reject_reason") Причина отказа: {{ p.reject_reason }}
      q-item-section(side)
        q-chip(:color="statusColor(p.status)" text-color="white" dense) {{ humanStatus(p.status) }}

  DraftEditorDialog(
    v-model="draftEditorOpen"
    :existing-draft="draft"
    @saved="onDraftCreatedOrUpdated"
  )
  SubmitToCouncilDialog(
    v-if="draft"
    v-model="submitDialogOpen"
    :draft="draft"
    @submitted="onDraftSubmitted"
  )
  WriteoffProposalDetailsDialog(
    v-if="selected"
    v-model="detailsOpen"
    :proposal="selected"
  )
</template>

<style lang="scss" scoped>
.mp-writeoffs {
  font-size: var(--mp-font-body, 16px);
}
</style>
