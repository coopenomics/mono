<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { Avatar, BaseBadge, BaseButton, BaseCard, BaseDialog, BaseInput, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { AccountBadge, PageHint } from 'src/shared/ui/domain';
import { ScannerDialog } from 'src/widgets/Marketplace/ScannerDialog';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates';
import {
  decodeHandoffToken,
  HandoffTokenKind,
  groupAplReceptions,
  handoffStageRoute,
  HANDOFF_QUERY,
  useMarketplaceRealtime,
  type ReceptionGroup,
} from 'src/shared/lib/marketplace';
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
const router = useRouter();
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
// и заранее подготовить место на складе под скоропорт. Время с бэкенда в UTC —
// показываем в локальном поясе оператора (env.TIMEZONE), не в UTC/поясе браузера.
function formatDate(value: unknown): string {
  const out = formatDateToLocalTimezone(value, 'DD.MM HH:mm');
  return out || '—';
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

// Сводные поставки на подпись: группируем акты по поставщику + КУ + способу
// доставки + статусу. Председатель подписывает доставку целиком (одна кнопка),
// под капотом — по акту на каждую партию.
const receptionGroups = computed(() =>
  groupAplReceptions(actionableReceptions.value, { byOfferer: true }),
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

// Заказ доступен к приёмке на этом КУ, если:
//   • ACCEPTED — акцептован, ждёт самовывоза (партию заранее не формировали), либо
//   • SUPPLY_PREPARED И его партия ещё ждёт приёмки (статус партии SUPPLY_PREPARED).
// Заказы, чья партия уже RECEPTION_IN_PROGRESS (акт создан, ждёт подписи),
// повторно НЕ предлагаем: create проверяет статус партии и падает «ожидался
// SUPPLY_PREPARED». Кейс: поставщик приехал повторно, пока прошлая часть ждёт
// подписи председателя — заново сдавать её не нужно.
function isOrderAwaitingPickup(o: MarketplaceSupplierPickupOrderView): boolean {
  if (o.status === 'ACCEPTED') return true;
  if (o.status === 'SUPPLY_PREPARED') {
    return pendingShipments.value.some((s) => s.id === o.shipment_id);
  }
  return false;
}

// Строка состава, агрегированная по товару: несколько заказов одного товара
// (разные заказчики) сливаются в одну строку с суммарным количеством. Оператору
// на приёмке нужен итог «молоко — 10 л», а не разрез по заказчикам.
interface DeliveryLine {
  key: string;
  productName: string;
  unit: string;
  quantity: number;
  // Экспедиторская упаковка: сколько коробок суммарно по товару (если поставка
  // идёт по ТТН и упаковка задана). 0 — упаковка неизвестна, коробки не показываем.
  boxes: number;
}

// Упаковка экспедитора по заказам: order_id → штук в коробке (из ttn_data
// ожидаемой партии). По ней оператор заранее представляет объём в коробках.
const unitsPerBoxByOrder = computed(() => {
  const m = new Map<string, number>();
  for (const s of pendingShipments.value) {
    for (const p of s.ttn_data?.packaging ?? []) {
      const per = Number(p.units_per_box);
      if (Number.isFinite(per) && per > 0) m.set(String(p.order_id), per);
    }
  }
  return m;
});

function aggregateLines(orders: MarketplaceSupplierPickupOrderView[]): DeliveryLine[] {
  const map = new Map<string, DeliveryLine>();
  for (const o of orders) {
    const key = `${o.product_name ?? ''}|${o.unit_of_measure ?? ''}`;
    const qty = Number(o.quantity) || 0;
    const per = unitsPerBoxByOrder.value.get(o.id);
    const boxes = per && per > 0 ? Math.ceil(qty / per) : 0;
    const ex = map.get(key);
    if (ex) {
      ex.quantity += qty;
      ex.boxes += boxes;
    } else
      map.set(key, {
        key,
        productName: o.product_name || 'Товар по предложению',
        unit: o.unit_of_measure,
        quantity: qty,
        boxes,
      });
  }
  return [...map.values()];
}

// Единый список ожидаемых поставок, АГРЕГИРОВАННЫЙ ПО ПОСТАВЩИКУ: один поставщик
// на этом КУ = одна карточка. Для ПВЗ нет разницы, сформировал ли поставщик
// партию заранее или привезёт самовывозом по факту — он приедет один раз и
// сдаст всё разом. Показываем ФИО, что суммарно везёт (по товарам) и общую
// сумму; принимается всё целиком по одному скану QR.
interface ExpectedDelivery {
  offerer: string;
  supplierName: string;
  deliveryLabels: string[];
  amount: string;
  formedAt: string | null;
  ttnNumbers: string[];
  lines: DeliveryLine[];
}

const expectedDeliveries = computed<ExpectedDelivery[]>(() => {
  const out: ExpectedDelivery[] = [];
  for (const [account, all] of Object.entries(ordersByOfferer.value)) {
    const orders = all.filter(isOrderAwaitingPickup);
    if (!orders.length) continue;
    const labels = new Set<string>();
    const ttns = new Set<string>();
    let formedAt: string | null = null;
    for (const o of orders) {
      const ship = o.shipment_id
        ? pendingShipments.value.find((s) => s.id === o.shipment_id)
        : null;
      if (ship) {
        labels.add(SHIPMENT_VARIANT_LABEL[ship.delivery_variant] ?? ship.delivery_variant);
        if (ship.ttn_number) ttns.add(ship.ttn_number);
        const created = String(ship.created_at);
        if (!formedAt || created < formedAt) formedAt = created;
      } else {
        labels.add('Самовывоз');
      }
    }
    out.push({
      offerer: account,
      // ФИО берём из заказов (у партии нет отдельного поля имени — оно в
      // заказах как supplier_name); пусто → показываем аккаунт.
      supplierName: orders.find((o) => o.supplier_name)?.supplier_name || account,
      deliveryLabels: [...labels],
      amount: orders.reduce((a, o) => a + Number.parseFloat(o.total_cost), 0).toFixed(4),
      formedAt: formedAt ? formatDate(formedAt) : null,
      ttnNumbers: [...ttns],
      lines: aggregateLines(orders),
    });
  }
  return out;
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
// Задекларированные единицы, ДОСТУПНЫЕ к приёмке: статус SUPPLY_PREPARED И
// партия ещё ждёт приёмки. Единицы уже принятых партий (RECEPTION_IN_PROGRESS)
// сюда не попадают — иначе повторная сдача падала бы на статусе партии.
const declaredOrders = computed(() =>
  pickupOrders.value.filter(
    (o) =>
      o.status === 'SUPPLY_PREPARED' &&
      pendingShipments.value.some((s) => s.id === o.shipment_id),
  ),
);
const addonOrders = computed(() =>
  pickupOrders.value.filter((o) => o.status === 'ACCEPTED'),
);

// Группировка единиц приёмки по товару: несколько заказов одного товара (разные
// заказчики) — одна группа с общим заголовком и суммой заказанного. Внутри —
// строки по заказчикам (факт/цена правятся per-Order: бухгалтерия per-Order).
interface PickupGroup {
  key: string;
  productName: string;
  unit: string;
  orderedTotal: number;
  orders: MarketplaceSupplierPickupOrderView[];
}

function groupOrdersByProduct(orders: MarketplaceSupplierPickupOrderView[]): PickupGroup[] {
  const map = new Map<string, PickupGroup>();
  for (const o of orders) {
    const key = `${o.product_name ?? ''}|${o.unit_of_measure ?? ''}`;
    const qty = Number(o.quantity) || 0;
    const g = map.get(key);
    if (g) {
      g.orders.push(o);
      g.orderedTotal += qty;
    } else {
      map.set(key, {
        key,
        productName: o.product_name || 'Товар по предложению',
        unit: o.unit_of_measure,
        orderedTotal: qty,
        orders: [o],
      });
    }
  }
  return [...map.values()];
}

const declaredGroups = computed(() => groupOrdersByProduct(declaredOrders.value));
const addonGroups = computed(() => groupOrdersByProduct(addonOrders.value));

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
    // Всё имущество уже передано на приёмку и ждёт подписи — повторно сдавать
    // нечего (иначе create упадёт на статусе партии). Сообщаем явно.
    if (!orders.some(isOrderAwaitingPickup)) {
      FailAlert(
        new Error(
          `Имущество поставщика ${orders[0]?.supplier_name || account} уже передано на приёмку и ожидает подписи — повторная сдача не требуется.`,
        ),
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
    // Добор по акцепту принимаем ТОЛЬКО вместе с привезённой партией. Если
    // поставщик приехал без партии — добор не показываем и не создаём: иначе
    // оператора путает «Принять добор» при отсутствии партии (поставщик просто
    // приехал, принимать нечего по партийной приёмке).
    const hasDeclaredBatch = orders.some(
      (o) =>
        o.status === 'SUPPLY_PREPARED' && pendingShipments.value.some((s) => s.id === o.shipment_id),
    );
    takeAddon.value = hasDeclaredBatch;
    pickupDialogOpen.value = true;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить имущество поставщика');
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
  // Код получения заказчика (receive) на столе приёмки — НЕ ошибка: сканер
  // универсален, оператору не нужно знать, кто пришёл. Ведём его на «Выдачу
  // заказов» с тем же кодом — целевой стол сам откроет выдачу.
  void router.push({
    name: handoffStageRoute('issuance'),
    params: { coopname: coopname.value },
    query: { [HANDOFF_QUERY]: code },
  });
}

// Код передачи мог прийти с универсального сканера (или со стола выдачи) через
// query `handoff`: подхватываем, запускаем приёмку и стираем параметр, чтобы
// повторный показ того же кода снова сработал и обновление страницы не зациклило.
function consumeHandoffQuery(): void {
  const code = route.query[HANDOFF_QUERY];
  if (typeof code !== 'string' || !code) return;
  const rest = { ...route.query };
  delete rest[HANDOFF_QUERY];
  void router.replace({ query: rest });
  void onQrScanned(code);
}

// Сформировать акты приёмки по выбранному: на каждую партию с выбранными
// единицами — createAplReception с фактическим кол-вом per-Order (R5; невыбранные
// единицы партии = 0, потолок = заказано). Не выбранные целиком партии остаются
// ждать. Добор по акцепту — express-самовывозом.
const acceptingPickup = ref(false);

async function acceptPickup(): Promise<void> {
  acceptingPickup.value = true;
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
    acceptingPickup.value = false;
    pickupDialogOpen.value = false;
    pickupOrders.value = [];
    await load();
  }
}

const signDialogOpen = ref(false);
const signGroup = ref<ReceptionGroup<MarketplaceAplReceptionView> | null>(null);

function signChairman(group: ReceptionGroup<MarketplaceAplReceptionView>): void {
  signGroup.value = group;
  signDialogOpen.value = true;
}

async function onChairmanSigned(): Promise<void> {
  await load();
}

watch(braname, () => void load());

// Повторный заход с новым кодом в query (универсальный сканер уже на этом столе).
watch(() => route.query[HANDOFF_QUERY], () => consumeHandoffQuery());

// Realtime вместо поллинга: статус акта меняет поставщик со своего устройства
// (подписал приёмку → PENDING_CHAIRMAN_RECEPTION_SIGN, у оператора сама
// появляется кнопка закрывающей подписи — он не отпускает поставщика, пока не
// увидит её). Сигналы приходят в служебный канал персонала КУ: смена статуса
// акта (фильтруем по своему КУ) и переходы заказов (партия сформирована /
// выдача подписана). Не дёргаем, пока идёт загрузка/приём — чтобы обновление
// не накладывалось на действие; страховка — 60-сек resync канала.
const reloadLive = debounce(() => {
  if (loading.value || acceptingPickup.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  {
    MarketplaceAplReceptionStatusChangedEvent: (event) => {
      if (event.braname === braname.value.trim()) reloadLive();
    },
    MarketplaceOrderStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() }
);

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  await load();
  consumeHandoffQuery();
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

    //- ЕДИНЫЙ список поставок стола ПВЗ. Ожидаемые (ждут приёмки по скану QR) и
    //- уже принятые акты (ждут подписи) — это одна сущность «поставка от
    //- поставщика» на разных стадиях. Для оператора нелогично делить их на две
    //- секции, где одна пишет «поставок нет», а другая требует подписи — поэтому
    //- один лист карточек. Сначала требующие действия (ждут подписи) — они
    //- «живые» прямо сейчас; затем ожидаемые (примутся по скану QR в шапке).
    //- Канон загрузки: пока грузим и данных ещё нет — скелетон, НЕ мелькающая
    //- заглушка «Поставок пока нет» (она и появлялась на полсекунды раньше карточек).
    CardListSkeleton(
      v-if='loading && !expectedDeliveries.length && !receptionGroups.length',
      :count='2'
    )

    EmptyState(
      v-else-if='!expectedDeliveries.length && !receptionGroups.length',
      title='Поставок пока нет',
      body='Поставки появятся здесь, как только поставщики направят их на ваш пункт.'
    )
      template(#icon)
        q-icon(name='local_shipping', size='48px')

    .reception__grid(v-else)
      //- Акты приёмки, ждущие подписи председателя/поставщика (требуют действия).
      BaseCard.reception__card(v-for='g in receptionGroups', :key='`sign-${g.key}`')
        template(#head)
          .reception__card-who
            Avatar(:name='g.offererName', size='md', tone='primary')
            .reception__card-ident
              span.reception__card-name {{ g.offererName }}
              AccountBadge(:account-name='g.offererAccount', size='sm')

        .reception__card-badges
          BaseBadge(:variant='statusVariant(g.status)') {{ statusLabel(g.status) }}
          BaseBadge(variant='neutral') {{ variantLabel(g.variant) }}
        ul.reception__card-items(v-if='g.lines.length')
          li.reception__card-item(v-for='l in g.lines', :key='l.key')
            span.reception__card-prod {{ l.productName }}
            span.reception__card-qty {{ l.quantity }} {{ marketplaceUnitShort(l.unit) }}
        .reception__card-stamps(v-if='g.createdAt || g.supplierSignedAt')
          .reception__card-stamp(v-if='g.createdAt')
            q-icon(name='inventory_2', size='14px')
            span Принята {{ formatDate(g.createdAt) }}
          .reception__card-stamp(v-if='g.supplierSignedAt')
            q-icon(name='draw', size='14px')
            span Поставщик подписал {{ formatDate(g.supplierSignedAt) }}
        .reception__card-summary
          span.reception__card-summary-label Сумма поставки
          span.reception__card-amount {{ formatAsset2Digits(g.totalAmount) }} ₽

        .reception__card-foot(v-if='g.status === "PENDING_CHAIRMAN_RECEPTION_SIGN"')
          BaseButton(variant='primary', @click='signChairman(g)')
            template(#icon-left)
              q-icon(name='draw', size='18px')
            | Подписать председателем

      //- Ожидаемые поставки — примутся по скану QR поставщика (кнопка в шапке).
      BaseCard.reception__card(v-for='d in expectedDeliveries', :key='`exp-${d.offerer}`')
        template(#head)
          .reception__card-who
            Avatar(:name='d.supplierName', size='md', tone='primary')
            .reception__card-ident
              span.reception__card-name {{ d.supplierName }}
              AccountBadge(:account-name='d.offerer', size='sm')

        .reception__card-badges
          BaseBadge(variant='info') Ожидает приёмки
          BaseBadge(v-for='m in d.deliveryLabels', :key='m', variant='neutral') {{ m }}
        ul.reception__card-items(v-if='d.lines.length')
          li.reception__card-item(v-for='l in d.lines', :key='l.key')
            span.reception__card-prod {{ l.productName }}
            span.reception__card-qty
              | {{ l.quantity }} {{ marketplaceUnitShort(l.unit) }}
              span.reception__card-boxes(v-if='l.boxes')  · {{ l.boxes }} кор.
        .reception__card-stamps
          .reception__card-stamp(v-if='d.formedAt')
            q-icon(name='inventory_2', size='14px')
            span Сформирована {{ d.formedAt }}
          .reception__card-stamp(v-else)
            q-icon(name='schedule', size='14px')
            span Привезёт по факту
        .reception__card-summary
          span.reception__card-summary-label Сумма поставки
          span.reception__card-amount {{ formatAsset2Digits(d.amount) }} ₽

  SignAplReceptionChairmanDialog(
    v-model='signDialogOpen',
    :group='signGroup',
    @signed='onChairmanSigned'
  )

  ScannerDialog(v-model='scanDialogOpen', title='Сканирование QR партии', @scanned='onQrScanned')

  //- Эпик 14: агрегирующая приёмка по account-bound коду. Плоский список единиц
  //- имущества (R7a): сверху — задекларированные в партии (по ТТН), ниже
  //- разделитель и добор по акцепту. Факт правится на месте, потолок = заказано (R5).
  BaseDialog(v-model='pickupDialogOpen', :title='pickupDialogTitle', maximized)
    .reception__pickup
      .reception__pickup-account {{ pickupSupplierName || pickupAccount }}

      //- Нет привезённой партии — принимать по партийной приёмке нечего. Добор
      //- по акцепту здесь не показываем (см. openPickupForSupplier): поставщик
      //- приехал без партии, а добор оформляется только вместе с ней.
      EmptyState(
        v-if='!declaredGroups.length',
        title='Нет партии к приёмке',
        body='Поставщик приехал без сформированной партии — принимать по партийной приёмке нечего.'
      )
        template(#icon)
          q-icon(name='inventory_2', size='48px')

      template(v-if='declaredGroups.length')
        .reception__pickup-hint
          | По каждой единице скорректируйте фактическое количество (не выше
          | заказанного) и цену. Снимите галку с задекларированной единицы, чтобы
          | не принимать её; партия без выбранных единиц не создаётся и ждёт.

        .reception__pickup-section Задекларировано в партии (по ТТН)
        .reception__group(v-for='g in declaredGroups', :key='g.key')
          .reception__group-head
            span.reception__group-title {{ g.productName }}
            span.reception__group-total Заказано {{ g.orderedTotal }} {{ marketplaceUnitShort(g.unit) }}
          .reception__unit(v-for='o in g.orders', :key='o.id', :class='{ "reception__unit--off": !isSelected(o.id) }')
            q-checkbox(
              :model-value='isSelected(o.id)',
              dense,
              @update:model-value='(v) => toggleOrder(o.id, v)'
            )
            .reception__unit-info
              .reception__unit-title для {{ o.orderer_name || o.orderer_account }}
              .reception__unit-meta
                | Заказано {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}
                template(v-if='shipmentForOrder(o)?.ttn_number')  · ТТН {{ shipmentForOrder(o)?.ttn_number }}
            .reception__unit-fact
              //- Кламп на каждом изменении, не только на blur: стрелки
              //- спиннера успевали показать «11 при заказе 10», хотя при
              //- отправке значение всё равно срезалось — вводило в заблуждение.
              BaseInput(
                v-model.number='pickupFact[o.id]',
                type='number',
                label='Кол-во',
                :min='0',
                :max='o.quantity',
                :disable='!isSelected(o.id)',
                :suffix='marketplaceUnitShort(o.unit_of_measure)',
                @update:model-value='() => clampFact(o.id, o.quantity)',
                @blur='clampFact(o.id, o.quantity)'
              )
              BaseInput(
                v-model='pickupPrice[o.id]',
                type='number',
                label='Цена/ед.',
                :disable='!isSelected(o.id)'
              )

      //- Добор по акцепту показываем ТОЛЬКО вместе с привезённой партией —
      //- standalone-«Принять добор» при отсутствии партии путает оператора.
      template(v-if='addonGroups.length && declaredGroups.length')
        .reception__pickup-divider
        .reception__pickup-section-row
          .reception__pickup-section Добор по акцепту (вне партии)
          q-checkbox(v-model='takeAddon', dense, label='Принять добор')
        .reception__group(v-for='g in addonGroups', :key='g.key')
          .reception__group-head
            span.reception__group-title {{ g.productName }}
            span.reception__group-total Акцептовано {{ g.orderedTotal }} {{ marketplaceUnitShort(g.unit) }}
          .reception__unit.reception__unit--addon(v-for='o in g.orders', :key='o.id', :class='{ "reception__unit--off": !takeAddon }')
            q-icon(name='add_circle_outline', size='16px')
            .reception__unit-info
              .reception__unit-title для {{ o.orderer_name || o.orderer_account }}
              .reception__unit-meta Акцептовано {{ o.quantity }} {{ marketplaceUnitShort(o.unit_of_measure) }}
            .reception__unit-fact
              BaseInput(
                v-model.number='pickupFact[o.id]',
                type='number',
                label='Кол-во',
                :min='0',
                :max='o.quantity',
                :disable='!takeAddon',
                :suffix='marketplaceUnitShort(o.unit_of_measure)',
                @update:model-value='() => clampFact(o.id, o.quantity)',
                @blur='clampFact(o.id, o.quantity)'
              )
              BaseInput(
                v-model='pickupPrice[o.id]',
                type='number',
                label='Цена/ед.',
                :disable='!takeAddon'
              )

      .reception__pickup-actions
        BaseButton(variant='ghost', size='sm', @click='pickupDialogOpen = false') Отмена
        BaseButton(variant='primary', size='sm', :loading='acceptingPickup', :disabled='!plannedReceptionsCount', @click='acceptPickup')
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

  // ── Единая сетка карточек поставок (ожидаемые + акты на подпись) ──
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

  // Метки времени поставки: компактные строки с иконкой этапа, приглушённые —
  // чтобы оператор различал карточки по датам, не перетягивая на себя акцент.
  &__card-stamps {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__card-stamp {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);

    .q-icon {
      color: var(--p-ink-3);
    }
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

  // Бейджи статуса/способа доставки — отдельной строкой под именем (раньше
  // сидели в #actions справа от шапки и зажимали ФИО в узкую колонку, имя
  // ломалось на 3 строки). Слева, с переносом.
  &__card-badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__card-prod {
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__card-qty {
    flex: 0 0 auto;
    color: var(--p-ink);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  &__card-boxes {
    color: var(--p-ink-3);
    font-weight: 400;
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

  &__group {
    display: flex;
    flex-direction: column;
    margin-top: var(--p-3, 12px);
  }

  &__group-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding-bottom: var(--p-1, 4px);
  }

  &__group-title {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__group-total {
    flex: 0 0 auto;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__unit {
    display: flex;
    align-items: flex-start;
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

  //- Кол-во и Цена/ед. — один горизонтальный ряд, оба с label (одинаковая высота,
  //- выровнены сверху), чтобы инпуты не «прыгали» друг относительно друга.
  &__unit-fact {
    flex: 0 0 auto;
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    width: 280px;

    :deep(.base-input) {
      flex: 1 1 0;
      min-width: 0;
    }
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
