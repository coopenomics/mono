<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { ensureSigningUnlocked } from 'src/shared/lib/document';
import {
  Avatar,
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseDialog,
  BaseInput,
  BaseSelect,
} from 'src/shared/ui/base';
import type { BaseSelectOption } from 'src/shared/ui/base';
import { AccountBadge } from 'src/shared/ui/domain';
import { ActDialogLayout } from 'src/widgets/Marketplace/ActDialogLayout';
import { ScannerDialog } from 'src/widgets/Marketplace/ScannerDialog';
import { BARCODE_FORMATS } from 'src/widgets/Marketplace/CodeScanner';
import { useOperatorBranchStore } from 'src/entities/OperatorBranch';
import {
  buildPlacementOptions,
  parsePlacementValue,
  placementValueOf,
  resolveContainerByCode,
  useMarketplaceStorageStore,
} from 'src/entities/MarketplaceStorage';
import { listInventory } from 'src/entities/MarketplaceInventory';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { MarketplaceSaleForm } from 'src/shared/lib/consts';
import { quantizeSaleQuantity } from 'src/shared/lib/marketplace/sale-quantity-step';
import {
  HandoffTokenKind,
  decodeScannedCode,
  printBarcodeSheet,
  useActsPreview,
  type ReceptionGroup,
} from 'src/shared/lib/marketplace';
import {
  fetchChairmanSignablePayloads,
  signReceptionGroupAsChairman,
  type ChairmanPlacement,
  type MarketplaceAplReceptionView,
} from '../api';

/**
 * Закрывающая подпись председателя КУ на СВОДНОЙ поставке (on-chain `signchair`)
 * и следующее за ней оприходование.
 *
 * Председатель видит и подписывает доставку целиком — все акты приёмки одного
 * поставщика на этом КУ с одним способом доставки. Под капотом по каждому акту
 * отдельная транзакция (блокчейн не проведёт всё одной tx); крипто-флоу вынесен
 * в api (signReceptionGroupAsChairman), акты подписываются параллельно.
 *
 * Оприходование идёт тремя шагами, и порядок здесь не косметика:
 *
 *   1. СВЕРКА — что и на какую сумму принято.
 *   2. МАРКИРОВКА — принятое разложено по заказчикам (заказ на заказчика), и
 *      этикетка клеится на конкретную единицу имущества. Шаг необязательный:
 *      маркировка нужна не всем и не всегда.
 *   3. РАЗМЕЩЕНИЕ — помеченное раскладывается по боксам и ячейкам, и здесь же
 *      ставится подпись.
 *
 * Подпись — на последнем шаге, а не на первом. Она закрывает акт и снимает
 * поставку с ленты ожидаемых, поэтому подписать и уйти, не разложив, значит
 * потерять принятое из виду. Всё, что председатель наметил на шагах 2–3, уходит
 * вместе с подписью одним пакетом и применяется при создании позиций склада.
 *
 * Шаги 2–3 показываются, только когда кооператив включил адресное хранение.
 * Без него оприходование — это по-прежнему одна подпись и всё.
 */

const props = defineProps<{
  modelValue: boolean;
  group: ReceptionGroup<MarketplaceAplReceptionView> | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'signed'): void;
}>();

const route = useRoute();
const globalStore = useGlobalStore();
const branchStore = useOperatorBranchStore();
const storage = useMarketplaceStorageStore();
const coopname = computed(() => String(route.params.coopname ?? ''));

const signing = ref(false);
const done = ref(0);
const previewHtml = ref<string>('');
const previewLoading = ref(false);
// Единый паттерн «Показать / Скрыть акты»: таблица прячется, показываются акты.
const { showActs, toggleActs, resetActs } = useActsPreview(loadPreview, previewHtml);

// Человекочитаемое имя КУ-получателя вместо служебного braname. Оператор
// привязан к своему КУ — резолвим имя из стола оператора.
const kuName = computed(() => {
  const b = props.group?.braname ?? '';
  return branchStore.branches.find((x) => x.braname === b)?.name || b;
});

const VARIANT_LABEL: Record<string, string> = {
  IN_PERSON: 'Очная приёмка',
  EXPEDITOR: 'Через экспедитора',
  A: 'Очная приёмка',
  B: 'Через экспедитора',
};
const variantLabel = computed(() =>
  props.group ? (VARIANT_LABEL[props.group.variant] ?? props.group.variant) : '',
);

const deliveriesCount = computed(() => props.group?.receptions.length ?? 0);

// ─────────────────────── Шаги оприходования ───────────────────────

type ReceptionStep = 'check' | 'posting';

const step = ref<ReceptionStep>('check');

const containersEnabled = computed(() => branchStore.warehouseSettings.containers_enabled);
const cellsEnabled = computed(() => branchStore.warehouseSettings.cells_enabled);
const placementEnabled = computed(() => branchStore.addressedStorageEnabled);
const placementRequired = computed(
  () => branchStore.warehouseSettings.posting_on_reception_required,
);

const STEP_TITLES: Record<ReceptionStep, string> = {
  check: 'Закрывающая подпись поставки',
  posting: 'Оприходование принятого',
};
const dialogTitle = computed(() => STEP_TITLES[step.value]);

const steps = computed(() => [
  { key: 'check' as const, label: 'Сверка' },
  { key: 'posting' as const, label: 'Оприходование' },
]);

function stepState(key: ReceptionStep): 'done' | 'active' | 'todo' {
  const order: ReceptionStep[] = ['check', 'posting'];
  const at = order.indexOf(step.value);
  const it = order.indexOf(key);
  if (it < at) return 'done';
  return it === at ? 'active' : 'todo';
}

