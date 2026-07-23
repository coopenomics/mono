<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { Avatar, BaseBadge, BaseButton, BaseDialog, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { AccountBadge, PageHint } from 'src/shared/ui/domain';
import { ScannerDialog } from 'src/widgets/Marketplace/ScannerDialog';
import { StockRestockPanel } from 'src/widgets/Marketplace/StockRestockPanel';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import {
  decodeHandoffToken,
  HandoffTokenKind,
  handoffStageRoute,
  HANDOFF_QUERY,
  useMarketplaceRealtime,
} from 'src/shared/lib/marketplace';
import {
  listIssuancesByBraname,
  type MarketplaceOrderIssuanceView,
} from '../api';
import IssueActOpenDialog from './IssueActOpenDialog.vue';

/**
 * Operator-стол выдачи имущества пайщику, СГРУППИРОВАННЫЙ ПО ЗАКАЗЧИКУ: одна
 * карточка = один получатель (ФИО + что ему причитается). Оператор сканирует
 * код / находит заказчика и сразу видит «кому что отдать» — список единиц, а не
 * россыпь сотен строк.
 *
 * Внутри карточки заказы разнесены по стадии выдачи:
 *   - «К выдаче» (ACCEPTED_TO_COOP) — оператор открывает выдачу подписью
 *     председателя (IssueActOpenDialog, full-screen);
 *   - «Ждут получения» (READY_TO_RECEIVE) — выдача открыта, ждём, когда сам
 *     заказчик подтвердит получение в своём кабинете.
 */

const route = useRoute();
const router = useRouter();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const items = ref<MarketplaceOrderIssuanceView[]>([]);
const loading = ref(false);

const openDialog = ref(false);
// Открываем выдачу СРАЗУ по всем позициям пайщика «к выдаче» — одна операция
// оператора, диалог разносит их по актам циклом.
const selectedOrders = ref<MarketplaceOrderIssuanceView[]>([]);

// Статусы заказа, релевантные выдаче (ожидают открытия или финальной подписи).
const ISSUANCE_STATUSES = ['ACCEPTED_TO_COOP', 'READY_TO_RECEIVE'];

// Строка выдачи: одинаковое имущество (один товар, одна цена за единицу, одна
// стадия) слито в одну строку с просуммированными кол-вом и стоимостью. Разная
// цена за единицу (поставщик менял стоимость) → разные строки.
interface IssuanceLine {
  key: string;
  name: string;
  /** К выдаче по факту: склад (до открытия) либо акт (после открытия). */
  quantity: number;
  /** Заказано пайщиком; больше quantity — недопоставка, показываем рядом. */
  orderedQuantity: number;
  unit: MarketplaceOrderIssuanceView['unit_of_measure'];
  orderUnitSize: MarketplaceOrderIssuanceView['order_unit_size'];
  total: string;
  status: string;
}

/**
 * Количество и стоимость строки — ПО ФАКТУ, не по заказу (инцидент 2026-06-09:
 * заказ 10, принято 5, карточка показывала 10 и подпись уходила на 10):
 *  - «к выдаче» (ACCEPTED_TO_COOP) — потолок по принятому на склад, стоимость
 *    по цене заказа;
 *  - «ждут получения» (READY_TO_RECEIVE) — из акта выдачи (issuance_fact).
 */
function factOf(o: MarketplaceOrderIssuanceView): { qty: number; ordered: number; total: number } {
  const ordered = Number.parseFloat(String(o.quantity ?? '0')) || 0;
  const orderedTotal = Number.parseFloat(String(o.total_cost ?? '0')) || 0;
  if (o.status === 'READY_TO_RECEIVE') {
    const qty = o.issuance_fact?.actual_quantity ?? ordered;
    const total = Number.parseFloat(String(o.issuance_fact?.fact_cost ?? orderedTotal)) || 0;
    return { qty, ordered, total };
  }
  const qty = Math.min(ordered, o.warehouse_quantity ?? ordered);
  const unitPrice = ordered ? orderedTotal / ordered : 0;
  return { qty, ordered, total: qty * unitPrice };
}

function mergeLines(orders: MarketplaceOrderIssuanceView[]): IssuanceLine[] {
  const map = new Map<string, IssuanceLine>();
  for (const o of orders) {
    const name = o.product_name || 'Товар по предложению';
    const { qty, ordered, total } = factOf(o);
    const unitPrice = ordered
      ? (Number.parseFloat(String(o.total_cost ?? '0')) || 0) / ordered
      : total;
    // Цена за единицу в ключе — разная цена не сливается в одну строку.
    const key = `${name}__${o.unit_of_measure ?? ''}__${o.status}__${unitPrice.toFixed(4)}`;
    const ex = map.get(key);
    if (ex) {
      ex.quantity += qty;
      ex.orderedQuantity += ordered;
      ex.total = (Number.parseFloat(ex.total) + total).toFixed(4);
    } else {
      map.set(key, {
        key,
        name,
        quantity: qty,
        orderedQuantity: ordered,
        unit: o.unit_of_measure,
        orderUnitSize: o.order_unit_size,
        total: total.toFixed(4),
        status: o.status,
      });
    }
  }
  // Гасим float-шум суммирования количеств (0.1+0.2 и т.п.).
  for (const l of map.values()) {
    l.quantity = Math.round(l.quantity * 1000) / 1000;
    l.orderedQuantity = Math.round(l.orderedQuantity * 1000) / 1000;
  }
  return [...map.values()];
}

// Группировка ленты выдачи по заказчику: карточка получателя со списком единиц,
// разнесённым по стадии (к выдаче / ждут получения), одинаковое — слито.
interface IssuanceGroup {
  account: string;
  name: string;
  toIssue: MarketplaceOrderIssuanceView[];
  toIssueLines: IssuanceLine[];
  awaitingLines: IssuanceLine[];
  total: string;
  count: number;
}

const groups = computed<IssuanceGroup[]>(() => {
  const map = new Map<string, MarketplaceOrderIssuanceView[]>();
  for (const o of items.value) {
    const arr = map.get(o.orderer_account) ?? [];
    arr.push(o);
    map.set(o.orderer_account, arr);
  }
  const out: IssuanceGroup[] = [];
  for (const [account, orders] of map) {
    const named = orders.find((o) => o.orderer_name);
    const toIssue = orders.filter((o) => o.status === 'ACCEPTED_TO_COOP');
    const toIssueLines = mergeLines(toIssue);
    const awaitingLines = mergeLines(orders.filter((o) => o.status === 'READY_TO_RECEIVE'));
    out.push({
      account,
      name: named?.orderer_name || account,
      toIssue,
      toIssueLines,
      awaitingLines,
      // Итог — по факту строк (склад/акт), не по заказанному: при недопоставке
      // карточка не должна обещать сумму, которой нет на складе.
      total: [...toIssueLines, ...awaitingLines]
        .reduce((a, l) => a + Number.parseFloat(l.total), 0)
        .toFixed(4),
      count: orders.length,
    });
  }
  // Заказчики, кому есть что выдать прямо сейчас (есть «к выдаче») — наверх.
  return out.sort((a, b) => (b.toIssue.length ? 1 : 0) - (a.toIssue.length ? 1 : 0));
});

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    items.value = await listIssuancesByBraname({ delivery_braname: braname.value.trim() });
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить ленту выдач');
  } finally {
    loading.value = false;
  }
}

