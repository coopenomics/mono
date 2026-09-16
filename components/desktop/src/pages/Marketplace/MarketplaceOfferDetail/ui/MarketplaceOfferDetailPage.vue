<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useFirstLoad } from 'src/shared/lib/composables';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton, BaseBadge, EmptyState } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { OfferGallery } from 'src/widgets/Marketplace/OfferGallery';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts';
import { MarketplaceSaleForm } from 'src/shared/lib/consts/marketplace-units';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import {
  useMarketplaceRealtime,
  getMembershipFeePercent,
  applyMembershipFee,
  marketplaceAvailablePackages,
  marketplacePackageStockLabel,
} from 'src/shared/lib/marketplace';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { useOfferModeration } from 'src/features/Marketplace/OfferModeration';
import { fetchCategories } from '../../MarketplaceCatalog/api';
import AddToCartDialog from '../../MarketplaceCatalog/ui/AddToCartDialog.vue';
import { fetchOffer } from '../api';
import type { MarketplaceOfferDetailView } from '../types';

/**
 * Эпик 15: страница полного описания предложения. Карточка каталога несёт лишь
 * категорию + поставщика + краткое описание; всё остальное (полное описание без
 * ограничения длины, участки поставки с минимальным объёмом, гарантия, галерея)
 * раскрывается здесь по клику на карточку. В корзину кладётся тем же диалогом,
 * что и из каталога (Эпик 16), с текущим КУ заказчика.
 */

const route = useRoute();
const router = useRouter();
const system = useSystemStore();
const cartStore = useMarketplaceCartStore();

const coopname = computed(() => String(route.params.coopname ?? ''));
const offerId = computed(() => String(route.params.offerId ?? ''));

// Режим просмотра модератором (стол администратора): страница только для
// чтения — кнопки «Заказать» нет, «назад» ведёт в «Модерацию», а не в каталог.
const readonly = computed(() => route.meta?.readonly === true);

// Откуда пришли (query `from`) — чтобы «назад» называлась и вела туда же, где
// человек был. Карточку открывают с пяти экранов: корзина заказчика и четыре
// реестра стола администратора (предложения, заказы, модерация, склад).
// Реальный переход — router.back() (история совпадает с реферрером), это
// корректные подпись и запасной маршрут.
const BACK_TARGETS: Record<string, { label: string; name: string }> = {
  cart: { label: 'В корзину', name: 'marketplace-cart' },
  orders: { label: 'К реестру заказов', name: 'marketplace-admin-orders' },
  offers: { label: 'К реестру предложений', name: 'marketplace-admin-offers' },
  moderation: { label: 'К модерации', name: 'marketplace-moderation' },
  warehouse: { label: 'К складу', name: 'marketplace-warehouse-summary' },
};

const backTarget = computed<{ label: string; name: string }>(() => {
  const from = BACK_TARGETS[String(route.query.from ?? '')];
  if (from) return from;
  // Без пометки: на столе администратора карточку исторически открывала
  // только модерация, у заказчика — каталог.
  if (readonly.value) return { label: 'К модерации', name: 'marketplace-moderation' };
  return { label: 'К каталогу', name: 'marketplace-catalog' };
});

// Модерация прямо на странице: показываем «Одобрить»/«Отклонить», только если
// открыто на столе администратора и предложение ещё ждёт решения.
const canModerate = computed(
  () => readonly.value && offer.value?.status === 'PENDING_MODERATION',
);

function backToModeration(): void {
  void router.push({ name: 'marketplace-moderation', params: { coopname: coopname.value } });
}

// Диалоги + мутации модерации — общий feature-композабл (DRY с лентой
// «Модерация»). После решения возвращаемся в очередь модерации.
const { isApproving, isRejecting, isSettingWarranty, confirmApprove, confirmReject, confirmSetWarranty } =
  useOfferModeration({
    onApproved: backToModeration,
    onRejected: backToModeration,
    onWarrantyChanged: () => void load(),
  });

/**
 * Гарантийный срок возврата задаёт модератор — здесь же, на карточке
 * предложения. В реестре он жил отдельной кнопкой в строке и мешал ей
 * открываться (решение владельца 14.09.2026).
 */
function editWarranty(): void {
  const o = offer.value;
  if (!o) return;
  confirmSetWarranty(
    { id: o.id, product_name: o.product_name, shelf_life_days: o.shelf_life_days },
    o.warranty_days ?? 0,
  );
}