async function loadStorage(): Promise<void> {
  const braname = props.group?.braname;
  if (!braname) return;
  try {
    const [items] = await Promise.all([
      listInventory({ braname }),
      storage.load(braname, {
        containers: containersEnabled.value,
        cells: cellsEnabled.value,
      }),
    ]);
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (!item.container_id) continue;
      counts[item.container_id] = (counts[item.container_id] ?? 0) + 1;
    }
    inventoryCountByContainer.value = counts;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить боксы и ячейки участка');
  }
}

// ─────────────────────── Единицы имущества ───────────────────────
// Строка сверки агрегирует товар по всей поставке: десять литров молока десяти
// заказчиков — одна строка. Но метят и выдают не строку, а конкретную единицу
// конкретного заказчика, поэтому шаги маркировки и раскладки работают по
// заказам. Позиции склада появятся из них один-в-один при подписи.

interface PostingUnit {
  orderId: string;
  productName: string;
  orderer: string;
  quantity: number;
  unit: string;
  packageSize: number | null;
}

const units = computed<PostingUnit[]>(() =>
  (props.group?.receptions ?? [])
    .flatMap((r) => r.fact_quantity_per_order)
    .map((f) => ({
      orderId: f.order_id,
      productName: f.product_name || 'Товар по предложению',
      orderer: f.orderer_name?.trim() || f.orderer_account || 'Заказчик',
      quantity: Number(f.fact_quantity),
      unit: f.unit_of_measure ?? '',
      packageSize: f.package_size ?? null,
    }))
    // Отклонённое в приёмке на склад не попадает — метить и класть нечего.
    .filter((u) => u.quantity > 0),
);

function unitQuantityLabel(u: PostingUnit): string {
  return marketplaceOrderSaleUnitLabel(u.quantity, u.unit, u.packageSize);
}

/**
 * Что наметили сделать с принятым по заказу: куда положить, сколько и с какой
 * этикеткой.
 *
 * Маркировка и раскладка — одно действие, а не два шага. Разложить принятое
 * одного заказчика по трём боксам и не пометить части нечем: потом ни по
 * какому признаку не понять, что в каком боксе чьё. Поэтому этикетка живёт в
 * строке места: расфасовал — тут же наклеил и отсканировал.
 */
interface PlacementRow {
  /** Значение выпадающего списка мест; null — место ещё не выбрано. */
  key: string | null;
  /** Сколько кладут в это место; null — всё принятое по заказу. */
  quantity: number | null;
  /** Номер наклеенной этикетки; null — эта часть не помечена. */
  barcode: string | null;
}

const placementsByOrder = ref<Record<string, PlacementRow[]>>({});

function emptyRow(): PlacementRow {
  return { key: null, quantity: null, barcode: null };
}

function rowsOf(orderId: string): PlacementRow[] {
  return placementsByOrder.value[orderId] ?? [emptyRow()];
}

/**
 * Черновик оприходования переживает закрытие окна: расфасовать поставку и
 * переклеить этикетки — работа на полчаса, и терять её из-за случайного
 * крестика нельзя. Ключ — по поставке, поэтому вернуться можно ровно туда, где
 * остановились. Чистим только после успешной подписи.
 */
const draftKey = computed(() =>
  props.group ? `marketplace-reception-posting:${coopname.value}:${props.group.key}` : null,
);

function restoreDraft(): void {
  const key = draftKey.value;
  if (!key) return;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const draft = JSON.parse(raw) as Record<string, PlacementRow[]>;
    // Заказы могли измениться между заходами — берём только знакомые.
    const known = new Set(units.value.map((u) => u.orderId));
    const restored: Record<string, PlacementRow[]> = {};
    for (const [orderId, rows] of Object.entries(draft)) {
      if (known.has(orderId) && Array.isArray(rows) && rows.length) restored[orderId] = rows;
    }
    placementsByOrder.value = restored;
  } catch {
    localStorage.removeItem(key);
  }
}

function saveDraft(): void {
  const key = draftKey.value;
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(placementsByOrder.value));
  } catch {
    // Приватный режим или переполнение — черновик просто не переживёт перезаход.
  }
}

function clearDraft(): void {
  const key = draftKey.value;
  if (key) localStorage.removeItem(key);
}

watch(placementsByOrder, saveDraft, { deep: true });

/** Открытие/смена поставки: начинаем со сверки и поднимаем прошлый черновик. */
watch(
  () => [props.modelValue, props.group?.key],
  () => {
    resetActs();
    step.value = 'check';
    placementsByOrder.value = {};
    if (props.modelValue && props.group) {
      restoreDraft();
      if (placementEnabled.value) void loadStorage();
    }
  },
);

/**
 * Дискретность количества у этой единицы: упаковки и штуки неделимы, вес и
 * объём считаются до грамма и миллилитра. Шаг общий с корзиной и складом.
 *
 * У упаковочной позиции количество ещё и кратно фасовке: в бокс кладут целые
 * упаковки, а не «семь яиц из десятка» — вскрывать упаковку на складе нельзя
 * (решение 2026-08-13), и контракт такого количества всё равно не примет.
 */
function roundQuantity(u: PostingUnit, value: number): number {
  if (u.packageSize && u.packageSize > 0) {
    const packages = Math.floor(value / u.packageSize + 1e-9);
    return Math.max(0, packages) * u.packageSize;
  }
  return quantizeSaleQuantity(
    {
      sale_form: u.packageSize ? MarketplaceSaleForm.PACKAGED : null,
      unit_of_measure: u.unit,
    },
    value,
  );
}

/** Расхождение мельче грамма — след двоичной дроби, а не реальная разница. */
const QUANTITY_EPSILON = 1e-6;

/** Сколько из принятого по заказу уже разнесено по местам. */
function placedQuantityOf(u: PostingUnit): number {
  return rowsOf(u.orderId).reduce(
    (sum, row) => (row.key ? sum + (row.quantity ?? u.quantity) : sum),
    0,
  );
}

