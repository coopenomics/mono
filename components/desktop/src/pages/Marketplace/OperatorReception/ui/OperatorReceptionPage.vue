<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Loading } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { Avatar, BaseBadge, BaseButton, BaseCard, BaseDialog, BaseInput, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { AccountBadge, PageHint } from 'src/shared/ui/domain';
import { QrScanner } from 'src/widgets/Marketplace/QrScanner';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { decodeHandoffToken, HandoffTokenKind } from 'src/shared/lib/marketplace';
import {
  listShipmentsByBraname,
  type MarketplaceShipmentView,
} from '../../OperatorIncomingShipments/api';
import {
  createAplReception,
  createExpressReception,
  listAplReceptionsByBraname,
  listExpressPickupsByBraname,
  listSupplierPickupOrders,
  type MarketplaceAplReceptionView,
  type MarketplaceExpressPickupCandidateView,
  type MarketplaceSupplierPickupOrderView,
} from '../api';
import SignAplReceptionChairmanDialog from './SignAplReceptionChairmanDialog.vue';

/**
 * Story 5.3 + 5.4 + Эпик 14: operator-стол приёмки партий.
 *
 * Оператор не вводит идентификатор партии руками — он либо выбирает
 * ожидающую приёмки партию из списка (партии `SUPPLY_PREPARED`, прибывшие
 * на его КУ), либо сканирует QR поставщика (Story 14.3). Все пути ведут в
 * единый диалог коррекции (`openPickupForSupplier`): оператор сверяет факт,
 * правит количество и цену по каждой единице и только потом формирует акт —
 * коррекция доступна ВСЕГДА и без исключений (ревью 2026-05-30). Без формы
 * сверки нельзя: иначе риск «приняли как заказано, хотя привезли меньше».
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
// Состав ожидаемого имущества по поставщику (для карточек «что везут» без
// проваливания): грузим единицы поставщиков, чьи партии/самовывоз ждут приёмки.
const ordersByOfferer = ref<Record<string, MarketplaceSupplierPickupOrderView[]>>({});
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

// Когда сформирована партия — оператор видит дату/время, чтобы прикинуть приёмку
// и заранее подготовить место на складе под скоропорт.
function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function variantLabel(v: string): string {
  return RECEPTION_VARIANT_LABEL[v] ?? v;
}

// Акты, требующие действия (ждут подписи поставщика/председателя). Принятые
// кооперативом (ACCEPTED_TO_COOP) уже на складе — на этом столе не нужны;
// отменённые тоже скрыты. Секция показывается только когда есть что подписать.
const actionableReceptions = computed(() =>
  items.value.filter(
    (r) =>
      r.status === 'PENDING_SUPPLIER_SIGN' ||
      r.status === 'PENDING_CHAIRMAN_RECEPTION_SIGN',
  ),
);

async function load(): Promise<void> {
  if (!braname.value.trim()) return;
  loading.value = true;
  try {
    const [receptions, shipments, express] = await Promise.all([
      listAplReceptionsByBraname({ braname: braname.value.trim() }),
      listShipmentsByBraname({ braname: braname.value.trim() }),
      listExpressPickupsByBraname({ braname: braname.value.trim() }),
    ]);
    items.value = [...receptions].sort(
      (a, b) =>
        (STATUS_SORT_PRIORITY[a.status] ?? 99) - (STATUS_SORT_PRIORITY[b.status] ?? 99),
    );
    expectedShipments.value = shipments;
    expressCandidates.value = express;
    await loadOffererContents();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить акты приёмки');
  } finally {
    loading.value = false;
  }
}

// Состав того, что ждёт приёмки, — для карточек «что везут». Грузим единицы
// имущества по каждому поставщику, чья партия (SUPPLY_PREPARED) или самовывоз
// ждёт на этом КУ. Сетевая нагрузка ограничена числом поставщиков на приёмке.
async function loadOffererContents(): Promise<void> {
  const offerers = new Set<string>();
  for (const s of expectedShipments.value) {
    if (s.status === Zeus.MarketplaceShipmentStatus.SUPPLY_PREPARED) offerers.add(s.offerer_account);
  }
  for (const c of expressCandidates.value) offerers.add(c.offerer_account);
  const map: Record<string, MarketplaceSupplierPickupOrderView[]> = {};
  await Promise.all(
    [...offerers].map(async (account) => {
      try {
        map[account] = await listSupplierPickupOrders({
          braname: braname.value.trim(),
          offerer_account: account,
        });
      } catch {
        map[account] = [];
      }
    }),
  );
  ordersByOfferer.value = map;
}

// Состав партии (задекларированные единицы по shipment_id).
function shipmentContents(s: MarketplaceShipmentView): MarketplaceSupplierPickupOrderView[] {
  return (ordersByOfferer.value[s.offerer_account] ?? []).filter((o) => o.shipment_id === s.id);
}

// Состав самовывоза по факту (добор по акцепту — без партии).
function expressContents(c: MarketplaceExpressPickupCandidateView): MarketplaceSupplierPickupOrderView[] {
  return (ordersByOfferer.value[c.offerer_account] ?? []).filter((o) => o.status === 'ACCEPTED');
}

// Единый список ожидаемых поставок: для ПВЗ нет разницы, сформировал ли поставщик
// партию заранее (SUPPLY_PREPARED) или привезёт самовывозом по факту (добор по
// акцепту) — и то и другое должно дойти до участка. Показываем одним списком;
// способ доставки самовывоза — «Самовывоз», у него нет даты формирования партии.
interface ExpectedDelivery {
  key: string;
  offerer: string;
  supplierName: string;
  deliveryLabel: string;
  amount: string;
  formedAt: string | null;
  ttnNumber: string | null;
  contents: MarketplaceSupplierPickupOrderView[];
}

// ФИО поставщика берём из состава (у партии/самовывоза нет отдельного поля
// имени — оно в заказах как supplier_name); если состав ещё не подгрузился,
// показываем аккаунт.
function supplierNameOf(contents: MarketplaceSupplierPickupOrderView[], fallback: string): string {
  return contents.find((o) => o.supplier_name)?.supplier_name || fallback;
}

const expectedDeliveries = computed<ExpectedDelivery[]>(() => {
  const shipments: ExpectedDelivery[] = pendingShipments.value.map((s) => {
    const contents = shipmentContents(s);
    return {
      key: `ship-${s.id}`,
      offerer: s.offerer_account,
      supplierName: supplierNameOf(contents, s.offerer_account),
      deliveryLabel: SHIPMENT_VARIANT_LABEL[s.delivery_variant] ?? s.delivery_variant,
      amount: s.total_amount,
      formedAt: formatDate(s.created_at),
      ttnNumber: s.ttn_number ?? null,
      contents,
    };
  });
  const express: ExpectedDelivery[] = expressCandidates.value.map((c) => {
    const contents = expressContents(c);
    return {
      key: `express-${c.offerer_account}`,
      offerer: c.offerer_account,
      supplierName: supplierNameOf(contents, c.offerer_account),
      deliveryLabel: 'Самовывоз',
      amount: c.total_amount,
      formedAt: null,
      ttnNumber: null,
      contents,
    };
  });
  return [...shipments, ...express];
});

// QR-код передачи (Эпик 14, агрегирующая приёмка): оператор сканирует
// account-bound код поставщика → грузим ВСЕ единицы имущества этого поставщика,
// ожидающие приёмки на этом КУ (единый базис «акцепт поставщика на КУ», R4),
// и открываем агрегирующую страницу приёмки.
const scanDialogOpen = ref(false);
const pickupDialogOpen = ref(false);
const pickupAccount = ref('');
// Режим приёмки по ТТН экспедитора: id партии из shipment-bound QR. null —
// приёмка по account-коду поставщика (грузим всё имущество + добор).
const pickupShipmentId = ref<string | null>(null);
// Наименование поставщика (ФИО/организация) для заголовка приёмки — из заказов.
const pickupSupplierName = ref('');
const pickupOrders = ref<MarketplaceSupplierPickupOrderView[]>([]);
// Факт по позиции, вводится на приёмке (R5): по умолчанию = заказано; потолок = заказано.
const pickupFact = ref<Record<string, number>>({});
// Фактическая цена за единицу, корректируется оператором на приёмке (B2):
// по умолчанию = цена заказа (привезли хуже → принимаем со скидкой).
const pickupPrice = ref<Record<string, string>>({});
// Выбранные к приёмке единицы (R7). Снятая галка = не принимаем эту единицу;
// если по партии не выбрано ни одной единицы — партия не создаётся и ждёт
// (кейс экспедитора: одна партия здесь, другая ещё в пути).
const selectedOrderIds = ref<Set<string>>(new Set());
// Принимать ли добор по акцепту (ACCEPTED-заказы без партии) одним самовывозом.
const takeAddon = ref(true);

// Плоский список единиц имущества двумя секциями (R7a): задекларированные в
// партии (по ТТН) — статус SUPPLY_PREPARED; добор по акцепту — статус ACCEPTED.
const declaredOrders = computed(() =>
  pickupOrders.value.filter((o) => o.status === 'SUPPLY_PREPARED'),
);
const addonOrders = computed(() =>
  pickupOrders.value.filter((o) => o.status === 'ACCEPTED'),
);

// Заголовок диалога приёмки: режим ТТН экспедитора vs приёмка по коду поставщика.
const pickupDialogTitle = computed(() =>
  pickupShipmentId.value ? 'Приёмка партии по ТТН экспедитора' : 'Приёмка имущества поставщика',
);

// Партия (shipment) задекларированной единицы — по прямой связи order.shipment_id
// (обязательно при нескольких частичных партиях на одном КУ).
function shipmentForOrder(o: MarketplaceSupplierPickupOrderView): MarketplaceShipmentView | null {
  return pendingShipments.value.find((s) => s.id === o.shipment_id) ?? null;
}

function isSelected(id: string): boolean {
  return selectedOrderIds.value.has(id);
}
function toggleOrder(id: string, value: boolean): void {
  const next = new Set(selectedOrderIds.value);
  if (value) next.add(id);
  else next.delete(id);
  selectedOrderIds.value = next;
}

// Потолок факта = заказано (акцепт): сверх акцепта не принимаем (R5).
function clampFact(orderId: string, ordered: number): void {
  const v = Number(pickupFact.value[orderId]);
  if (!Number.isFinite(v) || v < 0) pickupFact.value[orderId] = 0;
  else if (v > ordered) pickupFact.value[orderId] = ordered;
  else pickupFact.value[orderId] = Math.trunc(v);
}

// Сколько актов будет создано: по одному на каждую партию с ≥1 выбранной
// единицей + один на добор (если принимаем и он есть).
const plannedReceptionsCount = computed(() => {
  const shipments = new Set<string>();
  for (const o of declaredOrders.value) {
    if (o.shipment_id && selectedOrderIds.value.has(o.id)) shipments.add(o.shipment_id);
  }
  return shipments.size + (takeAddon.value && addonOrders.value.length ? 1 : 0);
});

// Единая точка открытия диалога приёмки по поставщику (QR-скан и «самовывоз по
// факту» ведут сюда): грузим все единицы имущества поставщика на этом КУ и
// открываем форму коррекции количества/цены.
async function openPickupForSupplier(account: string): Promise<void> {
  Loading.show({ message: 'Загружаю имущество поставщика…' });
  try {
    const orders = await listSupplierPickupOrders({
      braname: braname.value.trim(),
      offerer_account: account,
    });
    if (!orders.length) {
      FailAlert(
        new Error(`У поставщика ${account} нет имущества, ожидающего приёмки на этом пункте.`),
      );
      return;
    }
    pickupShipmentId.value = null;
    pickupAccount.value = account;
    pickupSupplierName.value = orders[0]?.supplier_name ?? '';
    pickupOrders.value = orders;
    pickupFact.value = Object.fromEntries(orders.map((o) => [o.id, o.quantity]));
    pickupPrice.value = Object.fromEntries(orders.map((o) => [o.id, o.price_per_unit]));
    selectedOrderIds.value = new Set(orders.map((o) => o.id));
    takeAddon.value = true;
    pickupDialogOpen.value = true;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить имущество поставщика');
  } finally {
    Loading.hide();
  }
}

// Приёмка по ТТН экспедитора (shipment-bound QR): грузим состав СТРОГО одной
// партии. Экспедитор не пайщик — добора по акцепту нет, принимаем только то,
// что в накладной (R: «ничего больше там отображаться не должно»).
async function openPickupForShipment(shipment_id: string): Promise<void> {
  const shipment = pendingShipments.value.find((s) => s.id === shipment_id);
  if (!shipment) {
    FailAlert(
      new Error(
        'Партия по этой ТТН не найдена среди ожидающих приёмки на вашем КУ ' +
          '(возможно, уже принята или направлена на другой участок).',
      ),
    );
    return;
  }
  Loading.show({ message: 'Загружаю состав партии…' });
  try {
    const all = await listSupplierPickupOrders({
      braname: braname.value.trim(),
      offerer_account: shipment.offerer_account,
    });
    const orders = all.filter((o) => o.shipment_id === shipment_id);
    if (!orders.length) {
      FailAlert(new Error('В партии нет позиций, ожидающих приёмки (возможно, уже принята).'));
      return;
    }
    pickupShipmentId.value = shipment_id;
    pickupAccount.value = shipment.offerer_account;
    pickupSupplierName.value = orders[0]?.supplier_name ?? '';
    pickupOrders.value = orders;
    pickupFact.value = Object.fromEntries(orders.map((o) => [o.id, o.quantity]));
    pickupPrice.value = Object.fromEntries(orders.map((o) => [o.id, o.price_per_unit]));
    selectedOrderIds.value = new Set(orders.map((o) => o.id));
    takeAddon.value = false;
    pickupDialogOpen.value = true;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить состав партии');
  } finally {
    Loading.hide();
  }
}

async function onQrScanned(code: string): Promise<void> {
  scanDialogOpen.value = false;
  const token = decodeHandoffToken(code);
  if (!token) {
    FailAlert(
      new Error('Нераспознанный код. Отсканируйте «Мой код для ПВЗ» поставщика или QR с ТТН экспедитора.'),
    );
    return;
  }
  if (token.coopname && token.coopname !== coopname.value) {
    FailAlert(new Error('Код выписан для другого кооператива.'));
    return;
  }
  if (token.kind === HandoffTokenKind.Shipment && token.shipment_id) {
    await openPickupForShipment(token.shipment_id);
    return;
  }
  if (token.kind === HandoffTokenKind.Pickup) {
    await openPickupForSupplier(token.account);
    return;
  }
  FailAlert(new Error('Этот код не предназначен для приёмки на ПВЗ.'));
}

// Сформировать акты приёмки по выбранному: на каждую партию с выбранными
// единицами — createAplReception с фактическим кол-вом per-Order (R5; невыбранные
// единицы партии = 0, потолок = заказано). Не выбранные целиком партии остаются
// ждать. Добор по акцепту — express-самовывозом.
async function acceptPickup(): Promise<void> {
  pickupDialogOpen.value = false;
  Loading.show({ message: 'Формирую акты приёмки…' });
  let created = 0;
  try {
    // Задекларированные единицы → по партиям (shipment_id); партию без выбранных
    // единиц пропускаем (она ждёт). Связь по shipment_id обязательна при
    // нескольких частичных партиях на одном КУ — группировка по cycle_id брала бы
    // не ту партию.
    const byShipment = new Map<string, MarketplaceSupplierPickupOrderView[]>();
    for (const o of declaredOrders.value) {
      if (!o.shipment_id) continue;
      const arr = byShipment.get(o.shipment_id) ?? [];
      arr.push(o);
      byShipment.set(o.shipment_id, arr);
    }
    for (const [shipment_id, orders] of byShipment) {
      const anySelected = orders.some((o) => selectedOrderIds.value.has(o.id));
      if (!anySelected) continue;
      await createAplReception({
        shipment_id,
        fact_quantity_per_order: orders.map((o) => ({
          order_id: o.id,
          fact_quantity: selectedOrderIds.value.has(o.id) ? pickupFact.value[o.id] ?? o.quantity : 0,
          fact_unit_price: pickupPrice.value[o.id] ?? o.price_per_unit,
        })),
      });
      created += 1;
    }
    // Добор по акцепту — самовывозом (принимается весь добор поставщика на КУ)
    // с фактическим количеством и ценой по каждой единице (B2/R5).
    if (takeAddon.value && addonOrders.value.length) {
      const result = await createExpressReception({
        offerer_account: pickupAccount.value,
        braname: braname.value.trim(),
        fact_quantity_per_order: addonOrders.value.map((o) => ({
          order_id: o.id,
          fact_quantity: pickupFact.value[o.id] ?? o.quantity,
          fact_unit_price: pickupPrice.value[o.id] ?? o.price_per_unit,
        })),
      });
      created += result.apl_receptions.length;
    }
    SuccessAlert(created > 1 ? `Создано актов приёмки: ${created}` : 'Акт приёмки создан');
  } catch (e) {
    FailAlert(e, 'Не удалось сформировать часть актов — проверьте ленту и повторите');
  } finally {
    Loading.hide();
    pickupOrders.value = [];
    await load();
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
q-page.reception(role='region', aria-label='Ожидаемые поставки и приёмка')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Приёмка партий доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    //- Действие страницы — в шапку (канон Teleport): сканирование QR-кода
    //- передачи (код поставщика / ТТН экспедитора) всегда в одном месте сверху.
    Teleport(to="#header-actions-host", defer)
      BaseButton(variant='primary', size='sm', @click='scanDialogOpen = true')
        template(#icon-left)
          q-icon(name='qr_code_scanner', size='16px')
        | Сканировать QR

    PageHint(storage-key='mp:operator-reception:banner-dismissed')
      | Чтобы принять поставку, отсканируйте QR-код поставщика — кнопка
      | «Сканировать QR» в верхней панели. Код подтверждает личность поставщика
      | и состав партии.

    //- Ожидаемые поставки — единый список карточек «что/когда/кому везут».
    //- Раздел уже назван в шапке стола. Запуск приёмки — только скан QR/ввод
    //- кода (кнопка в шапке).
    EmptyState(
      v-if='!expectedDeliveries.length',
      title='Поставок пока нет',
      body='Поставки появятся здесь, как только поставщики направят их на ваш пункт.'
    )
      template(#icon)
        q-icon(name='local_shipping', size='48px')

    .reception__grid(v-else)
      BaseCard.reception__card(v-for='d in expectedDeliveries', :key='d.key')
        template(#head)
          .reception__card-who
            Avatar(:name='d.supplierName', size='md', tone='primary')
            .reception__card-ident
              span.reception__card-name {{ d.supplierName }}
              AccountBadge(:account-name='d.offerer', size='sm')
        template(#actions)
          BaseBadge(variant='neutral') {{ d.deliveryLabel }}

        .reception__card-when(v-if='d.formedAt') Сформирована {{ d.formedAt }}
        .reception__card-when(v-else) Привезёт по факту
        .reception__card-ttn(v-if='d.ttnNumber') ТТН {{ d.ttnNumber }}
        ul.reception__card-items(v-if='d.contents.length')
          li.reception__card-item(v-for='o in d.contents', :key='o.id')
            .reception__card-prod-wrap
              span.reception__card-prod {{ o.product_name || 'Товар по предложению' }}
              span.reception__card-to(v-if='o.orderer_name || o.orderer_account') для {{ o.orderer_name || o.orderer_account }}
            span.reception__card-qty {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}
        .reception__card-summary
          span.reception__card-summary-label Сумма поставки
          span.reception__card-amount {{ formatAsset2Digits(d.amount) }} ₽

    //- Акты приёмки, требующие действия (ждут подписи поставщика/председателя).
    //- Принятые кооперативом уже на складе и здесь не показываются.
    section.reception__acts(v-if='actionableReceptions.length', aria-label='Акты, требующие подписи')
      header.reception__acts-head
        h2.reception__acts-title Требуют подписи
        BaseBadge(variant='warn') {{ actionableReceptions.length }}

      .reception__grid
        BaseCard.reception__card(v-for='r in actionableReceptions', :key='r.id')
          template(#head)
            .reception__card-who
              Avatar(:name='r.offerer_name || r.offerer_account', size='md', tone='primary')
              .reception__card-ident
                span.reception__card-name {{ r.offerer_name || r.offerer_account }}
                AccountBadge(:account-name='r.offerer_account', size='sm')
          template(#actions)
            BaseBadge(:variant='statusVariant(r.status)') {{ statusLabel(r.status) }}

          .reception__card-when {{ variantLabel(r.variant) }}
          ul.reception__card-items(v-if='r.fact_quantity_per_order.length')
            li.reception__card-item(v-for='(o, i) in r.fact_quantity_per_order', :key='i')
              span.reception__card-prod {{ o.product_name || 'Товар по предложению' }}
              span.reception__card-qty {{ o.fact_quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}
          .reception__card-summary
            span.reception__card-summary-label Сумма
            span.reception__card-amount {{ formatAsset2Digits(r.total_amount) }} ₽

          .reception__card-foot(v-if='r.status === "PENDING_CHAIRMAN_RECEPTION_SIGN"')
            BaseButton(variant='primary', @click='signChairman(r)')
              template(#icon-left)
                q-icon(name='draw', size='18px')
              | Подписать председателем

  SignAplReceptionChairmanDialog(
    v-model='signDialogOpen',
    :reception='signTarget',
    @signed='onChairmanSigned'
  )

  BaseDialog(v-model='scanDialogOpen', title='Сканирование QR партии', size='sm')
    QrScanner(@scanned='onQrScanned')

  //- Эпик 14: агрегирующая приёмка по account-bound коду. Плоский список единиц
  //- имущества (R7a): сверху — задекларированные в партии (по ТТН), ниже
  //- разделитель и добор по акцепту. Факт правится на месте, потолок = заказано (R5).
  BaseDialog(v-model='pickupDialogOpen', :title='pickupDialogTitle', maximized)
    .reception__pickup
      .reception__pickup-account {{ pickupSupplierName || pickupAccount }}
      .reception__pickup-hint
        | По каждой единице скорректируйте фактическое количество (не выше
        | заказанного) и цену. Снимите галку с задекларированной единицы, чтобы
        | не принимать её; партия без выбранных единиц не создаётся и ждёт.

      template(v-if='declaredOrders.length')
        .reception__pickup-section Задекларировано в партии (по ТТН)
        .reception__unit(v-for='o in declaredOrders', :key='o.id', :class='{ "reception__unit--off": !isSelected(o.id) }')
          q-checkbox(
            :model-value='isSelected(o.id)',
            dense,
            @update:model-value='(v) => toggleOrder(o.id, v)'
          )
          .reception__unit-info
            .reception__unit-title {{ o.product_name || 'Товар по предложению' }}
            .reception__unit-meta
              | Заказано {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}
              template(v-if='shipmentForOrder(o)?.ttn_number')  · ТТН {{ shipmentForOrder(o)?.ttn_number }}
          .reception__unit-fact
            BaseInput(
              v-model.number='pickupFact[o.id]',
              type='number',
              dense,
              :disable='!isSelected(o.id)',
              :suffix='marketplaceUnitShort(o.unit_of_measure)',
              @blur='clampFact(o.id, o.quantity)'
            )
            BaseInput(
              v-model='pickupPrice[o.id]',
              type='number',
              dense,
              :disable='!isSelected(o.id)',
              label='Цена/ед.'
            )

      template(v-if='addonOrders.length')
        .reception__pickup-divider
        .reception__pickup-section-row
          .reception__pickup-section Добор по акцепту (вне партии)
          q-checkbox(v-model='takeAddon', dense, label='Принять добор')
        .reception__unit.reception__unit--addon(v-for='o in addonOrders', :key='o.id', :class='{ "reception__unit--off": !takeAddon }')
          q-icon(name='add_circle_outline', size='16px')
          .reception__unit-info
            .reception__unit-title {{ o.product_name || 'Товар по предложению' }}
            .reception__unit-meta Акцептовано {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}
          .reception__unit-fact
            BaseInput(
              v-model.number='pickupFact[o.id]',
              type='number',
              dense,
              :disable='!takeAddon',
              :suffix='marketplaceUnitShort(o.unit_of_measure)',
              @blur='clampFact(o.id, o.quantity)'
            )
            BaseInput(
              v-model='pickupPrice[o.id]',
              type='number',
              dense,
              :disable='!takeAddon',
              label='Цена/ед.'
            )

      .reception__pickup-actions
        BaseButton(variant='ghost', size='sm', @click='pickupDialogOpen = false') Отмена
        BaseButton(variant='primary', size='sm', :disabled='!plannedReceptionsCount', @click='acceptPickup')
          template(#icon-left)
            q-icon(name='how_to_reg', size='16px')
          | Сформировать акты ({{ plannedReceptionsCount }})
</template>

<style scoped lang="scss">
.reception {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // ── Секция «Требуют подписи» ──
  &__acts {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__acts-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__acts-title {
    margin: 0;
    font-size: var(--p-fs-h2, 18px);
    font-weight: 600;
    letter-spacing: var(--p-ls-h2);
    color: var(--p-ink);
  }

  // ── Сетка карточек (ожидаемые поставки + акты на подпись) ──
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

  &__card-when {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__card-summary {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }

  &__card-summary-label {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__card-amount {
    flex: 0 0 auto;
    font-family: var(--p-mono);
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__card-ttn {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
  }

  &__card-items {
    margin: 0;
    padding: var(--p-3, 12px);
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    background: var(--p-surface-2);
    border-radius: var(--p-r-sm, 8px);
  }

  &__card-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__card-prod-wrap {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  &__card-prod {
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__card-to {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
  }

  &__card-qty {
    flex: 0 0 auto;
    color: var(--p-ink);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  &__card-foot {
    display: flex;
    justify-content: flex-end;
  }

  &__pickup {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__pickup-account {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    font-family: var(--font-mono);
  }

  &__pickup-hint {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    margin-bottom: var(--p-2, 8px);
  }

  &__pickup-section {
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__pickup-section-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__pickup-divider {
    height: 1px;
    background: var(--p-line);
    margin: var(--p-3, 12px) 0 var(--p-1, 4px);
  }

  &__pickup-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    margin-top: var(--p-3, 12px);
  }

  &__unit {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);

    &--off {
      opacity: 0.5;
    }
  }

  &__unit-info {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__unit-title {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__unit-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__unit-fact {
    flex: 0 0 auto;
    width: 120px;
  }
}

@media (max-width: 768px) {
  .reception {
    padding: var(--p-4, 16px);

    &__grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