function startOpen(orders: MarketplaceOrderIssuanceView[]): void {
  const toIssue = orders.filter((o) => o.status === 'ACCEPTED_TO_COOP');
  if (!toIssue.length) return;
  selectedOrders.value = toIssue;
  openDialog.value = true;
}

// QR-код получения: оператор сканирует account-bound код заказчика → резолвим
// аккаунт против ленты своего КУ и показываем РАЗОМ все его заказы на выдачу.
const scanDialogOpen = ref(false);
const pickupDialogOpen = ref(false);
const pickupAccount = ref('');
const pickupOrders = computed(() =>
  items.value.filter(
    (o) => o.orderer_account === pickupAccount.value && ISSUANCE_STATUSES.includes(o.status),
  ),
);
// Те же позиции, но слитые по одинаковому имуществу — для отображения в диалоге.
const pickupLines = computed(() => mergeLines(pickupOrders.value));
// Сколько позиций пайщика реально можно открыть к выдаче прямо сейчас.
const pickupToIssueCount = computed(
  () => pickupOrders.value.filter((o) => o.status === 'ACCEPTED_TO_COOP').length,
);

// Из QR-резолва: открыть выдачу разом по всем готовым позициям пайщика.
function startPickupIssuance(): void {
  pickupDialogOpen.value = false;
  startOpen(pickupOrders.value);
}

function onQrScanned(code: string): void {
  scanDialogOpen.value = false;
  const token = decodeHandoffToken(code);
  if (!token) {
    FailAlert(
      new Error('Нераспознанный код. Отсканируйте код получения заказчика, код поставщика или QR с ТТН.'),
    );
    return;
  }
  if (token.coopname && token.coopname !== coopname.value) {
    FailAlert(new Error('Код выписан для другого кооператива.'));
    return;
  }
  // Код поставщика/ТТН на столе выдачи — НЕ ошибка: сканер универсален, оператору
  // не нужно знать, кто пришёл. Ведём его на «Ожидаемые поставки» с тем же кодом —
  // целевой стол сам откроет приёмку.
  if (token.kind !== HandoffTokenKind.Receive) {
    void router.push({
      name: handoffStageRoute('reception'),
      params: { coopname: coopname.value },
      query: { [HANDOFF_QUERY]: code },
    });
    return;
  }
  // Заказы не обязательны: пайщик мог «просто зайти» — оператор предложит
  // ему имущество со склада кооператива (докладка, requirement 76).
  pickupAccount.value = token.account;
  void resolvePickup();
}

