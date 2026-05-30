<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Loading } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { BaseBadge, BaseButton, BaseInput, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  createAplReception,
  listAplReceptionsByBraname,
  type MarketplaceAplReceptionView,
} from '../api';
import SignAplReceptionChairmanDialog from './SignAplReceptionChairmanDialog.vue';

/**
 * Story 5.3 + 5.4: operator-стол приёмки партий.
 *
 * Каркасная версия (598-18). Полный flow Варианта А (BarcodeScanner →
 * CorrectionTable → подпись на стойке) и Варианта Б (приём по ТТН с
 * расхождением) включается следующим UI PR.
 */

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const items = ref<MarketplaceAplReceptionView[]>([]);
const loading = ref(false);

const shipmentIdInput = ref('');

const RECEPTION_STATUS_LABEL: Record<string, string> = {
  PENDING_SUPPLIER_SIGN: 'Ждёт подписи поставщика',
  PENDING_CHAIRMAN_RECEPTION_SIGN: 'Ждёт подписи председателя',
  ACCEPTED_TO_COOP: 'Принят кооперативом',
  CANCELLED: 'Отменён',
};

const RECEPTION_STATUS_VARIANT: Record<string, BaseBadgeVariant> = {
  PENDING_SUPPLIER_SIGN: 'neutral',
  PENDING_CHAIRMAN_RECEPTION_SIGN: 'warn',
  ACCEPTED_TO_COOP: 'pos',
  CANCELLED: 'neg',
};

const RECEPTION_VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};

// Ждущие подписи приёмки — наверх: председатель приходит на стол, чтобы
// подписать акты, а не листать уже принятые партии.
const STATUS_SORT_PRIORITY: Record<string, number> = {
  PENDING_CHAIRMAN_RECEPTION_SIGN: 0,
  PENDING_SUPPLIER_SIGN: 1,
  ACCEPTED_TO_COOP: 2,
  CANCELLED: 3,
};

function statusLabel(v: string): string {
  return RECEPTION_STATUS_LABEL[v] ?? v;
}

function statusVariant(v: string): BaseBadgeVariant {
  return RECEPTION_STATUS_VARIANT[v] ?? 'neutral';
}

const columns: QTableProps['columns'] = [
  { name: 'id', label: 'АПП', field: (r: MarketplaceAplReceptionView) => r.id.slice(0, 8), align: 'left' },
  { name: 'variant', label: 'Вариант', field: 'variant', align: 'center', format: (v: string) => RECEPTION_VARIANT_LABEL[v] ?? v },
  { name: 'status', label: 'Статус', field: 'status', align: 'left' },
  { name: 'total_amount', label: 'Сумма', field: 'total_amount', align: 'right' },
  { name: 'actions', label: '', field: 'id', align: 'right' },
];

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    const list = await listAplReceptionsByBraname(braname.value.trim());
    items.value = [...list].sort(
      (a, b) =>
        (STATUS_SORT_PRIORITY[a.status] ?? 99) - (STATUS_SORT_PRIORITY[b.status] ?? 99),
    );
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить акты приёмки');
  } finally {
    loading.value = false;
  }
}

async function createReceptionForShipment(): Promise<void> {
  if (!shipmentIdInput.value.trim()) {
    FailAlert(new Error('Укажите идентификатор партии.'));
    return;
  }
  Loading.show({ message: 'Создаю акт приёмки…' });
  try {
    await createAplReception({ shipment_id: shipmentIdInput.value.trim() });
    SuccessAlert('Акт приёмки создан');
    shipmentIdInput.value = '';
    await load();
  } catch (e) {
    FailAlert(e, 'Не удалось создать акт приёмки');
  } finally {
    Loading.hide();
  }
}

const signDialogOpen = ref(false);
const signTarget = ref<MarketplaceAplReceptionView | null>(null);

function signChairman(item: MarketplaceAplReceptionView): void {
  signTarget.value = item;
  signDialogOpen.value = true;
}

async function onChairmanSigned(): Promise<void> {
  await load();
}

watch(braname, () => void load());

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  void load();
});
</script>

<template lang="pug">
q-page.reception(role='region', aria-label='Приёмка партии')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Приёмка партий доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-reception:banner-dismissed')
      | Подтверждайте партии, прибывшие на ваш пункт выдачи: создайте акт приёмки и подпишите его председателем участка.

    .reception__create
      BaseInput.reception__create-input(
        v-model='shipmentIdInput',
        label='Идентификатор партии',
        placeholder='shipment_id',
        mono
      )
      BaseButton(variant='primary', @click='createReceptionForShipment')
        template(#icon-left)
          q-icon(name='add', size='16px')
        | Создать акт приёмки

    q-table.reception__table(
      :rows='items',
      :columns='columns',
      row-key='id',
      flat,
      bordered,
      :loading='loading'
    )
      template(#body-cell-status='props')
        q-td(:props='props')
          BaseBadge(:variant='statusVariant(props.row.status)') {{ statusLabel(props.row.status) }}

      template(#body-cell-actions='props')
        q-td(:props='props')
          BaseButton(
            v-if='props.row.status === "PENDING_CHAIRMAN_RECEPTION_SIGN"',
            variant='primary',
            size='sm',
            @click='signChairman(props.row)'
          )
            template(#icon-left)
              q-icon(name='draw', size='16px')
            | Подписать председателем

      template(#no-data)
        EmptyState(
          title='Актов приёмки нет',
          body='Создайте акт по идентификатору прибывшей партии — он появится здесь для подписания.'
        )
          template(#icon)
            q-icon(name='assignment_turned_in', size='48px')

  SignAplReceptionChairmanDialog(
    v-model='signDialogOpen',
    :reception='signTarget',
    @signed='onChairmanSigned'
  )
</template>

<style scoped lang="scss">
.reception {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__create {
    display: flex;
    align-items: flex-end;
    gap: var(--p-3, 12px);
  }

  &__create-input {
    max-width: 320px;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .reception {
    padding: var(--p-4, 16px);

    &__create {
      flex-direction: column;
      align-items: stretch;
    }
  }
}
</style>
