<script lang="ts" setup>
import type { QTableProps } from 'quasar';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Loading } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { BaseBadge, BaseButton, BaseDialog, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { QrScanner } from 'src/widgets/Marketplace/QrScanner';
import {
  listShipmentsByBraname,
  type MarketplaceShipmentView,
} from '../../OperatorIncomingShipments/api';
import {
  createAplReception,
  createExpressReception,
  listAplReceptionsByBraname,
  listExpressPickupsByBraname,
  type MarketplaceAplReceptionView,
  type MarketplaceExpressPickupCandidateView,
} from '../api';
import SignAplReceptionChairmanDialog from './SignAplReceptionChairmanDialog.vue';

/**
 * Story 5.3 + 5.4 + Эпик 14: operator-стол приёмки партий.
 *
 * Оператор не вводит идентификатор партии руками — он либо выбирает
 * ожидающую приёмки партию из списка (партии `SUPPLY_PREPARED`, прибывшие
 * на его КУ), либо сканирует QR поставщика (Story 14.3). Оба пути зовут
 * `createAplReception({ shipment_id })`.
 *
 * Story 14.2: отдельный раздел «Самовывоз по факту» — поставщики с принятыми
 * заказами, которые не формировали партию заранее. Оператор принимает по факту
 * присутствия: `createExpressReception({ offerer_account, braname })` синтезирует
 * партию самовывоза и открывает по ней приёмку.
 */

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const items = ref<MarketplaceAplReceptionView[]>([]);
const expectedShipments = ref<MarketplaceShipmentView[]>([]);
// Story 14.2: поставщики с принятыми заказами, ожидающими самовывоза на КУ
// (партию заранее не формировали) — приёмка по факту присутствия.
const expressCandidates = ref<MarketplaceExpressPickupCandidateView[]>([]);
const loading = ref(false);

// Партии, прибывшие на КУ и ожидающие создания акта приёмки: статус
// SUPPLY_PREPARED (после создания акта партия уходит в RECEPTION_IN_PROGRESS).
const pendingShipments = computed(() =>
  expectedShipments.value.filter(
    (s) => s.status === Zeus.MarketplaceShipmentStatus.SUPPLY_PREPARED,
  ),
);

const SHIPMENT_VARIANT_LABEL: Record<string, string> = {
  SELF: 'Поставщик лично',
  EXPEDITOR: 'Экспедитор по ТТН',
  A: 'Поставщик лично',
  B: 'Экспедитор по ТТН',
};

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
    const [receptions, shipments, express] = await Promise.all([
      listAplReceptionsByBraname(braname.value.trim()),
      listShipmentsByBraname({ braname: braname.value.trim() }),
      listExpressPickupsByBraname(braname.value.trim()),
    ]);
    items.value = [...receptions].sort(
      (a, b) =>
        (STATUS_SORT_PRIORITY[a.status] ?? 99) - (STATUS_SORT_PRIORITY[b.status] ?? 99),
    );
    expectedShipments.value = shipments;
    expressCandidates.value = express;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить акты приёмки');
  } finally {
    loading.value = false;
  }
}

// Story 14.2: принять самовывоз по факту присутствия — backend синтезирует
// партию самовывоза из принятых заказов поставщика на этом КУ и открывает приёмку.
async function acceptExpressPickup(
  candidate: MarketplaceExpressPickupCandidateView,
): Promise<void> {
  Loading.show({ message: 'Открываю приёмку самовывоза…' });
  try {
    const result = await createExpressReception({
      offerer_account: candidate.offerer_account,
      braname: candidate.braname,
    });
    const count = result.apl_receptions.length;
    SuccessAlert(
      count > 1 ? `Открыто актов приёмки: ${count}` : 'Акт приёмки самовывоза создан',
    );
    await load();
  } catch (e) {
    FailAlert(e, 'Не удалось открыть приёмку самовывоза');
  } finally {
    Loading.hide();
  }
}

