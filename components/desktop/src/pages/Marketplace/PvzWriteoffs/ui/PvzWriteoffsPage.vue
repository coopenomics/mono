<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { FailAlert } from 'src/shared/api';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { DocumentViewerDialog } from 'src/shared/ui/domain/DocumentViewerDialog';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import {
  getWriteoffProtocolDocument,
  listWriteoffPendingConfirmations,
  type MarketplaceWriteoffConfirmationGroupView,
} from '../api';
import ConfirmWriteoffDialog from './ConfirmWriteoffDialog.vue';

/**
 * Эпик 8: стол ПВЗ — подтверждение списания со склада. Совет одобрил проект
 * списания; председатель кооперативного участка видит здесь группы своих
 * участков и подтверждает фактическое выбытие имущества со склада, подписывая
 * Служебную записку о списании (registry 1111).
 */

const groups = ref<MarketplaceWriteoffConfirmationGroupView[]>([]);
const loading = ref(false);
const confirmOpen = ref(false);
const selectedGroup = ref<MarketplaceWriteoffConfirmationGroupView | null>(null);

// Протокол совета — отдельным полноэкранным окном (как остальные документы).
// Бэкенд отдаёт уже подписанный документ агрегатом (не регенерирует).
const protocolOpen = ref(false);
const protocolDoc = ref<IDocumentAggregate | null>(null);

const itemColumns = [
  { name: 'asset_title', align: 'left' as const, label: 'Наименование', field: 'asset_title' },
  { name: 'quantity', align: 'right' as const, label: 'Кол-во', field: 'quantity' },
  { name: 'amount', align: 'right' as const, label: 'Сумма', field: 'amount' },
  { name: 'reason', align: 'left' as const, label: 'Причина', field: 'reason' },
];

function groupKey(g: MarketplaceWriteoffConfirmationGroupView): string {
  return `${g.proposal_id}:${g.braname}`;
}

// Позиция-агрегат несёт список партий; стабильный ключ строки — наименование+состояние.
function itemRowKey(it: { asset_title: string; reason: string }): string {
  return `${it.asset_title}|${it.reason}`;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    groups.value = await listWriteoffPendingConfirmations();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить списания на подтверждение');
  } finally {
    loading.value = false;
  }
}

function openConfirm(g: MarketplaceWriteoffConfirmationGroupView): void {
  selectedGroup.value = g;
  confirmOpen.value = true;
}

async function openProtocol(g: MarketplaceWriteoffConfirmationGroupView): Promise<void> {
  try {
    // Грузим агрегат до открытия — диалог показывает готовый документ без мигания.
    protocolDoc.value = (await getWriteoffProtocolDocument({
      proposal_id: g.proposal_id,
    })) as unknown as IDocumentAggregate;
    protocolOpen.value = true;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить Протокол совета');
  }
}

function onConfirmed(): void {
  void load();
}

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
q-page.pvz-writeoffs(role="region", aria-label="Списание со склада")
  PageHint(storage-key="mp:pvz-writeoffs:banner-dismissed")
    | Совет одобрил списание имущества со складов. Подтвердите фактическое списание со склада своего участка — для этого подпишите Служебную записку о списании. Только после вашей подписи имущество выбывает со склада.

  CardListSkeleton(v-if="loading && !groups.length", :count="2")

  .pvz-writeoffs__empty(v-if="!loading && groups.length === 0")
    EmptyState(
      title="Нет списаний на подтверждение",
      body="Когда совет одобрит проект списания по вашему участку, он появится здесь."
    )
      template(#icon)
        q-icon(name="inventory_2", size="48px")

  BaseCard(v-for="g in groups", :key="groupKey(g)")
    .pvz-writeoffs__card
      .pvz-writeoffs__head
        div
          .t-h3 {{ g.branch_name }}
          .t-muted {{ g.items.length }} позиций · {{ formatAsset2Digits(g.total_amount) }}
        BaseBadge(variant="info") Ожидает подтверждения

      q-table.full-width.q-mt-sm(
        flat,
        :rows="g.items",
        :columns="itemColumns",
        :row-key="itemRowKey",
        hide-bottom,
        :rows-per-page-options="[0]"
      )
        template(#body-cell-quantity="props")
          q-td.text-right(:props="props") {{ props.row.quantity }}
        template(#body-cell-amount="props")
          q-td.text-right(:props="props") {{ formatAsset2Digits(props.row.amount) }}

      .pvz-writeoffs__actions
        BaseButton(variant="ghost", size="sm", @click="openProtocol(g)")
          template(#icon-left)
            q-icon(name="gavel", size="16px")
          | Протокол совета
        q-space
        BaseButton(variant="primary", @click="openConfirm(g)")
          template(#icon-left)
            q-icon(name="task_alt", size="16px")
          | Подтвердить списание

  ConfirmWriteoffDialog(
    v-model="confirmOpen",
    :group="selectedGroup",
    @confirmed="onConfirmed"
  )

  //- Протокол совета — канон-просмотрщик документа (полный экран, как везде).
  DocumentViewerDialog(
    v-model="protocolOpen",
    :document-aggregate="protocolDoc",
    title="Протокол совета о списании"
  )
</template>

<style lang="scss" scoped>
.pvz-writeoffs {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__card {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    margin-top: var(--p-2, 8px);
  }

  &__empty {
    display: flex;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .pvz-writeoffs {
    padding: var(--p-4, 16px);
  }
}
</style>
