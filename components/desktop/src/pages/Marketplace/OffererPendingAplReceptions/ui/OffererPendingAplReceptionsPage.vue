<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { groupAplReceptions, type ReceptionGroup } from 'src/shared/lib/marketplace';
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
    items.value = await listAplReceptionsAsSupplier();
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

// Спиннер первичной загрузки — пока список ещё пуст.
const showLoader = computed(() => loading.value && !items.value.length);
</script>

<template lang="pug">
q-page.offerer-apl(role='region', aria-label='Подпись приёмки')
  PageHint(storage-key='mp:offerer-apl:banner-dismissed')
    | Поставки, по которым ждут вашу подпись. Подписывая поставку, вы
    | подтверждаете факт приёмки — затем она уходит на закрывающую подпись
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

  .offerer-apl__loading(v-if='showLoader')
    q-spinner(size='28px', color='primary')

  .offerer-apl__grid(v-else-if='groups.length')
    BaseCard.offerer-apl__card(v-for='g in groups', :key='g.key')
      template(#head)
        .offerer-apl__card-head
          q-icon(name='local_shipping', size='24px')
          .offerer-apl__card-ident
            span.offerer-apl__card-name Поставка на {{ g.braname }}
            span.offerer-apl__card-sub {{ variantLabel(g.variant) }}
      template(#actions)
        .offerer-apl__card-methods
          BaseBadge(:variant='statusOf(g.status).variant') {{ statusOf(g.status).label }}
          BaseBadge(v-if='g.receptions.length > 1', variant='info') Доставок: {{ g.receptions.length }}

      .offerer-apl__card-ttn(v-if='g.ttnNumbers.length') ТТН {{ g.ttnNumbers.join(', ') }}
      ul.offerer-apl__items(v-if='g.lines.length')
        li.offerer-apl__item(v-for='l in g.lines', :key='l.key')
          span.offerer-apl__prod {{ l.productName }}
          span.offerer-apl__qty {{ l.quantity }} {{ marketplaceUnitShort(l.unit) }}
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

  &__toolbar {
    display: flex;
    justify-content: flex-end;
  }

  &__loading {
    display: flex;
    justify-content: center;
    padding: var(--p-6, 24px);
  }

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

  &__card-sub {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__card-methods {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-1, 4px);
    justify-content: flex-end;
  }

  &__card-ttn {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
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
