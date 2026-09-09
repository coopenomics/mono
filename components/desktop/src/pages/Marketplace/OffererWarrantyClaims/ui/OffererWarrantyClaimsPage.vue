<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint, WalletCard } from 'src/shared/ui/domain';
import { useSystemStore } from 'src/entities/System/model';
import { marketplaceOrderSaleUnitLabel } from 'src/shared/lib/consts/marketplace-units';
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
import DisagreeClaimDialog from './DisagreeClaimDialog.vue';

/**
 * Стол поставщика «Гарантийные возвраты» (99D-13). Две сводки по кошелькам
 * поставщика — непризнанные претензии (по умолчанию он не согласен, для
 * кооператива это основание для иска) и признанный долг к удержанию из
 * выплат — и список претензий: имущество, количество, сумма, дата,
 * состояние. «Открыть» ведёт в карточку с рекламацией, фотографиями и
 * пройденными шагами; «Согласен» переводит сумму в долг, «Не согласен» лишь
 * показывает контакты участка — в цепи ничего не происходит. Текст
 * рекламации в списке не показывается — он может быть длинным.
 */

const router = useRouter();
const { info } = useSystemStore();

const items = ref<MarketplaceSupplierClaimView[]>([]);
const summary = ref<MarketplaceSupplierClaimSummaryView | null>(null);
const loading = ref(false);
const admitting = ref<string | null>(null);
const disagreeTarget = ref<MarketplaceSupplierClaimView | null>(null);
const disagreeDialog = ref(false);

const pendingCount = computed(() => items.value.filter((c) => c.status === 'PENDING').length);

function quantityLabel(c: MarketplaceSupplierClaimView): string {
  return marketplaceOrderSaleUnitLabel(c.actual_quantity, c.unit_of_measure, c.package_size);
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

function disagree(c: MarketplaceSupplierClaimView): void {
  disagreeTarget.value = c;
  disagreeDialog.value = true;
}

onMounted(() => {
  void load();
});
</script>

<template lang="pug">
q-page.offerer-claims
  PageHint(storage-key='mp:offerer-claims:banner-dismissed')
    | Гарантийные претензии по вашему товару: пайщик вернул имущество, кооператив
    | принял его на участке, совет отменил сделку. Пока вы не согласились, сумма
    | считается непризнанной и из выплат не удерживается, но кооператив вправе
    | обратиться с ней в суд. Согласие переводит сумму в долг, который гасится
    | из ваших следующих выплат. Имущество можно забрать на участке, где оно принято.

  .offerer-claims__cards
    WalletCard(
      neutral,
      icon='gavel',
      title='Не признано'
      subtitle='Претензии, с которыми вы не согласились'
      :balance='summary ? formatAsset2Digits(summary.not_admitted_total) : "0.00"',
      :symbol='summary?.symbol ?? ""',
      balance-label='Спорная сумма'
      :loading='loading && !summary'
    )
    WalletCard(
      program='wallet',
      icon='request_quote',
      title='Признанный долг',
      subtitle='Гасится из следующих выплат'
      :balance='summary ? formatAsset2Digits(summary.admitted_debt) : "0.00"',
      :symbol='summary?.symbol ?? ""',
      balance-label='К удержанию'
      :loading='loading && !summary'
    )

  .offerer-claims__title
    .t-h2 Претензии
    BaseBadge(v-if='pendingCount', variant='warn') Не признано: {{ pendingCount }}

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
        .claim-card__actions
          BaseButton(variant='ghost', size='sm', @click='open(c)')
            template(#icon-left)
              q-icon(name='open_in_new', size='16px')
            | Открыть
          template(v-if='c.status === "PENDING"')
            BaseButton(variant='primary', size='sm', :loading='admitting === c.id', @click='admit(c)')
              template(#icon-left)
                q-icon(name='check_circle', size='16px')
              | Согласен
            BaseButton(variant='secondary', size='sm', :disabled='admitting === c.id', @click='disagree(c)')
              template(#icon-left)
                q-icon(name='cancel', size='16px')
              | Не согласен

  EmptyState(
    v-else,
    title='Гарантийных претензий нет',
    body='Здесь появятся претензии по вашему товару, если пайщик вернёт его по гарантии и совет отменит сделку.'
  )
    template(#icon)
      q-icon(name='assignment_return', size='48px')

  DisagreeClaimDialog(v-model='disagreeDialog', :claim='disagreeTarget')
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
