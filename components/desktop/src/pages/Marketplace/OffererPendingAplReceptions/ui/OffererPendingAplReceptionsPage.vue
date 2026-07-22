<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseChip, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { debounce } from 'quasar';
import { groupAplReceptions, useMarketplaceRealtime, type ReceptionGroup } from 'src/shared/lib/marketplace';
import {
  listAplReceptionsAsSupplier,
  type MarketplaceAplReceptionView,
} from '../api';
import SignAplReceptionDialog from './SignAplReceptionDialog.vue';

/**
 * Offerer-стол «Подпись приёмки»: поставщик подтверждает факт приёмки первой
 * подписью (on-chain `signsupp`), после чего акт уходит на закрывающую подпись
 * председателя КУ.
 *
 * Акты группируются в СВОДНЫЕ ПОСТАВКИ (КУ + способ доставки + статус):
 * поставщик видит и подписывает доставку целиком одной кнопкой, а не каждую
 * единицу имущества по отдельности. Под капотом по каждому акту — отдельная
 * транзакция.
 */

const route = useRoute();
const coopname = computed(() => String(route.params.coopname ?? ''));

// Человекочитаемое имя КУ-получателя + адрес вместо технического braname:
// поставщик держит в голове «Ромашка» и где это, а не служебный account-id.
// Партия/акт несут только braname — резолвим по нему на фронте через KU-стор.
const kuStore = useMarketplaceKUDetailsStore();
const kuByBraname = computed(() => {
  const m = new Map<string, { name: string; address: string }>();
  for (const k of kuStore.details) {
    m.set(k.coreBraname, { name: k.name || k.coreBraname, address: k.addressFull ?? '' });
  }
  return m;
});
function kuName(braname: string): string {
  return kuByBraname.value.get(braname)?.name ?? braname;
}
function kuAddr(braname: string): string {
  return kuByBraname.value.get(braname)?.address ?? '';
}

const items = ref<MarketplaceAplReceptionView[]>([]);
const loading = ref(false);
const signDialog = ref(false);
const signGroup = ref<ReceptionGroup<MarketplaceAplReceptionView> | null>(null);

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

const VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};
function variantLabel(v: string): string {
  return VARIANT_LABEL[v] ?? v;
}

// Ждущие подписи поставщика — наверх (это его действие), принятые/прочие — ниже.
const STATUS_SORT: Record<string, number> = {
  PENDING_SUPPLIER_SIGN: 0,
  PENDING_CHAIRMAN_RECEPTION_SIGN: 1,
  ACCEPTED_TO_COOP: 2,
  CANCELLED: 3,
};

const groups = computed(() =>
  groupAplReceptions(items.value, { byOfferer: false }).sort(
    (a, b) => (STATUS_SORT[a.status] ?? 99) - (STATUS_SORT[b.status] ?? 99),
  ),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [receptions] = await Promise.all([
      listAplReceptionsAsSupplier(),
      // Реквизиты КУ для человекочитаемых заголовков; ошибка резолва имени
      // не должна валить список актов — грузим параллельно и без throw.
      kuStore.load({ coopname: coopname.value, onlyActive: false }).catch(() => undefined),
    ]);
    items.value = receptions;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить акты на подпись');
  } finally {
    loading.value = false;
  }
}

function sign(group: ReceptionGroup<MarketplaceAplReceptionView>): void {
  signGroup.value = group;
  signDialog.value = true;
}

onMounted(() => {
  void load();
});

// Realtime вместо поллинга: очный акт на стойке приходит личным сигналом
// «приёмка ждёт подписи», закрывающая подпись председателя двигает статусы
// заказов поставщика — оба повода тихо перечитать список. Страховка от
// пропущенного сигнала — 60-сек resync канала и catch-up на возврат вкладки.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  {
    MarketplaceReceptionPendingSignEvent: () => reloadLive(),
    MarketplaceOrderStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() }
);

// Спиннер первичной загрузки — пока список ещё пуст.
const showLoader = computed(() => loading.value && !items.value.length);
</script>