async function createReceptionForShipment(shipmentId: string): Promise<void> {
  const id = shipmentId.trim();
  if (!id) {
    FailAlert(new Error('Не указана партия для приёмки.'));
    return;
  }
  Loading.show({ message: 'Создаю акт приёмки…' });
  try {
    await createAplReception({ shipment_id: id });
    SuccessAlert('Акт приёмки создан');
    await load();
  } catch (e) {
    FailAlert(e, 'Не удалось создать акт приёмки');
  } finally {
    Loading.hide();
  }
}

// QR-код передачи: поставщик показывает QR партии, оператор сканирует —
// акт приёмки открывается по считанному shipment_id без ручного ввода.
const scanDialogOpen = ref(false);

async function onQrScanned(code: string): Promise<void> {
  scanDialogOpen.value = false;
  await createReceptionForShipment(code);
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
      | Партии, прибывшие на ваш пункт выдачи, ждут приёмки ниже. Выберите партию
      | (или отсканируйте QR поставщика), создайте акт приёмки и подпишите его
      | председателем участка.

    //- Ожидающие приёмки партии: выбор из списка вместо ручного ввода id.
    //- QR-сканер — для тех, кто принимает с телефона (Story 14.3).
    .reception__pending
      .reception__pending-head
        .reception__pending-title Ожидают приёмки
        BaseButton(variant='secondary', size='sm', @click='scanDialogOpen = true')
          template(#icon-left)
            q-icon(name='qr_code_scanner', size='16px')
          | Сканировать QR

      .reception__empty(v-if='!pendingShipments.length') Нет партий, ожидающих приёмки на этом КУ.

      .reception__ship(v-for='s in pendingShipments', :key='s.id')
        .reception__ship-info
          .reception__ship-offerer {{ s.offerer_account }}
          .reception__ship-meta
            | {{ SHIPMENT_VARIANT_LABEL[s.delivery_variant] ?? s.delivery_variant }} · {{ s.total_amount }} ₽
            template(v-if='s.ttn_number')  · ТТН {{ s.ttn_number }}
        BaseButton(variant='primary', size='sm', @click='createReceptionForShipment(s.id)')
          template(#icon-left)
            q-icon(name='add', size='16px')
          | Создать акт приёмки

    //- Story 14.2: самовывоз по факту — поставщик приехал без заранее
    //- сформированной партии; оператор открывает приёмку по факту присутствия.
    .reception__pending(v-if='expressCandidates.length')
      .reception__pending-head
        .reception__pending-title Самовывоз по факту (без партии)

      .reception__ship(v-for='c in expressCandidates', :key='c.offerer_account')
        .reception__ship-info
          .reception__ship-offerer {{ c.offerer_account }}
          .reception__ship-meta
            | Самовывоз · {{ c.orders_count }} заказ(ов) · {{ c.total_units }} ед. · {{ c.total_amount }} ₽
        BaseButton(variant='secondary', size='sm', @click='acceptExpressPickup(c)')
          template(#icon-left)
            q-icon(name='how_to_reg', size='16px')
          | Принять самовывоз

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
          body='Выберите прибывшую партию выше и создайте акт — он появится здесь для подписания.'
        )
          template(#icon)
            q-icon(name='assignment_turned_in', size='48px')

  SignAplReceptionChairmanDialog(
    v-model='signDialogOpen',
    :reception='signTarget',
    @signed='onChairmanSigned'
  )

  BaseDialog(v-model='scanDialogOpen', title='Сканирование QR партии', size='sm')
    QrScanner(@scanned='onQrScanned')
</template>

<style scoped lang="scss">
.reception {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__pending {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-4, 16px);
  }

  &__pending-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__pending-title {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__empty {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    padding: var(--p-2, 8px) 0;
  }

  &__ship {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }

  &__ship-info {
    min-width: 0;
  }

  &__ship-offerer {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__ship-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
}

@media (max-width: 768px) {
  .reception {
    padding: var(--p-4, 16px);

    &__ship {
      flex-direction: column;
      align-items: stretch;
    }
  }
}
</style>