const offer = ref<MarketplaceOfferDetailView | null>(null);
// true до первого запроса: иначе первый кадр до загрузки показывает пустое
// состояние вместо скелетона, и первая загрузка неотличима от пустого списка.
const loading = ref(true);
/** Каркас и пустое состояние — по первой загрузке; дочитка обновляет молча. */
const firstLoad = useFirstLoad(loading);
const categoryNames = ref<Record<number, string>>({});

const cartDialogOpen = ref(false);
// В корзину нельзя, пока заказчик не выбрал пункт выдачи (КУ задаёт витрину).
const noKU = computed(() => !cartStore.currentBraname);

const images = computed(() => (offer.value ? marketplaceOfferImageUrls(offer.value.images) : []));

// Подпись единицы заказа (фасовки): «100 г», «упаковка 8 шт», «шт»…
const unitShort = computed(() =>
  offer.value ? marketplaceOrderUnitLabel(offer.value.unit_of_measure) : '',
);

const categoryLabel = computed(() => {
  const id = offer.value?.category_id;
  return id != null ? categoryNames.value[id] ?? null : null;
});

/** Отпуск упаковкой: заказчик берёт целые упаковки, цена — за упаковку. */
const isPackaged = computed(
  () => offer.value?.sale_form === MarketplaceSaleForm.PACKAGED && !!offer.value?.packages?.length,
);
const isEmpty = computed(
  () => !!offer.value && !offer.value.unlimited_flag && offer.value.quantity_available <= 0,
);
const canOrder = computed(() => {
  const o = offer.value;
  if (!o) return false;
  if (o.unlimited_flag) return true;
  if (o.quantity_available <= 0) return false;
  // Отпуск упаковкой: пока нет свободной тары, брать нечего — общий остаток
  // в литрах тут ничего не решает.
  if (o.packages?.length) return marketplaceAvailablePackages(o.packages, false).length > 0;
  return true;
});
const stockLabel = computed(() => {
  if (!offer.value) return '';
  if (offer.value.unlimited_flag) return 'Без ограничения остатка';
  if (isEmpty.value) return 'Нет в наличии';
  // Остаток при отпуске упаковкой ведётся на каждой упаковке — показываем
  // по упаковкам, а не одним числом литров.
  if (isPackaged.value) {
    return `В наличии: ${marketplacePackageStockLabel(offer.value.packages, offer.value.unit_of_measure)}`;
  }
  return `В наличии: ${offer.value.quantity_available} ${unitShort.value}`;
});

// requirement b6: единая ставка членского взноса входит в цену для всех,
// кроме стола поставщика (там — своя цена + строка «для заказчика»).
const feePercent = ref(0);
// Цена — за единицу отпуска: при отпуске упаковкой это цена за упаковку, а
// не за литр. Основная упаковка задаёт цену, которую заказчик видит первой.
// Цену показываем по той таре, которую можно взять: иначе страница называет
// цену литровой бутылки, которой на складе нет (жалоба 2026-09-14).
const availablePackages = computed(() =>
  marketplaceAvailablePackages(offer.value?.packages, Boolean(offer.value?.unlimited_flag)),
);
const defaultPackage = computed(() => {
  const list = availablePackages.value.length
    ? availablePackages.value
    : offer.value?.packages ?? [];
  return list.find((p) => p.is_default) ?? list[0] ?? null;
});
const saleUnitLabel = computed(() => {
  const pkg = defaultPackage.value;
  if (!isPackaged.value || !pkg) return unitShort.value;
  return `упак. ${formatSize(pkg.size)} ${unitShort.value}`;
});
const priceLabel = computed(() => {
  if (!offer.value) return '';
  const base = isPackaged.value && defaultPackage.value
    ? Number(defaultPackage.value.price)
    : Number(offer.value.price_per_unit);
  const withFee = applyMembershipFee(base, feePercent.value);
  return `${withFee.toLocaleString('ru-RU')} ${system.governSymbol} / ${saleUnitLabel.value}`;
});

/** Компактная запись объёма: 0.5 → «0,5». */
function formatSize(size: number): string {
  return String(size).replace('.', ',');
}

/**
 * Упаковки предложения: что заказчик реально берёт. Без этого блока карточка
 * молчит о том, в чём приедет товар и сколько какой упаковки осталось —
 * заказчику и модератору видна была только цена за литр.
 */
