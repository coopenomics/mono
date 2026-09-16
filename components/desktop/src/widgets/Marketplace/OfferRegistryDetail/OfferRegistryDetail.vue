<script lang="ts" setup>
/**
 * Карточка предложения для реестров стола администратора — читающая, без
 * заказа и корзины. Её открывают оверлеем реестр предложений, реестр заказов
 * и склад, поэтому она самодостаточна: получает идентификатор и сама грузит
 * предложение, справочник категорий и ставку членского взноса.
 *
 * Полная страница предложения (`marketplace-admin-offer-detail`) остаётся —
 * оверлей даёт кнопку перехода на неё. Здесь показываем то, ради чего реестр
 * открывают: что за товар, чей он, почём, сколько осталось, в какой упаковке,
 * на каких участках и с какими сроками.
 */
import { computed, ref, watch } from 'vue';
import { FailAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useDesktopStore } from 'src/entities/Desktop';
import { BaseBadge, BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { EntityIdBadge } from 'src/shared/ui';
import { DataRow } from 'src/shared/ui/domain';
import { OfferGallery } from 'src/widgets/Marketplace/OfferGallery';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts';
import { MarketplaceSaleForm } from 'src/shared/lib/consts/marketplace-units';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import {
  applyMembershipFee,
  getMembershipFeePercent,
  marketplacePackageStockLabel,
} from 'src/shared/lib/marketplace';
import { useOfferModeration } from 'src/features/Marketplace/OfferModeration';
import {
  fetchCategoryNames,
  fetchOffer,
  type MarketplaceOfferDetailView,
} from 'src/entities/MarketplaceOffer';

const props = withDefaults(
  defineProps<{
    offerId: string;
    /** Показывать решения модератора, когда предложение ждёт модерации. */
    moderatable?: boolean;
  }>(),
  { moderatable: false },
);

const emit = defineEmits<{
  (e: 'moderated'): void;
}>();

const system = useSystemStore();
const desktop = useDesktopStore();

/**
 * Действия модератора в карточке — по праву председателя, а не по тому, с
 * какого экрана её открыли: гарантийный срок правят и из реестра предложений,
 * и из очереди модерации, и со склада, куда карточка приходит по позиции.
 * Признак `moderatable` оставлен для экранов, которые включают действия явно.
 */
const canModerateOffers = computed(
  () => props.moderatable || desktop.hasGrant('market-admin', 'Offer:moderate'),
);

const offer = ref<MarketplaceOfferDetailView | null>(null);
const categoryNames = ref<Record<number, string>>({});
const feePercent = ref(0);
const loading = ref(true);
const notFound = ref(false);

const OFFER_STATUS: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  PENDING_MODERATION: { label: 'На модерации', variant: 'warn' },
  ACTIVE: { label: 'Опубликовано', variant: 'pos' },
  REJECTED: { label: 'Отклонено', variant: 'neg' },
  WITHDRAWN: { label: 'Снято с публикации', variant: 'neutral' },
};

async function load(): Promise<void> {
  if (!props.offerId) return;
  loading.value = true;
  notFound.value = false;
  try {
    const [o, cats] = await Promise.all([fetchOffer(props.offerId), fetchCategoryNames()]);
    offer.value = o;
    categoryNames.value = cats;
    notFound.value = !o;
  } catch (e) {
    offer.value = null;
    notFound.value = true;
    FailAlert(e, 'Не удалось загрузить предложение');
  } finally {
    loading.value = false;
  }
}

watch(() => props.offerId, () => void load(), { immediate: true });

// Ставка членского взноса входит в цену для всех, кроме стола поставщика:
// администратор смотрит ту же цену, что видит заказчик.
void (async () => {
  try {
    feePercent.value = await getMembershipFeePercent();
  } catch {
    // Без ставки показываем цену поставщика как есть.
  }
})();

const statusLabel = computed(() =>
  offer.value ? (OFFER_STATUS[offer.value.status]?.label ?? offer.value.status) : '',
);
const statusVariant = computed<BaseBadgeVariant>(() =>
  offer.value ? (OFFER_STATUS[offer.value.status]?.variant ?? 'neutral') : 'neutral',
);

const images = computed(() => (offer.value ? marketplaceOfferImageUrls(offer.value.images) : []));