<template lang="pug">
q-page.offerer-apl(role='region', aria-label='Подпись приёмки')
  PageHint(storage-key='mp:offerer-apl:banner-dismissed')
    | Поставки, по которым ждут вашу подпись. Подписывая поставку, вы
    | подтверждаете факт приёмки — затем она уходит на закрывающую подпись
    | председателя КУ.


  //- Канон загрузки: скелетон, а не спиннер.
  CardListSkeleton(v-if='showLoader', :count='3')

  .offerer-apl__grid(v-else-if='groups.length')
    BaseCard.offerer-apl__card(v-for='g in groups', :key='g.key')
      template(#head)
        .offerer-apl__card-head
          q-icon(name='local_shipping', size='24px')
          .offerer-apl__card-ident
            span.offerer-apl__card-name Поставка на {{ kuName(g.braname) }}
            span.offerer-apl__card-addr(v-if='kuAddr(g.braname)')
              q-icon(name='place', size='14px')
              | {{ kuAddr(g.braname) }}
            span.offerer-apl__card-sub {{ variantLabel(g.variant) }}
      template(#actions)
        .offerer-apl__card-methods
          BaseBadge(:variant='statusOf(g.status).variant') {{ statusOf(g.status).label }}

      .offerer-apl__ttn(v-if='g.ttnNumbers.length')
        span.offerer-apl__ttn-label
          q-icon(name='description', size='14px')
          | {{ g.ttnNumbers.length > 1 ? 'Товарно-транспортные накладные' : 'Товарно-транспортная накладная' }}
        .offerer-apl__ttn-list
          BaseChip(v-for='n in g.ttnNumbers', :key='n', variant='neutral', size='sm') {{ n }}
      ul.offerer-apl__items(v-if='g.lines.length')
        li.offerer-apl__item(v-for='l in g.lines', :key='l.key')
          span.offerer-apl__prod {{ l.productName }}
          span.offerer-apl__qty {{ l.quantity }} {{ marketplaceOrderUnitLabel(l.unit, l.orderUnitSize) }}
      .offerer-apl__summary
        span.offerer-apl__summary-label Сумма приёмки
        span.offerer-apl__amount {{ formatAsset2Digits(g.totalAmount) }} ₽

      .offerer-apl__foot(v-if='g.status === "PENDING_SUPPLIER_SIGN"')
        BaseButton(variant='primary', @click='sign(g)')
          template(#icon-left)
            q-icon(name='draw', size='18px')
          | Подписать

  EmptyState(
    v-else,
    title='Поставок на подпись нет',
    body='Когда партия будет принята на ПВЗ — поставка появится здесь для вашей подписи.'
  )
    template(#icon)
      q-icon(name='task_alt', size='48px')

  SignAplReceptionDialog(
    v-model='signDialog',
    :group='signGroup',
    @signed='load'
  )
</template>

<style scoped lang="scss">
.offerer-apl {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: var(--p-3, 12px);
  }

  &__card {
    height: 100%;

    :deep(.base-card__body) {
      display: flex;
      flex-direction: column;
      gap: var(--p-3, 12px);
    }
  }

  &__card-head {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;
  }

  &__card-ident {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__card-name {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__card-addr {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    overflow-wrap: anywhere;

    .q-icon {
      flex: 0 0 auto;
      color: var(--p-ink-3);
    }
  }

  &__card-sub {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
  }

  &__card-methods {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-1, 4px);
    justify-content: flex-end;
  }

  &__ttn {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__ttn-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--p-fs-meta, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);

    .q-icon {
      color: var(--p-ink-3);
    }
  }

  &__ttn-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-1, 4px);
    font-variant-numeric: tabular-nums;
  }

  &__items {
    margin: 0;
    padding: var(--p-3, 12px);
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    background: var(--p-surface-2);
    border-radius: var(--p-r-sm, 8px);
  }

  &__item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__prod {
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__qty {
    flex: 0 0 auto;
    color: var(--p-ink);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  &__summary {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }

  &__summary-label {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__amount {
    flex: 0 0 auto;
    font-family: var(--p-mono);
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__foot {
    display: flex;
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .offerer-apl {
    padding: var(--p-4, 16px);

    &__grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