const packageRows = computed(() =>
  (offer.value?.packages ?? []).map((p) => ({
    key: p.id,
    name: [`${formatSize(p.size)} ${unitShort.value}`, p.package_type].filter(Boolean).join(', '),
    price: `${applyMembershipFee(Number(p.price), feePercent.value).toLocaleString('ru-RU')} ${system.governSymbol}`,
    stock: offer.value?.unlimited_flag
      ? 'без ограничения'
      : p.quantity_available > 0
        ? `${p.quantity_available} упак.`
        : 'нет в наличии',
  })),
);
// Цена всегда задаётся за базовую единицу (Эпик 17) — справочный пересчёт из
// фасовки больше не нужен.
const referenceNote = computed(() => '');

const deliveryPoints = computed(() =>
  (offer.value?.delivery_points ?? []).map((p) => ({
    key: p.braname,
    name: p.name ?? p.braname,
    volume: `от ${p.min_supply_volume} ${unitShort.value}`,
  })),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [o, cats] = await Promise.all([fetchOffer(offerId.value), fetchCategories()]);
    offer.value = o;
    const map: Record<number, string> = {};
    for (const c of cats) map[Number(c.id)] = c.display_name;
    categoryNames.value = map;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function goBack(): void {
  if (window.history.length > 1) router.back();
  else {
    void router.push({ name: backTarget.value.name, params: { coopname: coopname.value } });
  }
}

// Realtime: остаток этого предложения меняют другие заказчики — строка
// «В наличии: N» и доступность кнопки «В корзину» обновляются сразу.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  {
    MarketplaceOfferStockChangedEvent: (event) => {
      if (event.offer_id === offerId.value) reloadLive();
    },
  },
  { onResync: () => reloadLive() },
);

onMounted(async () => {
  try {
    feePercent.value = await getMembershipFeePercent();
  } catch {
    // Без ставки показываем цену без строки взноса.
  }
  await load();
  // В режиме заказа нужен текущий КУ (для кнопки «В корзину» и диалога).
  if (!readonly.value) {
    try {
      await cartStore.load();
    } catch {
      // Корзина подгрузится при заходе в каталог; кнопка просто будет неактивна.
    }
  }
});
</script>