const unitShort = computed(() =>
  offer.value ? marketplaceOrderUnitLabel(offer.value.unit_of_measure) : '',
);

const categoryLabel = computed(() => {
  const id = offer.value?.category_id;
  return id != null ? (categoryNames.value[id] ?? null) : null;
});

/** Отпуск упаковкой: заказчик берёт целые упаковки, цена — за упаковку. */
const isPackaged = computed(
  () => offer.value?.sale_form === MarketplaceSaleForm.PACKAGED && !!offer.value?.packages?.length,
);

const defaultPackage = computed(
  () => offer.value?.packages?.find((p) => p.is_default) ?? offer.value?.packages?.[0] ?? null,
);

/** Компактная запись объёма: 0.5 → «0,5». */
function formatSize(size: number): string {
  return String(size).replace('.', ',');
}

const saleUnitLabel = computed(() => {
  const pkg = defaultPackage.value;
  if (!isPackaged.value || !pkg) return unitShort.value;
  return `упак. ${formatSize(pkg.size)} ${unitShort.value}`;
});

const priceLabel = computed(() => {
  if (!offer.value) return '—';
  const base =
    isPackaged.value && defaultPackage.value
      ? Number(defaultPackage.value.price)
      : Number(offer.value.price_per_unit);
  const withFee = applyMembershipFee(base, feePercent.value);
  return `${withFee.toLocaleString('ru-RU')} ${system.governSymbol} / ${saleUnitLabel.value}`;
});

const stockLabel = computed(() => {
  const o = offer.value;
  if (!o) return '—';
  if (o.unlimited_flag) return 'Без ограничения остатка';
  if (o.quantity_available <= 0) return 'Нет в наличии';
  if (isPackaged.value) {
    return marketplacePackageStockLabel(o.packages, o.unit_of_measure);
  }
  return `${o.quantity_available} ${unitShort.value}`;
});

const packageRows = computed(() =>
  (offer.value?.packages ?? []).map((p) => ({
    key: p.id,
    name: [`${formatSize(p.size)} ${unitShort.value}`, p.package_type].filter(Boolean).join(', '),
    price: `${applyMembershipFee(Number(p.price), feePercent.value).toLocaleString('ru-RU')} ${system.governSymbol}`,
    stock: offer.value?.unlimited_flag ? 'без ограничения' : `${p.quantity_available} упак.`,
  })),
);

const deliveryPoints = computed(() =>
  (offer.value?.delivery_points ?? []).map((p) => ({
    key: p.braname,
    name: p.name ?? p.braname,
    volume: `от ${p.min_supply_volume} ${unitShort.value}`,
  })),
);

const supplierTitle = computed(
  () => offer.value?.supplier_name || offer.value?.supplier_account || '—',
);

function formatDays(days: number | null | undefined, empty: string): string {
  return days && days > 0 ? `${days} дн.` : empty;
}

// Решения модератора — тот же общий композабл, что и на ленте «Модерация» и
// на полной странице предложения: диалог подтверждения и мутация одни на всех.
// Сюда же переехало изменение гарантийного срока: оно относится к самому
// предложению, и в реестре отдельной кнопкой в строке только мешало
// (решение владельца 14.09.2026).
const { isApproving, isRejecting, isSettingWarranty, confirmApprove, confirmReject, confirmSetWarranty } =
  useOfferModeration({
    onApproved: () => {
      void load();
      emit('moderated');
    },
    onRejected: () => {
      void load();
      emit('moderated');
    },
    onWarrantyChanged: () => {
      void load();
      emit('moderated');
    },
  });

function editWarranty(): void {
  const o = offer.value;
  if (!o) return;
  confirmSetWarranty(
    { id: o.id, product_name: o.product_name, shelf_life_days: o.shelf_life_days },
    o.warranty_days ?? 0,
  );
}

const canModerate = computed(
  () => canModerateOffers.value && offer.value?.status === 'PENDING_MODERATION',
);
</script>