/** Остаток, которому ещё не нашли места. */
function restQuantityOf(u: PostingUnit): number {
  return Math.max(0, roundQuantity(u, u.quantity - placedQuantityOf(u)));
}

function isFullyPlaced(u: PostingUnit): boolean {
  return restQuantityOf(u) <= QUANTITY_EPSILON;
}

/** Сколько частей уже помечено этикеткой — по всем заказам поставки. */
const labeledCount = computed(() =>
  units.value.reduce((sum, u) => sum + rowsOf(u.orderId).filter((row) => row.barcode).length, 0),
);
const placedCount = computed(() => units.value.filter(isFullyPlaced).length);
/** Хоть одна позиция разложена по нескольким местам — таблице нужна колонка количества. */
const hasSplitRows = computed(() => units.value.some((u) => rowsOf(u.orderId).length > 1));
const allPlaced = computed(
  () => units.value.length > 0 && placedCount.value === units.value.length,
);

// ─────────────────────── Маркировка частей ───────────────────────
// Этикетки печатаются впрок и наклеиваются вслепую, а привязку делает сканер:
// какой номер оказался на какой коробке, знает только тот, кто клеил.

const labelScannerOpen = ref(false);
const labelTarget = ref<{ orderId: string; index: number } | null>(null);

/**
 * Код этикетки в узкой клетке режется посередине, а не с конца: этикетки
 * одной партии различаются последними цифрами, и «12345678901…» для двух
 * соседних строк выглядит одинаково. Хвост держится целиком, начало — с
 * многоточием (просьба владельца 09.09.2026).
 */
const BARCODE_TAIL_LENGTH = 4;
function barcodeHead(code: string): string {
  return code.slice(0, -BARCODE_TAIL_LENGTH);
}
function barcodeTail(code: string): string {
  return code.slice(-BARCODE_TAIL_LENGTH);
}

function openLabelScanner(orderId: string, index: number): void {
  labelTarget.value = { orderId, index };
  labelScannerOpen.value = true;
}

/** Все этикетки поставки — для проверки, что номер не занят другой частью. */
function allBarcodes(): Array<{ orderId: string; index: number; barcode: string }> {
  return units.value.flatMap((u) =>
    rowsOf(u.orderId)
      .map((row, index) => ({ orderId: u.orderId, index, barcode: row.barcode ?? '' }))
      .filter((x) => x.barcode),
  );
}

function onLabelScanned(raw: string): void {
  const target = labelTarget.value;
  const code = raw.trim();
  if (!target || !code) return;

  // Сканер читает и QR тары, и служебные коды. Этикетка с листа печати —
  // ровно тринадцать цифр; всё прочее отсекаем здесь, а не на подписи.
  if (!/^\d{13}$/.test(code)) {
    FailAlert(
      new Error(
        `«${code}» не похоже на этикетку: нужны 13 цифр. Отсканируйте штрихкод с листа этикеток, а не QR бокса.`,
      ),
    );
    return;
  }

  // Один номер на две части — потерянный след: сканер потом найдёт две позиции
  // и не скажет, какая чья. Сервер это тоже отвергнет, но узнавать об этом на
  // подписи, наклеив уже всё, поздно.
  const takenBy = allBarcodes().find(
    (x) => x.barcode === code && !(x.orderId === target.orderId && x.index === target.index),
  );
  if (takenBy) {
    FailAlert(new Error(`Этикетка ${code} уже наклеена на другую единицу этой поставки.`));
    return;
  }

  setRowBarcode(target.orderId, target.index, code);
  labelScannerOpen.value = false;
  labelTarget.value = null;
}

function setRowBarcode(orderId: string, index: number, code: string | null): void {
  writeRows(
    orderId,
    rowsOf(orderId).map((row, i) => (i === index ? { ...row, barcode: code } : row)),
  );
}

function printLabels(): void {
  // Этикеток нужно не меньше, чем частей: каждая коробка со своим номером.
  const parts = units.value.reduce((sum, u) => sum + rowsOf(u.orderId).length, 0);
  printBarcodeSheet(Math.max(parts, units.value.length, 1));
}

// ─────────────────────── Размещение ───────────────────────

const boxScannerOpen = ref(false);
const resolvingCode = ref(false);
/**
 * Куда положить отсканированный бокс. `null` — во всё принятое разом (кнопка
 * в шапке, обычный случай у стойки). Заполненная цель — только эта часть:
 * когда позиции расходятся по разной таре, выбирать место мышью в списке из
 * десятков боксов дольше, чем поднести сканер (просьба владельца 09.09.2026).
 */
const boxScanTarget = ref<{ orderId: string; index: number } | null>(null);

function openBoxScanner(target: { orderId: string; index: number } | null = null): void {
  boxScanTarget.value = target;
  boxScannerOpen.value = true;
}

/** Крутилка — только на той кнопке, которой сканировали: остальные не при чём. */
function isResolvingRow(orderId: string, index: number): boolean {
  const target = boxScanTarget.value;
  return resolvingCode.value && target !== null && target.orderId === orderId && target.index === index;
}
/** Сколько позиций уже лежит в боксах участка — для подписи «BX-0001 — 3 поз.». */
const inventoryCountByContainer = ref<Record<string, number>>({});

const placementOptions = computed<BaseSelectOption[]>(() =>
  buildPlacementOptions({
    containers: storage.activeContainers,
    cells: storage.activeCells,
    index: storage.index,
    countOf: countIn,
    containersEnabled: containersEnabled.value,
    cellsEnabled: cellsEnabled.value,
  }),
);

function countIn(containerId: string): number {
  const already = inventoryCountByContainer.value[containerId] ?? 0;
  const key = placementValueOf({ container_id: containerId });
  const planned = units.value.reduce(
    (sum, u) => sum + rowsOf(u.orderId).filter((row) => row.key === key).length,
    0,
  );
  return already + planned;
}

