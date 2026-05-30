<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  listAplReceptionsAsSupplier,
  type MarketplaceAplReceptionView,
} from '../api';
import SignAplReceptionDialog from './SignAplReceptionDialog.vue';

/**
 * Эпик 5 / Story 5.7: offerer-стол «Подпись приёмки».
 *
 * Поставщик первой подписью (on-chain `signsupp`) подтверждает факт приёмки
 * партии, после чего акт уходит на закрывающую подпись председателя КУ.
 * Вёрстка по канону MONO Platform v2: инфо-баннер, canon-таблица со
 * статус-бейджами, скелетон вместо спиннера, EmptyState.
 */

const items = ref<MarketplaceAplReceptionView[]>([]);
const loading = ref(false);
const signDialog = ref(false);
const selected = ref<MarketplaceAplReceptionView | null>(null);

// Статус акта приёмки → метка + canon-вариант бейджа.
const RECEPTION_STATUS: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  PENDING_SUPPLIER_SIGN: { label: 'Ждёт вашей подписи', variant: 'warn' },
  PENDING_CHAIRMAN_RECEPTION_SIGN: { label: 'Ждёт подписи председателя КУ', variant: 'info' },
  ACCEPTED_TO_COOP: { label: 'Принят кооперативом', variant: 'pos' },
  CANCELLED: { label: 'Отменён', variant: 'neutral' },
};

function statusOf(v?: string | null): { label: string; variant: BaseBadgeVariant } {
  if (!v) return { label: '—', variant: 'neutral' };
  return RECEPTION_STATUS[v] ?? { label: v, variant: 'neutral' };
}

const RECEPTION_VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};

function variantLabel(v: string): string {
  return RECEPTION_VARIANT_LABEL[v] ?? v;
}

// Колонки скелетона повторяют шапку реальной таблицы — каркас не дёргается.
const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'АПП', class: 'col-id', cell: 'badge' },
  { label: 'КУ', cell: 'text' },
  { label: 'Вариант', cell: 'text', cellWidth: '120px' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Сумма', class: 'col-num', cell: 'text', cellWidth: '80px' },
  { label: 'Действия', class: 'col-action', cell: 'icon' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listAplReceptionsAsSupplier();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить акты на подпись');
  } finally {
    loading.value = false;
  }
}

function sign(item: MarketplaceAplReceptionView): void {
  selected.value = item;
  signDialog.value = true;
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.offerer-apl
  PageHint(storage-key='mp:offerer-apl:banner-dismissed')
    | Акты приёмки партий, по которым ждут вашу подпись. Подписывая акт, вы
    | подтверждаете факт приёмки — затем он уходит на закрывающую подпись
    | председателя КУ.

  .offerer-apl__toolbar
    BaseButton(
      variant='ghost',
      icon-only,
      aria-label='Обновить',
      :loading='loading',
      @click='load'
    )
      template(#icon-left)
        q-icon(name='refresh', size='20px')

  TableSkeleton(
    v-if='loading && !items.length',
    :columns='skeletonColumns',
    :rows='6',
    min-width='860px'
  )
  .table-wrap(v-else-if='items.length')
    .table-scroll
      table.table
        thead
          tr
            th.col-id АПП
            th КУ
            th.col-variant Вариант
            th.col-status Статус
            th.col-num Сумма
            th.col-action Действия
        tbody
          tr(v-for='row in items', :key='row.id')
            td.col-id {{ row.id.slice(0, 8) }}
            td {{ row.braname }}
            td.col-variant {{ variantLabel(row.variant) }}
            td.col-status
              BaseBadge(:variant='statusOf(row.status).variant') {{ statusOf(row.status).label }}
            td.col-num {{ row.total_amount }} ₽
            td.col-action
              BaseButton(
                v-if='row.status === "PENDING_SUPPLIER_SIGN"',
                variant='primary',
                size='sm',
                @click='sign(row)'
              )
                template(#icon-left)
                  q-icon(name='draw', size='16px')
                | Подписать
              span.offerer-apl__dash(v-else) —

  EmptyState(
    v-else,
    title='Актов на подпись нет',
    body='Когда партия будет принята на ПВЗ — акт приёмки появится здесь для вашей подписи.'
  )
    template(#icon)
      q-icon(name='task_alt', size='48px')

  SignAplReceptionDialog(
    v-model='signDialog',
    :reception='selected',
    @signed='load'
  )
</template>

<style scoped lang="scss">
.offerer-apl {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    justify-content: flex-end;
  }

  &__dash {
    color: var(--p-ink-3);
  }
}

.table-scroll {
  overflow-x: auto;
}
.table {
  table-layout: fixed;
  min-width: 860px;
}
.col-id {
  width: 120px;
  font-family: var(--font-mono);
}
.col-variant {
  width: 150px;
}
.col-status {
  width: 220px;
}
.col-num {
  width: 120px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.col-action {
  width: 150px;
  text-align: right;
}

@media (max-width: 768px) {
  .offerer-apl {
    padding: var(--p-4, 16px);
  }
}
</style>