/**
 * Резолв отсканированного кода получения: есть позиции «к выдаче» — сразу
 * открываем полную выдачу (промежуточное окно «Открыть выдачу» — лишний клик);
 * нечего открывать — показываем резолв-окно с докладкой со склада (req. 76).
 */
async function resolvePickup(): Promise<void> {
  // Код мог прийти с универсального сканера сразу после навигации — лента
  // могла не успеть загрузиться, без неё резолв «у пайщика ничего нет».
  if (!items.value.length && !loading.value) await load();
  if (pickupToIssueCount.value > 0) {
    startOpen(pickupOrders.value);
    return;
  }
  pickupDialogOpen.value = true;
}

// Код передачи мог прийти с универсального сканера (или со стола приёмки) через
// query `handoff`: подхватываем, запускаем выдачу и стираем параметр, чтобы
// повторный показ того же кода снова сработал и обновление не зациклило.
function consumeHandoffQuery(): void {
  const code = route.query[HANDOFF_QUERY];
  if (typeof code !== 'string' || !code) return;
  const rest = { ...route.query };
  delete rest[HANDOFF_QUERY];
  void router.replace({ query: rest });
  onQrScanned(code);
}

function onOpened(): void {
  void load();
}

watch(braname, () => void load());

// Повторный заход с новым кодом в query (универсальный сканер уже на этом столе).
watch(() => route.query[HANDOFF_QUERY], () => consumeHandoffQuery());

// Realtime: заказчик подтвердил получение в своём кабинете (READY_TO_RECEIVE →
// RECEIVED) — карточка уходит со стола сама; оператор у стойки видит подпись
// сразу и отпускает заказчика. Сигнал — служебный канал персонала КУ.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  { MarketplaceOrderStatusChangedEvent: () => reloadLive() },
  { onResync: () => reloadLive() }
);

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  await load();
  consumeHandoffQuery();
});
</script>