<template lang="pug">
.offer-registry-detail(role='region', aria-label='Предложение')
  q-inner-loading(:showing='loading && !offer')
    q-spinner(color='primary', size='2em')

  EmptyState(
    v-if='notFound && !loading',
    title='Предложение не найдено',
    body='Возможно, оно снято с публикации или удалено.'
  )
    template(#icon)
      q-icon(name='search_off', size='48px')

  template(v-if='offer')
    BaseCard.offer-registry-detail__card
      .offer-registry-detail__hero
        .offer-registry-detail__cover
          OfferGallery(
            :images='images',
            :alt='offer.product_name',
            height='100%',
            placeholder-icon-size='40px'
          )

        .offer-registry-detail__info
          .offer-registry-detail__top
            .t-h2.offer-registry-detail__title {{ offer.product_name }}
            BaseBadge(:variant='statusVariant') {{ statusLabel }}

          .offer-registry-detail__sub
            EntityIdBadge(:rawId='offer.id.slice(0, 8)', copy-on-click)
            template(v-if='categoryLabel')
              span(aria-hidden='true') ·
              span {{ categoryLabel }}

          .offer-registry-detail__facts
            .offer-registry-detail__fact
              .offer-registry-detail__fact-label Цена
              .offer-registry-detail__fact-value--money {{ priceLabel }}
            .offer-registry-detail__fact
              .offer-registry-detail__fact-label В наличии
              .offer-registry-detail__fact-value {{ stockLabel }}

          .offer-registry-detail__moderation(v-if='canModerate')
            BaseButton(
              variant='danger',
              size='sm',
              :loading='isRejecting(offer.id)',
              @click='confirmReject(offer)'
            )
              template(#icon-left)
                q-icon(name='close', size='16px')
              | Отклонить
            BaseButton(
              variant='primary',
              size='sm',
              :loading='isApproving(offer.id)',
              @click='confirmApprove(offer)'
            )
              template(#icon-left)
                q-icon(name='check', size='16px')
              | Одобрить

    BaseCard.offer-registry-detail__card
      template(#head)
        .t-h3 Предложение
      DataRow(label='Поставщик', :value='supplierTitle')
      DataRow(label='Срок годности', :value='formatDays(offer.shelf_life_days, "Без срока годности")')
      //- Кнопка живёт в колонке значения той же строки: строки карточки стоят
      //- одной сеткой, и собственная обёртка вокруг строки сбивала бы её
      //- значение относительно соседних.
      DataRow(label='Гарантийный срок возврата')
        template(#value-override)
          span {{ formatDays(offer.warranty_days, 'Без гарантийного срока возврата') }}
          BaseButton(
            v-if='canModerateOffers',
            variant='ghost',
            size='sm',
            :loading='isSettingWarranty(offer.id)',
            @click='editWarranty'
          )
            template(#icon-left)
              q-icon(name='event_repeat', size='16px')
            | Изменить

    BaseCard.offer-registry-detail__card(v-if='packageRows.length')
      template(#head)
        .t-h3 Упаковки
      DataRow(
        v-for='row in packageRows',
        :key='row.key',
        :label='row.name',
        :value='`${row.price} · ${row.stock}`'
      )

    BaseCard.offer-registry-detail__card(v-if='deliveryPoints.length')
      template(#head)
        .t-h3 Участки поставки
      DataRow(v-for='p in deliveryPoints', :key='p.key', :label='p.name', :value='p.volume')

    BaseCard.offer-registry-detail__card(v-if='offer.description')
      template(#head)
        .t-h3 Описание
      .offer-registry-detail__desc {{ offer.description }}
</template>

<style scoped lang="scss">
.offer-registry-detail {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  min-height: 160px;

  &__card {
    width: 100%;
  }

  &__hero {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: var(--p-4, 16px);
    align-items: start;
  }

  &__cover {
    height: 160px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    overflow: hidden;
    background: var(--p-surface-2);
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    min-width: 0;
  }

  &__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__title {
    margin: 0;
    overflow-wrap: anywhere;
  }

  &__sub {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-5, 20px);
    margin-top: var(--p-1, 4px);
  }

  &__fact-label {
    color: var(--p-ink-3);
    font-size: var(--p-fs-meta, 12px);
  }

  &__fact-value {
    color: var(--p-ink);
    font-weight: 500;
  }

  &__fact-value--money {
    color: var(--p-ink);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  &__moderation {
    display: flex;
    gap: var(--p-2, 8px);
    margin-top: var(--p-2, 8px);
  }

  &__desc {
    white-space: pre-wrap;
    color: var(--p-ink-2);
    line-height: var(--p-lh-body, 1.5);
  }
}

@media (max-width: 599px) {
  .offer-registry-detail__hero {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