/** Есть ли вообще куда класть: заведена ли на участке тара или ячейки. */
const hasPlacementTargets = computed(() => placementOptions.value.length > 0);

/**
 * Раскладка задана криво: место выбрано, а количество в нём не указано или
 * не положительное, либо по местам разнесли больше, чем приняли. Это ловится
 * до подписи всегда, независимо от требований кооператива, — сервер такой
 * пакет отвергнет, а подпись документов к тому моменту уже сделана.
 */
const placementInputInvalid = computed(() =>
  units.value.some((u) => {
    const rows = rowsOf(u.orderId);
    if (rows.length < 2) return false;
    const brokenRow = rows.some(
      (row) => row.key && (row.quantity === null || row.quantity <= 0),
    );
    return brokenRow || placedQuantityOf(u) > u.quantity + QUANTITY_EPSILON;
  }),
);

/**
 * Подпись блокируется, если кооператив включил адресное хранение и потребовал
 * место обязательным, а разложено не всё.
 *
 * Раньше пустая тара была исключением: окно предлагало «принять как есть»,
 * кнопка оставалась активной, а сервер отвечал «Укажите место хранения для
 * всего принятого» уже после подписи документов (инцидент 2026-08-17, акт
 * 773bd5e6: «Подписано 0 из 1»). Условие здесь — зеркало серверного
 * (`marketplace-apl-reception.service.ts`: требование действует при
 * `posting_on_reception_required` и включённых боксах либо ячейках), поэтому
 * отказ виден до подписи, а не после. Выход из тупика — завести бокс на столе
 * «Боксы»; если кооператив к этому не готов, председатель снимает «Требовать
 * указание места при приёмке» в настройках Стола заказов.
 */
const signBlocked = computed(
  () =>
    placementInputInvalid.value ||
    (placementEnabled.value &&
      placementRequired.value &&
      // Полный отказ партии размещать нечего — там и сервер места не спросит.
      units.value.length > 0 &&
      !allPlaced.value),
);

/** Положить некуда, а место требуют: подписать нельзя, пока не заведена тара. */
const placementImpossible = computed(
  () =>
    !hasPlacementTargets.value &&
    placementEnabled.value &&
    placementRequired.value &&
    units.value.length > 0,
);

function writeRows(orderId: string, rows: PlacementRow[]): void {
  placementsByOrder.value = { ...placementsByOrder.value, [orderId]: rows };
}

function setPlacement(orderId: string, index: number, value: string | null): void {
  const rows = rowsOf(orderId).map((row, i) => (i === index ? { ...row, key: value } : row));
  writeRows(orderId, rows);
}

/**
 * Количество в конкретном месте. Пустое поле — «сколько осталось»: пока строка
 * одна, количество вообще не спрашиваем, оно и так всё.
 */
function setPlacementQuantity(orderId: string, index: number, value: number | null): void {
  const rows = rowsOf(orderId).map((row, i) => (i === index ? { ...row, quantity: value } : row));
  writeRows(orderId, rows);
}

/**
 * Ещё одно место для того же заказа. Первой строке при этом проставляется
 * явное количество: как только мест несколько, «всё сюда» перестаёт иметь
 * смысл — сервер потребует количество у каждой части.
 */
function addPlacementRow(u: PostingUnit): void {
  const rows: PlacementRow[] = rowsOf(u.orderId).map((row) => ({
    ...row,
    quantity: row.quantity ?? roundQuantity(u, u.quantity),
  }));
  const rest = Math.max(
    0,
    roundQuantity(u, u.quantity - rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0)),
  );
  rows.push({ ...emptyRow(), quantity: rest > 0 ? rest : null });
  writeRows(u.orderId, rows);
}

function removePlacementRow(u: PostingUnit, index: number): void {
  const rows = rowsOf(u.orderId).filter((_, i) => i !== index);
  // Последнее место убрали — возвращаемся к простому виду без количества.
  writeRows(u.orderId, rows.length ? rows : [emptyRow()]);
}

/**
 * Скан бокса кладёт туда всё принятое разом. Уже наклеенные этикетки при этом
 * сохраняются: место сменилось, а номер на коробке остался тот же.
 */
function setPlacementForAll(value: string | null): void {
  const next: Record<string, PlacementRow[]> = {};
  for (const u of units.value) {
    const rows = rowsOf(u.orderId);
    next[u.orderId] =
      rows.length === 1
        ? [{ ...rows[0], key: value, quantity: null }]
        : rows.map((row) => ({ ...row, key: value }));
  }
  placementsByOrder.value = next;
}

/**
 * Скан QR бокса кладёт туда всё принятое разом — либо одну часть, если сканер
 * вызвали из её строки (`boxScanTarget`).
 */
async function onBoxScanned(raw: string): Promise<void> {
  if (resolvingCode.value) return;
  const token = decodeScannedCode(raw, coopname.value);
  if (!token || token.kind !== HandoffTokenKind.Container || !token.container_code) {
    FailAlert(new Error('Это не QR-код бокса. Отсканируйте этикетку на таре.'));
    return;
  }
  resolvingCode.value = true;
  try {
    const container = await resolveContainerByCode({ code: token.container_code });
    if (container.braname !== props.group?.braname) {
      FailAlert(
        new Error(`Бокс ${container.code} числится за другим участком — принять в него нельзя.`),
      );
      return;
    }
    const value = placementValueOf({ container_id: container.id });
    const target = boxScanTarget.value;
    if (target) {
      setPlacement(target.orderId, target.index, value);
      SuccessAlert(`Место: бокс ${container.code}`);
    } else {
      setPlacementForAll(value);
      SuccessAlert(`Всё принятое ляжет в бокс ${container.code}`);
    }
    boxScannerOpen.value = false;
  } catch (e) {
    FailAlert(e, 'Бокс по этому коду не найден');
  } finally {
    resolvingCode.value = false;
  }
}