<template lang="pug">
q-page.issuance(role='region', aria-label='Выдача заказов')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Выдача заказов доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-issuance:banner-dismissed')
      | Заказы сгруппированы по заказчикам. Карточки показывают, что кому
      | причитается. Открыть выдачу можно только отсканировав QR-код получателя
      | («Сканировать QR заказа») — так подтверждаем, что пришёл именно он.
      | Дальше заказчик подтвердит получение сам в своём кабинете.

    //- Действие страницы — в шапку (канон Teleport), как на столе приёмки:
    //- сканирование кода получения заказчика всегда в одном месте сверху.
    Teleport(to="#header-actions-host", defer)
      BaseButton(variant='primary', size='sm', @click='scanDialogOpen = true')
        template(#icon-left)
          q-icon(name='qr_code_scanner', size='16px')
        | Сканировать QR заказа

    //- Канон загрузки: скелетон, а не спиннер.
    CardListSkeleton(v-if='loading && !items.length', :count='3')

    .issuance__grid(v-else-if='groups.length')
      BaseCard.issuance__card(v-for='g in groups', :key='g.account')
        template(#head)
          .issuance__card-who
            Avatar(:name='g.name', size='md', tone='primary')
            .issuance__card-ident
              span.issuance__card-name {{ g.name }}
              AccountBadge(:account-name='g.account', size='sm')
        //- К выдаче — открыть выдачу можно ТОЛЬКО отсканировав QR-код заказчика
        //- (кнопка скана в тулбаре). Здесь — только что причитается пайщику.
        .issuance__section(v-if='g.toIssueLines.length')
          .issuance__section-head К выдаче
          .issuance__line(v-for='line in g.toIssueLines', :key='line.key')
            .issuance__line-info
              .issuance__line-name {{ line.name }}
              .issuance__line-meta
                | {{ line.quantity }} {{ marketplaceOrderUnitLabel(line.unit, line.orderUnitSize) }} · {{ formatAsset2Digits(line.total) }} ₽
                span.issuance__line-shortage(v-if='line.quantity < line.orderedQuantity')
                  |  · заказано {{ line.orderedQuantity }} {{ marketplaceOrderUnitLabel(line.unit, line.orderUnitSize) }}
            BaseBadge(v-if='line.quantity < line.orderedQuantity', variant='warn') Недопоставка

        //- Ждут получения — выдача открыта, ждём подпись заказчика.
        .issuance__section(v-if='g.awaitingLines.length')
          .issuance__section-head Ждут получения заказчиком
          .issuance__line(v-for='line in g.awaitingLines', :key='line.key')
            .issuance__line-info
              .issuance__line-name {{ line.name }}
              .issuance__line-meta
                | {{ line.quantity }} {{ marketplaceOrderUnitLabel(line.unit, line.orderUnitSize) }} · {{ formatAsset2Digits(line.total) }} ₽
                span.issuance__line-shortage(v-if='line.quantity < line.orderedQuantity')
                  |  · заказано {{ line.orderedQuantity }} {{ marketplaceOrderUnitLabel(line.unit, line.orderUnitSize) }}
            BaseBadge(:variant='orderStatusDisplay(line.status).variant') {{ orderStatusDisplay(line.status).label }}

        //- Итог по заказчику — снизу, под выдачей (не в шапке карточки).
        .issuance__card-foot
          BaseBadge(variant='neutral') Позиций: {{ g.count }}
          span.issuance__card-total {{ formatAsset2Digits(g.total) }} ₽

    EmptyState(
      v-else,
      title='Заказов на выдачу нет',
      body='Заказы, принятые кооперативом на ваш участок, появятся здесь для выдачи пайщикам.'
    )
      template(#icon)
        q-icon(name='inventory', size='48px')

  IssueActOpenDialog(
    v-model='openDialog',
    :orders='selectedOrders',
    @opened='onOpened'
  )

  ScannerDialog(v-model='scanDialogOpen', title='Сканирование QR заказа', @scanned='onQrScanned')

  //- Резолв кода получения, когда открывать нечего: позиции ждут подтверждения
  //- пайщика либо заказов нет — оператор может предложить докладку со склада.
  //- При готовых позициях это окно НЕ показывается: скан открывает выдачу сразу.
  BaseDialog(v-model='pickupDialogOpen', title='Выдача заказчику', size='sm')
    .issuance__resolve
      .issuance__resolve-account {{ pickupAccount }}
      .issuance__resolve-hint(v-if='pickupOrders.length') Готовы к выдаче на этом пункте:
      .issuance__resolve-empty(v-else) Заказов на выдачу нет — можно предложить имущество со склада.
      .issuance__resolve-item(v-for='line in pickupLines', :key='line.key')
        .issuance__resolve-item-info
          .issuance__resolve-item-title {{ line.name }}
          .issuance__resolve-item-meta
            | {{ line.quantity }} {{ marketplaceOrderUnitLabel(line.unit, line.orderUnitSize) }} · {{ formatAsset2Digits(line.total) }} ₽
            span.issuance__line-shortage(v-if='line.quantity < line.orderedQuantity')
              |  · заказано {{ line.orderedQuantity }} {{ marketplaceOrderUnitLabel(line.unit, line.orderUnitSize) }}
        BaseBadge(:variant='orderStatusDisplay(line.status).variant') {{ orderStatusDisplay(line.status).label }}

      //- Открываем выдачу разом по всем готовым позициям пайщика — одна операция.
      BaseButton(
        v-if='pickupToIssueCount',
        variant='primary',
        @click='startPickupIssuance'
      )
        template(#icon-left)
          q-icon(name='draw', size='16px')
        | Открыть выдачу{{ pickupToIssueCount > 1 ? ` (${pickupToIssueCount})` : '' }}

      //- Докладка со склада кооператива (requirement 76): накидка опубликованного
      //- остатка этого КУ, отправка предложения пайщику, live-статус, отзыв.
      StockRestockPanel(
        v-if='pickupAccount',
        :braname='braname',
        :member-account='pickupAccount'
      )
</template>

<style scoped lang="scss">
.issuance {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
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

  &__card-who {
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

  // Итог по заказчику снизу карточки, под списком выдачи.
  &__card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-2, 8px);
    margin-top: auto;
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }

  &__card-total {
    font-family: var(--p-mono);
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__section-head {
    font-size: var(--p-fs-meta, 12px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
  }

  &__line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    background: var(--p-surface-2);
    border-radius: var(--p-r-sm, 8px);
  }

  &__line-info {
    min-width: 0;
  }

  &__line-name {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__line-meta {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  // Недопоставка: заказанное количество рядом с фактом, приглушённо-предупреждающе.
  &__line-shortage {
    color: var(--p-warn);
  }

  &__resolve {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__resolve-account {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    font-family: var(--font-mono);
  }

  &__resolve-hint,
  &__resolve-empty {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__resolve-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }

  &__resolve-item-info {
    min-width: 0;
  }

  &__resolve-item-title {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__resolve-item-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__await {
    display: inline-flex;
    align-items: center;
    gap: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    white-space: nowrap;
  }
}

@media (max-width: 768px) {
  .issuance {
    padding: var(--p-4, 16px);

    &__grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