<template lang="pug">
q-page.offer-detail(role="region", aria-label="Описание предложения")
  //- Корзина в шапке — тот же header-виджет, что в каталоге (вне режима модерации).

  .offer-detail__back
    BaseButton(variant="ghost", size="sm", @click="goBack")
      template(#icon-left)
        q-icon(name="arrow_back", size="16px")
      | {{ backTarget.label }}

  q-inner-loading(:showing="firstLoad")
    q-spinner(color="primary", size="2em")

  EmptyState(
    v-if="!firstLoad && !offer",
    title="Предложение не найдено",
    body="Возможно, оно снято с публикации."
  )
    template(#icon)
      q-icon(name="search_off", size="48px")

  .offer-detail__grid(v-if="offer")
    //- Галерея (канон-виджет OfferGallery — единая карусель на всех экранах)
    .offer-detail__media
      OfferGallery(:images="images", :alt="offer.product_name", height="360px", placeholder-icon-size="64px")

    //- Сводка
    .offer-detail__summary
      .offer-detail__badges
        BaseBadge(v-if="categoryLabel", variant="neutral") {{ categoryLabel }}
        BaseBadge(:variant="isEmpty ? 'neutral' : 'pos'", dot) {{ stockLabel }}

      h1.offer-detail__title {{ offer.product_name }}

      .offer-detail__supplier(v-if="offer.supplier_name")
        q-icon(name="storefront", size="16px")
        span {{ offer.supplier_name }}

      .offer-detail__price {{ priceLabel }}
      .offer-detail__fee-note(v-if="referenceNote") {{ referenceNote }}

      //- Условия сделки стоят рядом с ценой, до кнопки: куда привезут, сколько
      //- живёт товар и сколько есть на возврат — это решается до «В корзину»,
      //- а не после описания в подвале страницы (решение владельца 14.09.2026).
      .offer-detail__facts
        //- Один участок читается строкой «Участок поставки — РОМАШКА, от 10 кг».
        //- Несколько — списком под общим заголовком, иначе непонятно, что за
        //- названия идут подряд.
        .offer-detail__facts-head(v-if="deliveryPoints.length > 1") Участки поставки
        DataRow(
          v-for="p in deliveryPoints",
          :key="p.key",
          :label="deliveryPoints.length > 1 ? p.name : 'Участок поставки'",
          :value="deliveryPoints.length > 1 ? p.volume : `${p.name} — ${p.volume}`"
        )
        DataRow(
          label="Срок годности",
          :value="offer.shelf_life_days > 0 ? `${offer.shelf_life_days} дн.` : 'Без срока годности'"
        )
        DataRow(label="Гарантийный срок возврата")
          template(#value-override)
            .offer-detail__warranty
              span {{ offer.warranty_days > 0 ? `${offer.warranty_days} дн.` : 'Без гарантийного срока возврата' }}
              //- Правка срока — только на столе администратора: у заказчика
              //- карточка читающая.
              BaseButton(
                v-if="readonly",
                variant="secondary",
                size="sm",
                :loading="isSettingWarranty(offer.id)",
                @click="editWarranty"
              )
                template(#icon-left)
                  q-icon(name="event_repeat", size="16px")
                | Изменить

      BaseButton(
        v-if="!readonly",
        variant="primary",
        :disabled="!canOrder || noKU",
        @click="cartDialogOpen = true"
      ) В корзину
      .offer-detail__noku-hint(v-if="!readonly && noKU")
        | Выберите пункт выдачи в каталоге, чтобы заказывать.

      //- Модерация прямо на странице (стол администратора, статус «на модерации»).
      .offer-detail__moderation(v-if="canModerate")
        BaseButton(
          variant="danger",
          :loading="isRejecting(offer.id)",
          @click="confirmReject(offer)"
        )
          template(#icon-left)
            q-icon(name="close", size="16px")
          | Отклонить
        BaseButton(
          variant="primary",
          :loading="isApproving(offer.id)",
          @click="confirmApprove(offer)"
        )
          template(#icon-left)
            q-icon(name="check", size="16px")
          | Одобрить

  .offer-detail__sections(v-if="offer")
    section.offer-detail__section(v-if="offer.description")
      .offer-detail__section-head Описание
      .offer-detail__desc {{ offer.description }}

    section.offer-detail__section(v-if="packageRows.length")
      .offer-detail__section-head Упаковки
      ul.offer-detail__points
        li.offer-detail__point(v-for="row in packageRows", :key="row.key")
          span.offer-detail__point-name {{ row.name }}
          span.offer-detail__point-vol {{ row.price }} · {{ row.stock }}


  AddToCartDialog(
    v-if="!readonly",
    v-model="cartDialogOpen",
    :offer="offer",
    :fee-percent="feePercent"
  )
</template>

<style scoped lang="scss">
.offer-detail {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // Срок и кнопка правки — одной строкой: кнопка относится к сроку.
  &__facts {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--p-line);
    border-bottom: 1px solid var(--p-line);
    margin: var(--p-2, 8px) 0;
  }

  &__facts-head {
    font-size: var(--p-fs-meta, 12px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
    padding: var(--p-3, 12px) 0 0;
  }

  &__warranty {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__noku-hint {
    margin-top: var(--p-2, 8px);
    font-size: var(--p-fs-body-sm);
    color: var(--p-warn);
  }

  // Кнопки модерации на странице предложения (стол администратора).
  &__moderation {
    display: flex;
    gap: var(--p-2, 8px);
    margin-top: var(--p-2, 8px);
  }

  &__back {
    align-self: flex-start;
  }

  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--p-5, 20px);
    align-items: start;
  }

  &__media {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-lg, 12px);
    overflow: hidden;
    background: var(--p-surface-2);
  }

  &__summary {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
  }

  &__title {
    font-size: var(--p-fs-h2);
    font-weight: 600;
    line-height: 1.25;
    color: var(--p-ink-1);
    margin: 0;
  }

  &__supplier {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
  }

  &__price {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-primary-strong);
  }

  &__fee-note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
    margin-top: calc(var(--p-1, 4px) * -1);
  }

  &__sections {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
    max-width: 720px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__section-head {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink-1);
  }

  &__desc {
    color: var(--p-ink-2);
    line-height: 1.55;
    white-space: pre-wrap;
  }

  &__points {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__point {
    display: flex;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) 0;
    border-bottom: 1px solid var(--p-line);
  }

  &__point-name {
    color: var(--p-ink);
  }

  &__point-vol {
    // Цена и остаток — такие же данные, как название тары, а не сноска:
    // на тёмной теме самый бледный оттенок читался с трудом.
    color: var(--p-ink-2);
    flex-shrink: 0;
  }
}

@media (max-width: 900px) {
  .offer-detail__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .offer-detail {
    padding: var(--p-4, 16px);
  }
}
</style>
