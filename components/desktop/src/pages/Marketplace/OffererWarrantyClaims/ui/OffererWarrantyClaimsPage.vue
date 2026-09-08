<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint, WalletCard } from 'src/shared/ui/domain';
import { useSystemStore } from 'src/entities/System/model';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { formatDateToHumanDateTime } from 'src/shared/lib/utils/dates/formatDateToHumanDateTime';
import {
  admitSupplierClaim,
  fetchSupplierClaimSummary,
  listMySupplierClaims,
  supplierClaimStatusLabel,
  supplierClaimStatusVariant,
  type MarketplaceSupplierClaimSummaryView,
  type MarketplaceSupplierClaimView,
} from '../api';
import RefuseClaimDialog from './RefuseClaimDialog.vue';

/**
 * Стол поставщика «Гарантийные возвраты» (99D-13). Две сводки по кошелькам
 * поставщика — признанный долг к удержанию из выплат и отказанные претензии
 * (потенциальный иск) — и список претензий: имущество, количество, сумма,
 * дата, состояние. «Открыть» ведёт в карточку с рекламацией, фотографиями и
 * пройденными шагами; «Принять» и «Отказать» доступны, пока ответа нет.
 * Текст рекламации в списке не показывается — он может быть длинным.
 */

const router = useRouter();
const { info } = useSystemStore();

const items = ref<MarketplaceSupplierClaimView[]>([]);
const summary = ref<MarketplaceSupplierClaimSummaryView | null>(null);
const loading = ref(false);
const admitting = ref<string | null>(null);
const refuseTarget = ref<MarketplaceSupplierClaimView | null>(null);
const refuseDialog = ref(false);

const pendingCount = computed(() => items.value.filter((c) => c.status === 'PENDING').length);

function quantityLabel(c: MarketplaceSupplierClaimView): string {
  const saleUnit = marketplaceOrderSaleUnit(c.actual_quantity, c.unit_of_measure, c.package_size);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [list, sum] = await Promise.all([listMySupplierClaims(), fetchSupplierClaimSummary()]);
    items.value = list;
    summary.value = sum;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить гарантийные возвраты');
  } finally {
    loading.value = false;
  }
}

function open(c: MarketplaceSupplierClaimView): void {
  void router.push({ name: 'marketplace-supplier-claim-detail', params: { coopname: info.coopname, claimId: c.id } });
}

async function admit(c: MarketplaceSupplierClaimView): Promise<void> {
  if (admitting.value) return;
  admitting.value = c.id;
  try {
    await admitSupplierClaim(c.id);
    SuccessAlert(`Претензия признана: ${formatAsset2Digits(c.amount)} ₽ будут удержаны из следующих выплат.`);
    await load();
  } catch (e) {
    FailAlert(e, 'Не удалось признать претензию');
  } finally {
    admitting.value = null;
  }
}

function refuse(c: MarketplaceSupplierClaimView): void {
  refuseTarget.value = c;
  refuseDialog.value = true;
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.offerer-claims
  PageHint(storage-key='mp:offerer-claims:banner-dismissed')
    | Гарантийные претензии по вашему товару: пайщик вернул имущество, кооператив
    | принял его на участке, совет отменил сделку. Признанная сумма удерживается
    | из ваших следующих выплат; отказ остаётся за вами, но кооператив вправе
    | обратиться в суд. Имущество можно забрать на участке, где оно принято.

  .offerer-claims__cards
    WalletCard(
      program='wallet',
      icon='request_quote',
      title='Признанный долг',
      subtitle='Будет удержано из следующих выплат'
      :balance='summary ? formatAsset2Digits(summary.admitted_debt) : "0.00"',
      :symbol='summary?.symbol ?? ""',
      balance-label='К удержанию'
      :loading='loading && !summary'
    )
    WalletCard(
      neutral,
      icon='gavel',
      title='Отказано'
      subtitle='Претензии, по которым вы отказали'
      :balance='summary ? formatAsset2Digits(summary.refused_total) : "0.00"',
      :symbol='summary?.symbol ?? ""',
      balance-label='Спорная сумма'
      :loading='loading && !summary'
    )

  .offerer-claims__title
    .t-h2 Претензии
    BaseBadge(v-if='pendingCount', variant='warn') Ждут ответа: {{ pendingCount }}

  CardListSkeleton(v-if='loading && !items.length', :count='3')
  .offerer-claims__list(v-else-if='items.length')
    BaseCard(v-for='c in items', :key='c.id')
      .claim-card
        .claim-card__top
          .claim-card__product
            .claim-card__name {{ c.product_name || 'Товар по заказу' }}
            .claim-card__meta {{ quantityLabel(c) }} · участок {{ c.delivery_branch_name || c.delivery_braname }}
          BaseBadge(:variant='supplierClaimStatusVariant(c.status)') {{ supplierClaimStatusLabel(c.status) }}
        .claim-card__row
          .claim-card__amount {{ formatAsset2Digits(c.amount) }} ₽
          .claim-card__date {{ formatDateToHumanDateTime(c.issued_at) }}
        .claim-card__hint(v-if='c.status === "PENDING" && c.auto_admit_at')
          | Без ответа претензия будет признана {{ formatDateToHumanDateTime(c.auto_admit_at) }}
        .claim-card__refuse(v-if='c.refuse_reason') Причина отказа: {{ c.refuse_reason }}
        .claim-card__actions
          BaseButton(variant='ghost', size='sm', @click='open(c)')
            template(#icon-left)
              q-icon(name='open_in_new', size='16px')
            | Открыть
          template(v-if='c.status === "PENDING"')
            BaseButton(variant='primary', size='sm', :loading='admitting === c.id', @click='admit(c)')
              template(#icon-left)
                q-icon(name='check_circle', size='16px')
              | Принять
            BaseButton(variant='secondary', size='sm', :disabled='admitting === c.id', @click='refuse(c)')
              template(#icon-left)
                q-icon(name='cancel', size='16px')
              | Отказать

  EmptyState(
    v-else,
    title='Гарантийных претензий нет',
    body='Здесь появятся претензии по вашему товару, если пайщик вернёт его по гарантии и совет отменит сделку.'
  )
    template(#icon)
      q-icon(name='assignment_return', size='48px')

  RefuseClaimDialog(v-model='refuseDialog', :claim='refuseTarget', @decided='load')
</template>

<style scoped lang="scss">
.offerer-claims {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--p-4, 16px);
  }

  &__title {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }
}

.claim-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);

  &__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }
  &__product {
    min-width: 0;
  }
  &__name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  &__meta {
    color: var(--p-ink-3);
    font-size: var(--p-fs-sm, 13px);
  }
  &__row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }
  &__amount {
    font-size: var(--p-fs-h3, 18px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  &__date {
    color: var(--p-ink-3);
    font-size: var(--p-fs-sm, 13px);
  }
  &__hint {
    color: var(--p-ink-2);
    font-size: var(--p-fs-sm, 13px);
  }
  &__refuse {
    color: var(--p-neg);
  }
  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }
}

@media (max-width: 768px) {
  .offerer-claims {
    padding: var(--p-4, 16px);
  }
}
</style>