/** Намеченное по каждому заказу — в пакет, уходящий вместе с подписью. */
function buildPlacements(): ChairmanPlacement[] {
  const out: ChairmanPlacement[] = [];
  for (const u of units.value) {
    const rows = rowsOf(u.orderId);
    const placedRows = rows.filter((row) => row.key);
    const multi = placedRows.length > 1;

    for (const row of rows) {
      // Ни места, ни этикетки — планировать нечего.
      if (!row.key && !row.barcode) continue;
      const placement = parsePlacementValue(row.key);
      out.push({
        order_id: u.orderId,
        container_id: placement.container_id,
        cell_id: placement.cell_id,
        barcode_value: row.barcode,
        quantity: multi && row.key ? roundQuantity(u, row.quantity ?? 0) : null,
      });
    }
  }
  return out;
}

// ─────────────────────── Переходы ───────────────────────

function lineQuantityLabel(l: {
  quantity: number;
  unit: string;
  packageSize: number | null;
}): string {
  return marketplaceOrderSaleUnitLabel(l.quantity, l.unit, l.packageSize);
}

async function loadPreview(): Promise<void> {
  if (!props.group) return;
  previewLoading.value = true;
  try {
    const parts: string[] = [];
    for (const r of props.group.receptions) {
      const aggregates = await fetchChairmanSignablePayloads({ apl_reception_id: r.id });
      parts.push(...aggregates.map((a) => a.rawDocument.html));
    }
    previewHtml.value = parts.join('<hr/>');
  } catch (e) {
    FailAlert(e, 'Не удалось сформировать акты приёмки');
  } finally {
    previewLoading.value = false;
  }
}

async function confirm(): Promise<void> {
  if (!props.group || !props.group.receptions.length) return;

  // Акты подписываются параллельно — ключ отпираем один раз до старта.
  if (!(await ensureSigningUnlocked('Не удалось получить ключ оператора для подписи'))) return;

  signing.value = true;
  done.value = 0;
  try {
    // Крипто-флоу закрывающей подписи вынесен в api (signReceptionGroupAsChairman) —
    // зеркало поставщика: акты подписываются параллельно, ошибка по одному не
    // теряет уже подписанные. Прогресс прокидываем в счётчик кнопки.
    const { errors } = await signReceptionGroupAsChairman(
      props.group.receptions,
      globalStore.username,
      (d) => {
        done.value = d;
      },
      buildPlacements(),
    );

    for (const { receptionId, error } of errors) {
      FailAlert(error, `Не удалось закрыть один из актов поставки (${receptionId.slice(0, 8)})`);
    }

    if (errors.length > 0) {
      FailAlert(
        new Error(
          `Подписано ${done.value} из ${deliveriesCount.value}; по ${errors.length} осталась ошибка — повторите.`,
        ),
      );
      emit('signed');
      return;
    }

    // Приёмка закрыта целиком — черновик расфасовки больше не нужен.
    clearDraft();
    SuccessAlert(
      done.value > 1
        ? `Поставка принята в кооператив: подписано актов — ${done.value}.`
        : 'Акт приёмки закрыт подписью оператора. Партия принята в кооператив.',
    );
    emit('signed');
    emit('update:modelValue', false);
  } finally {
    signing.value = false;
  }
}

// ─── Переходы по шагам ───
// Шаг оприходования пропускается, когда контур адресного хранения выключен:
// тогда приёмка это одна подпись, и вести председателя по пустому экрану незачем.

function goNext(): void {
  if (step.value === 'check' && placementEnabled.value) step.value = 'posting';
}

function goBack(): void {
  if (step.value === 'posting') step.value = 'check';
}

function cancel(): void {
  emit('update:modelValue', false);
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  :title="dialogTitle"
  maximized
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  ActDialogLayout(v-if="group")
    template(#head)
      .sign-apl__top
        .sign-apl__who
          Avatar(:name="group.offererName", size="md", tone="primary")
          .sign-apl__ident
            span.sign-apl__name {{ group.offererName }}
            AccountBadge(:account-name="group.offererAccount", size="sm")
        .sign-apl__meta
          BaseBadge(variant="neutral") {{ variantLabel }}
          span.sign-apl__sub
            | КУ {{ kuName }}
            template(v-if="group.ttnNumbers.length")  · ТТН {{ group.ttnNumbers.join(', ') }}

      //- Шаги видны только там, где они есть: без адресного хранения
      //- оприходование это одна подпись, и полоска шагов врала бы.
      .sign-apl__steps(v-if="placementEnabled")
        .sign-apl__step(
          v-for="(s, i) in steps",
          :key="s.key",
          :class="`is-${stepState(s.key)}`"
        )
          span.sign-apl__step-num {{ i + 1 }}
          span.sign-apl__step-label {{ s.label }}

    //- ─────────────── Шаг 1: сверка ───────────────
    template(v-if="step === 'check'")
      table.act-table(v-if="!showActs")
        thead
          tr
            th Товар
            th.num Кол-во
            th.num Сумма
        tbody
          tr(v-for="l in group.lines", :key="l.key")
            td {{ l.productName }}
            td.num {{ lineQuantityLabel(l) }}
            td.num {{ formatAsset2Digits(l.amount.toFixed(4)) }} ₽
        tfoot
          tr
            td Итого к приёмке
            td.num
            td.num {{ formatAsset2Digits(group.totalAmount) }} ₽

      //- Канон загрузки: скелетон, а не спиннер поверх контента. Повторное
      //- открытие актов обновляет их молча — уже показанный документ не мигает.
      .sign-apl__preview(v-else)
        .sign-apl__preview-skel(v-if="previewLoading && !previewHtml")
          .skel.skel--title
          .skel.skel--text(v-for="n in 8", :key="n")
        div(v-else-if="previewHtml", v-html="previewHtml")

    //- ─────────────── Шаг 2: оприходование ───────────────
    //- Раскладка и маркировка — одно действие: расфасовал по боксам, тут же
    //- наклеил и отсканировал этикетку на каждую часть. Разделять их нельзя —
    //- иначе не понять, что из разложенного кому принадлежит.
    template(v-else)
      .sign-apl__lead
        | По каждой позиции: наклейте этикетку и привяжите её сканером, затем
        | укажите бокс — сканом или выбором из списка. Если в один бокс не
        | помещается, добавьте «Ещё место» и укажите, сколько кладёте в каждое.

      //- Тары нет. Дальше два разных положения, и путать их нельзя: при
      //- обязательном месте приёмку не закрыть, пока не заведён бокс, — обещать
      //- «подпишите как есть» здесь значит подвести оператора под отказ сервера
      //- уже после подписи документов.
      BaseBanner(v-if="placementImpossible", variant="neg")
        | На участке ещё не заведена тара, а кооператив требует указывать место
        | хранения при приёмке. Заведите бокс на столе «Боксы» и вернитесь сюда —
        | без места приёмку подписать нельзя. Если место указывать не нужно,
        | председатель снимает «Требовать указание места при приёмке» в настройках
        | Стола заказов.

      BaseBanner(v-else-if="!hasPlacementTargets", variant="warn")
        | На участке ещё не заведена тара. Подпишите приёмку как есть — имущество
        | встанет на склад без места. Затем заведите боксы на столе «Боксы» и
        | разложите принятое на столе «Раскладка и маркировка».

      template(v-else)
        //- Панель над таблицей: групповые действия слева, итог справа. Обе
        //- кнопки одного вида — это действия одного ранга, а не главное и
        //- второстепенное.
        .sign-apl__toolbar
          .sign-apl__toolbar-actions
            BaseButton(
              v-if="containersEnabled",
              variant="secondary",
              size="sm",
              :loading="resolvingCode && !boxScanTarget",
              @click="openBoxScanner()"
            )
              template(#icon-left)
                q-icon(name="qr_code_scanner", size="18px")
              | Всё в один бокс
            BaseButton(variant="secondary", size="sm", @click="printLabels")
              template(#icon-left)
                q-icon(name="print", size="18px")
              | Напечатать этикетки
          .sign-apl__counter(:class="{ 'is-bad': placementInputInvalid }")
            template(v-if="placementInputInvalid")
              | Укажите количество в каждом месте — не больше принятого
            template(v-else)
              | Размещено: {{ placedCount }} / {{ units.length }} · этикеток: {{ labeledCount }}
              //- Требование места — не ошибка, а условие подписи: красить им
              //- весь счётчик значит кричать на оператора цифрами, которые в
              //- порядке. Выделяем только само требование.
              span.sign-apl__counter-note(v-if="placementRequired")  · место обязательно

        //- Таблица позиций. Заголовок и строки держат одну сетку: позиция,
        //- этикетка, место, и — только когда что-то разложено по нескольким
        //- местам — количество с кнопкой удаления. Все контролы одной высоты
        //- с полем места: разнобой кнопок 28px рядом с полем 40px выглядел
        //- собранным из разных наборов.
        .sign-apl__table(:class="{ 'is-split': hasSplitRows }")
          .sign-apl__cols
            span Позиция
            span Этикетка
            span Место
            template(v-if="hasSplitRows")
              span Кол-во
              span

          .sign-apl__unit(v-for="u in units", :key="u.orderId")
            .sign-apl__unit-info
              .sign-apl__unit-name {{ u.productName }}
              .sign-apl__unit-meta {{ unitQuantityLabel(u) }}
              .sign-apl__unit-meta {{ u.orderer }}
              .sign-apl__unit-rest(v-if="rowsOf(u.orderId).length > 1 && !isFullyPlaced(u)")
                | Без места: {{ restQuantityOf(u) }}

            //- Мест может быть несколько: что не влезло в один бокс, кладут в
            //- следующий. Пока место одно, количество не спрашиваем — это всё
            //- принятое по заказу.
            .sign-apl__places
              .sign-apl__place-row(v-for="(row, i) in rowsOf(u.orderId)", :key="i")
                //- Этикетка — на ту же часть, что и место: наклеил на коробку,
                //- которую сейчас кладёшь, и сразу привязал сканером. Пока
                //- этикетки нет, это действие с подписью, а не серый значок,
                //- который оператор не замечал (09.09.2026).
                .sign-apl__place-label-cell
                  //- Привязанная этикетка занимает ту же клетку и ту же высоту,
                  //- что и кнопка: строка не прыгает при маркировке.
                  .sign-apl__label-chip(v-if="row.barcode")
                    q-icon.sign-apl__label-chip-icon(name="label", size="18px")
                    span.sign-apl__label-chip-code(:title="row.barcode")
                      span.sign-apl__label-chip-head {{ barcodeHead(row.barcode) }}
                      span.sign-apl__label-chip-tail {{ barcodeTail(row.barcode) }}
                    BaseButton.sign-apl__place-unlabel(
                      variant="ghost",
                      size="sm",
                      icon-only,
                      aria-label="Снять этикетку",
                      @click="setRowBarcode(u.orderId, i, null)"
                    )
                      template(#icon-left)
                        q-icon(name="close", size="16px")
                        q-tooltip Снять этикетку
                  BaseButton.sign-apl__place-label-btn(
                    v-else,
                    variant="secondary",
                    block,
                    aria-label="Привязать этикетку",
                    @click="openLabelScanner(u.orderId, i)"
                  )
                    template(#icon-left)
                      q-icon(name="new_label", size="18px")
                      q-tooltip Наклейте этикетку на эту часть и привяжите её сканером
                    | Привязать

                //- Поле места и его сканер — одна группа: кнопка примыкает к
                //- полю, потому что заполняет его же, только сканом.
                .sign-apl__place-field
                  BaseSelect.sign-apl__place-select.field-flush(
                    :model-value="row.key",
                    :options="placementOptions",
                    placeholder="Выберите место",
                    searchable,
                    clearable,
                    @update:model-value="(v: string | number | null) => setPlacement(u.orderId, i, v === null ? null : String(v))"
                  )
                  BaseButton.sign-apl__place-scan(
                    v-if="containersEnabled",
                    variant="secondary",
                    :loading="isResolvingRow(u.orderId, i)",
                    aria-label="Отсканировать бокс для этой части",
                    @click="openBoxScanner({ orderId: u.orderId, index: i })"
                  )
                    template(#icon-left)
                      q-icon(name="qr_code_scanner", size="18px")
                      q-tooltip Отсканировать бокс для этой части
                    | Сканировать

                BaseInput.sign-apl__place-qty.field-flush(
                  v-if="rowsOf(u.orderId).length > 1",
                  :model-value="row.quantity === null ? '' : String(row.quantity)",
                  type="number",
                  :placeholder="String(u.quantity)",
                  aria-label="Количество в этом месте",
                  @update:model-value="(v: string | number) => setPlacementQuantity(u.orderId, i, v === '' ? null : Number(v))"
                )
                BaseButton.sign-apl__place-remove(
                  v-if="rowsOf(u.orderId).length > 1",
                  variant="ghost",
                  icon-only,
                  aria-label="Убрать это место",
                  @click="removePlacementRow(u, i)"
                )
                  template(#icon-left)
                    q-icon(name="close", size="18px")
                    q-tooltip Убрать это место

              BaseButton.sign-apl__place-add(
                variant="ghost",
                size="sm",
                :disabled="isFullyPlaced(u) && rowsOf(u.orderId).length > 1",
                @click="addPlacementRow(u)"
              )
                template(#icon-left)
                  q-icon(name="add", size="16px")
                | Ещё место

  template(#footer)
    //- Шаг 1: сверка. Дальше идём, если есть куда: при выключенном адресном
    //- хранении маркировать и раскладывать нечего, и подпись ставится сразу.
    template(v-if="step === 'check'")
      BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
      BaseButton(variant="ghost", :loading="previewLoading", :disabled="!group", @click="toggleActs")
        template(#icon-left)
          q-icon(name="description", size="18px")
        | {{ showActs ? 'Скрыть акты' : 'Показать акты' }}
      BaseButton(v-if="placementEnabled", variant="primary", :disabled="!group", @click="goNext")
        template(#icon-right)
          q-icon(name="arrow_forward", size="18px")
        | Продолжить
      BaseButton(v-else, variant="primary", :loading="signing", :disabled="!group", @click="confirm")
        template(#icon-left)
          q-icon(name="draw", size="18px")
        span(v-if="signing && group") Подписано {{ done }}/{{ deliveriesCount }}…
        span(v-else) Подписать и оприходовать

    //- Шаг 2: подпись. Здесь же держится требование указать место — до подписи,
    //- потому что после неё поставка уходит из ленты ожидаемых.
    template(v-else)
      BaseButton(variant="ghost", :disabled="signing", @click="goBack") Назад
      BaseButton(
        variant="primary",
        :loading="signing",
        :disabled="!group || signBlocked",
        @click="confirm"
      )
        template(#icon-left)
          q-icon(name="draw", size="18px")
        span(v-if="signing && group") Подписано {{ done }}/{{ deliveriesCount }}…
        span(v-else-if="placementImpossible") Сначала заведите бокс
        span(v-else-if="signBlocked") Укажите место хранения
        span(v-else) Подписать и оприходовать

  ScannerDialog(
    v-model="boxScannerOpen",
    :title="boxScanTarget ? 'Бокс для этой части' : 'Бокс для всего принятого'",
    idle-caption="Наведите камеру на QR-этикетку бокса",
    frame-hint="Поместите QR-код в рамку",
    manual-label="Или введите код бокса",
    manual-placeholder="BX-0001",
    manual-button="Применить",
    @scanned="onBoxScanned"
  )

  ScannerDialog(
    v-model="labelScannerOpen",
    title="Привязать этикетку",
    :formats="BARCODE_FORMATS",
    idle-caption="Наведите камеру на этикетку имущества",
    frame-hint="Поместите этикетку в рамку",
    manual-label="Или введите номер этикетки",
    manual-placeholder="4600000000000",
    manual-button="Привязать",
    @scanned="onLabelScanned"
  )
</template>

<style scoped lang="scss">
.sign-apl {
  &__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__who {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;
  }

  &__ident {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: break-word;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__sub {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  // ─── Полоска шагов ───
  &__steps {
    display: flex;
    align-items: center;
    gap: var(--p-4, 16px);
    flex-wrap: wrap;
    margin-top: var(--p-3, 12px);
  }

  &__step {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);

    &.is-active {
      color: var(--p-ink);
      font-weight: 600;
    }

    &.is-done {
      color: var(--p-ink-2);
    }
  }

  &__step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid var(--p-line);
    font-size: var(--p-fs-meta, 12px);
    font-variant-numeric: tabular-nums;

    .is-active & {
      border-color: var(--p-primary);
      background: var(--p-primary-soft);
      color: var(--p-primary);
    }

    .is-done & {
      border-color: var(--p-pos);
      color: var(--p-pos);
    }
  }

  &__preview {
    position: relative;
    min-height: 120px;
    max-height: 55vh;
    overflow: auto;
  }

  // Каркас документа: строка-заголовок и строки текста — держит высоту области,
  // пока акты загружаются, вместо прыжка от пустоты к готовому документу.
  &__preview-skel {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) 0;

    .skel--title {
      width: 46%;
      margin-bottom: var(--p-2, 8px);
    }

    .skel--text:nth-child(even) {
      width: 92%;
    }

    .skel--text:nth-child(odd) {
      width: 78%;
    }
  }

  &__skel {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__lead {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    margin-bottom: var(--p-3, 12px);
  }

  // ─── Шаг 2: таблица позиций ───
  // Высота всех контролов строки — как у плотного поля Quasar (40px): кнопки,
  // чип этикетки, поле количества. Ширины колонок фиксированы, кроме места.
  $row-h: 40px;
  $col-info: 208px;
  $col-label: 176px;
  $col-qty: 88px;
  $col-remove: 36px;
  $gap: var(--p-2, 8px);

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    margin-bottom: var(--p-4, 16px);
  }

  &__toolbar-actions {
    display: flex;
    align-items: center;
    gap: $gap;
    flex-wrap: wrap;
  }

  &__counter {
    font-size: var(--p-fs-body-sm, 13px);
    font-variant-numeric: tabular-nums;
    color: var(--p-ink-2);

    &.is-bad {
      color: var(--p-warn);
      font-weight: 600;
    }
  }

  &__counter-note {
    color: var(--p-warn);
    font-weight: 600;
  }

  // Заголовок колонок и строки позиций делят один шаг сетки: заголовок
  // перечисляет все колонки подряд, строка — позицию и вложенную сетку мест
  // с тем же зазором, поэтому границы совпадают до пикселя.
  &__cols {
    display: grid;
    grid-template-columns: $col-info $col-label minmax(220px, 1fr);
    gap: $gap;
    padding-bottom: var(--p-2, 8px);
    border-bottom: 1px solid var(--p-line);
    font-size: var(--p-fs-meta, 12px);
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__table.is-split &__cols {
    grid-template-columns: $col-info $col-label minmax(220px, 1fr) $col-qty $col-remove;
  }

  &__unit {
    display: grid;
    grid-template-columns: $col-info minmax(0, 1fr);
    gap: $gap;
    align-items: start;
    padding: var(--p-3, 12px) 0;
    border-bottom: 1px solid var(--p-line);

    &:last-child {
      border-bottom: 0;
    }
  }

  // Описание позиции выровнено по первой строке мест: имя на одной линии с
  // контролами, остальное — под ним.
  &__unit-info {
    min-width: 0;
    min-height: $row-h;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
  }

  &__unit-name {
    font-size: var(--p-fs-body, 14px);
    font-weight: 500;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__unit-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  &__unit-rest {
    margin-top: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    font-variant-numeric: tabular-nums;
    color: var(--p-warn);
  }

  &__places {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $gap;
  }

  &__place-row {
    display: grid;
    grid-template-columns: $col-label minmax(220px, 1fr);
    gap: $gap;
    align-items: center;
  }

  &__table.is-split &__place-row {
    grid-template-columns: $col-label minmax(220px, 1fr) $col-qty $col-remove;
  }

  &__place-label-cell {
    min-width: 0;
  }

  &__place-label-btn,
  &__place-scan {
    min-height: $row-h;
  }

  // Код привязанной этикетки: та же геометрия, что у кнопки на её месте.
  &__label-chip {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    min-height: $row-h;
    padding: 0 var(--p-1, 4px) 0 var(--p-3, 12px);
    border: 1px solid var(--p-pos);
    border-radius: var(--p-r-sm, 8px);
    background: var(--p-pos-soft);
    min-width: 0;
  }

  &__label-chip-icon {
    color: var(--p-pos);
    flex: 0 0 auto;
  }

  // Обрезка посередине: начало сжимается с многоточием, хвост не сжимается.
  &__label-chip-code {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    font-family: var(--p-mono);
    font-size: var(--p-fs-body-sm, 13px);
    font-variant-numeric: tabular-nums;
    color: var(--p-pos);
    white-space: nowrap;
  }

  &__label-chip-head {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__label-chip-tail {
    flex: 0 0 auto;
  }

  // Поле места и кнопка сканера — одна группа: общая рамка без шва.
  &__place-field {
    display: flex;
    align-items: stretch;
    min-width: 0;
  }

  &__place-select {
    flex: 1 1 auto;
    min-width: 0;

    :deep(.q-field__control),
    :deep(.q-field__control::before),
    :deep(.q-field__control::after) {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
  }

  &__place-scan {
    flex: 0 0 auto;
    margin-left: -1px;

    &::before {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }

  &__place-qty {
    min-width: 0;
  }

  // Снятие этикетки и удаление места — действия отката: приглушены, пока на
  // них не навели, и краснеют под курсором, чтобы их не жали случайно.
  &__place-unlabel,
  &__place-remove {
    flex: 0 0 auto;

    :deep(.q-icon) {
      color: var(--p-ink-3);
      transition: color 0.15s ease;
    }

    &:hover :deep(.q-icon) {
      color: var(--p-neg);
    }
  }

  &__place-remove {
    min-height: $row-h;
    min-width: $col-remove;
  }

  // Внутри зелёного чипа серый крестик выглядит чужим — приглушаем его тем же
  // цветом, а красным он становится только под курсором.
  &__label-chip &__place-unlabel :deep(.q-icon) {
    color: var(--p-pos);
    opacity: 0.7;
  }

  &__place-add {
    align-self: flex-start;
  }

  // Узкий экран: заголовок колонок теряет смысл, позиция и её места встают
  // друг под друга во всю ширину.
  @media (max-width: 720px) {
    &__cols {
      display: none;
    }

    &__unit,
    &__table.is-split &__place-row,
    &__place-row {
      grid-template-columns: 1fr;
    }

    &__unit-info {
      min-height: 0;
    }
  }
}
</style>
