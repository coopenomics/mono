<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
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
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
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

type ReceptionStep = 'check' | 'labeling' | 'placement';

const step = ref<ReceptionStep>('check');

const containersEnabled = computed(() => branchStore.warehouseSettings.containers_enabled);
const cellsEnabled = computed(() => branchStore.warehouseSettings.cells_enabled);
const placementEnabled = computed(() => branchStore.addressedStorageEnabled);
const placementRequired = computed(
  () => branchStore.warehouseSettings.posting_on_reception_required,
);

const STEP_TITLES: Record<ReceptionStep, string> = {
  check: 'Закрывающая подпись поставки',
  labeling: 'Маркировка принятого',
  placement: 'Размещение принятого',
};
const dialogTitle = computed(() => STEP_TITLES[step.value]);

const steps = computed(() => [
  { key: 'check' as const, label: 'Сверка' },
  { key: 'labeling' as const, label: 'Маркировка' },
  { key: 'placement' as const, label: 'Размещение' },
]);

function stepState(key: ReceptionStep): 'done' | 'active' | 'todo' {
  const order: ReceptionStep[] = ['check', 'labeling', 'placement'];
  const at = order.indexOf(step.value);
  const it = order.indexOf(key);
  if (it < at) return 'done';
  return it === at ? 'active' : 'todo';
}

/** Сброс при открытии/смене поставки: каждая поставка проходит шаги заново. */
watch(
  () => [props.modelValue, props.group?.key],
  () => {
    resetActs();
    step.value = 'check';
    barcodeByOrder.value = {};
    placementsByOrder.value = {};
    if (props.modelValue && props.group && placementEnabled.value) void loadStorage();
  },
);

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
  const saleUnit = marketplaceOrderSaleUnit(u.quantity, u.unit, u.packageSize);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
}

/**
 * Что наметили сделать с каждым заказом: этикетка и места хранения.
 *
 * Мест может быть несколько: триста литровых упаковок в один бокс не влезут,
 * их разносят по нескольким с указанием количества в каждом. Одна строка без
 * количества — обычный случай «всё сюда».
 */
interface PlacementRow {
  /** Значение выпадающего списка мест; null — место ещё не выбрано. */
  key: string | null;
  /** Сколько кладут в это место; null — всё принятое по заказу. */
  quantity: number | null;
}

const barcodeByOrder = ref<Record<string, string>>({});
const placementsByOrder = ref<Record<string, PlacementRow[]>>({});

function rowsOf(orderId: string): PlacementRow[] {
  return placementsByOrder.value[orderId] ?? [{ key: null, quantity: null }];
}

/**
 * Дискретность количества у этой единицы: упаковки и штуки неделимы, вес и
 * объём считаются до грамма и миллилитра. Шаг общий с корзиной и складом.
 */
function roundQuantity(u: PostingUnit, value: number): number {
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

const labeledCount = computed(
  () => units.value.filter((u) => barcodeByOrder.value[u.orderId]).length,
);
const placedCount = computed(() => units.value.filter(isFullyPlaced).length);
const allPlaced = computed(
  () => units.value.length > 0 && placedCount.value === units.value.length,
);

// ─────────────────────── Шаг 2: маркировка ───────────────────────
// Этикетки печатаются впрок и наклеиваются вслепую, а привязку делает сканер:
// какой номер оказался на какой коробке, знает только тот, кто клеил.

const labelScannerOpen = ref(false);
const labelTargetOrderId = ref<string | null>(null);

function openLabelScanner(orderId: string): void {
  labelTargetOrderId.value = orderId;
  labelScannerOpen.value = true;
}

function onLabelScanned(raw: string): void {
  const orderId = labelTargetOrderId.value;
  const code = raw.trim();
  if (!orderId || !code) return;

  // Один номер на две единицы — потерянный след: сканер потом найдёт две
  // позиции и не скажет, какая чья. Сервер это тоже отвергнет, но узнавать об
  // этом на подписи, наклеив уже всё, поздно.
  const takenBy = Object.entries(barcodeByOrder.value).find(
    ([id, value]) => value === code && id !== orderId,
  );
  if (takenBy) {
    FailAlert(new Error(`Этикетка ${code} уже наклеена на другую единицу этой поставки.`));
    return;
  }

  barcodeByOrder.value = { ...barcodeByOrder.value, [orderId]: code };
  labelScannerOpen.value = false;
  labelTargetOrderId.value = null;
}

function clearLabel(orderId: string): void {
  const next = { ...barcodeByOrder.value };
  delete next[orderId];
  barcodeByOrder.value = next;
}

function printLabels(): void {
  printBarcodeSheet(Math.max(units.value.length, 1));
}

// ─────────────────────── Шаг 3: размещение ───────────────────────

const boxScannerOpen = ref(false);
const resolvingCode = ref(false);
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
 * Подпись блокируется, если кооператив потребовал место обязательным И положить
 * действительно есть куда. Если тара ещё не заведена, блокировать бессмысленно:
 * председатель стоит с коробками, а выхода из окна нет — вместо запрета
 * показываем, что нужно завести боксы, и даём принять как есть.
 */
const signBlocked = computed(
  () =>
    placementInputInvalid.value ||
    (placementEnabled.value &&
      placementRequired.value &&
      hasPlacementTargets.value &&
      !allPlaced.value),
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
  const rows = rowsOf(u.orderId).map((row) => ({
    ...row,
    quantity: row.quantity ?? roundQuantity(u, u.quantity),
  }));
  const rest = Math.max(
    0,
    roundQuantity(u, u.quantity - rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0)),
  );
  rows.push({ key: null, quantity: rest > 0 ? rest : null });
  writeRows(u.orderId, rows);
}

function removePlacementRow(u: PostingUnit, index: number): void {
  const rows = rowsOf(u.orderId).filter((_, i) => i !== index);
  // Последнее место убрали — возвращаемся к простому виду без количества.
  writeRows(u.orderId, rows.length ? rows : [{ key: null, quantity: null }]);
}

function setPlacementForAll(value: string | null): void {
  const next: Record<string, PlacementRow[]> = {};
  for (const u of units.value) next[u.orderId] = [{ key: value, quantity: null }];
  placementsByOrder.value = next;
}

/** Скан QR бокса кладёт туда всё принятое разом — обычный случай у стойки. */
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
    setPlacementForAll(placementValueOf({ container_id: container.id }));
    SuccessAlert(`Всё принятое ляжет в бокс ${container.code}`);
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
    const rows = rowsOf(u.orderId).filter((row) => row.key);
    const barcode = barcodeByOrder.value[u.orderId] ?? null;

    if (rows.length === 0) {
      // Места нет, но этикетку наклеили — маркировку терять нельзя.
      if (barcode) {
        out.push({
          order_id: u.orderId,
          container_id: null,
          cell_id: null,
          barcode_value: barcode,
          quantity: null,
        });
      }
      continue;
    }

    // Этикетку сканировали на единицу целиком, поэтому она уходит с первой
    // частью; остальные части промаркируют на столе раскладки.
    rows.forEach((row, i) => {
      const placement = parsePlacementValue(row.key);
      out.push({
        order_id: u.orderId,
        container_id: placement.container_id,
        cell_id: placement.cell_id,
        barcode_value: i === 0 ? barcode : null,
        quantity: rows.length > 1 ? roundQuantity(u, row.quantity ?? 0) : null,
      });
    });
  }
  return out;
}

// ─────────────────────── Переходы ───────────────────────

function lineQuantityLabel(l: {
  quantity: number;
  unit: string;
  packageSize: number | null;
}): string {
  const saleUnit = marketplaceOrderSaleUnit(l.quantity, l.unit, l.packageSize);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
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

  const wif = globalStore.wif?.toString();
  if (!wif) {
    FailAlert(new Error('Приватный ключ председателя не найден. Войдите в кооператив.'));
    return;
  }

  signing.value = true;
  done.value = 0;
  try {
    // Крипто-флоу закрывающей подписи вынесен в api (signReceptionGroupAsChairman) —
    // зеркало поставщика: акты подписываются параллельно, ошибка по одному не
    // теряет уже подписанные. Прогресс прокидываем в счётчик кнопки.
    const { errors } = await signReceptionGroupAsChairman(
      props.group.receptions,
      wif,
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

    SuccessAlert(
      done.value > 1
        ? `Поставка принята в кооператив: подписано актов — ${done.value}.`
        : 'Акт приёмки закрыт подписью председателя. Партия принята в кооператив.',
    );
    emit('signed');
    emit('update:modelValue', false);
  } finally {
    signing.value = false;
  }
}

// ─── Переходы по шагам ───
// Шаг маркировки пропускается, когда контур адресного хранения выключен: тогда
// оприходование это одна подпись, и вести председателя по пустым экранам незачем.

function goNext(): void {
  if (step.value === 'check') {
    step.value = placementEnabled.value ? 'labeling' : 'check';
    return;
  }
  if (step.value === 'labeling') step.value = 'placement';
}

function goBack(): void {
  if (step.value === 'placement') {
    step.value = 'labeling';
    return;
  }
  if (step.value === 'labeling') step.value = 'check';
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
      table.sign-apl__table(v-if="!showActs")
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

    //- ─────────────── Шаг 2: маркировка ───────────────
    template(v-else-if="step === 'labeling'")
      .sign-apl__lead
        | Наклейте этикетку на конкретную единицу имущества и привяжите её
        | сканером: тогда при выдаче позиция находится за секунду. Шаг
        | необязательный.

      .sign-apl__unit-head
        BaseButton(variant="secondary", size="sm", @click="printLabels")
          template(#icon-left)
            q-icon(name="print", size="18px")
          | Напечатать этикетки ({{ units.length }})
        span.sign-apl__counter Промаркировано: {{ labeledCount }} / {{ units.length }}

      .sign-apl__unit(v-for="u in units", :key="u.orderId")
        .sign-apl__unit-info
          .sign-apl__unit-name {{ u.productName }}
          .sign-apl__unit-meta {{ unitQuantityLabel(u) }} · {{ u.orderer }}
        .sign-apl__unit-action
          template(v-if="barcodeByOrder[u.orderId]")
            BaseBadge(variant="pos") {{ barcodeByOrder[u.orderId] }}
            BaseButton(
              variant="ghost",
              size="sm",
              icon-only,
              aria-label="Снять этикетку",
              @click="clearLabel(u.orderId)"
            )
              template(#icon-left)
                q-icon(name="close", size="16px")
                q-tooltip Снять этикетку
          BaseButton(v-else, variant="ghost", size="sm", @click="openLabelScanner(u.orderId)")
            template(#icon-left)
              q-icon(name="qr_code_scanner", size="18px")
            | Привязать этикетку

    //- ─────────────── Шаг 3: размещение и подпись ───────────────
    template(v-else)
      .sign-apl__lead
        | Разложите принятое по местам хранения и подпишите приёмку. Отсканируйте
        | QR на таре — всё ляжет в этот бокс; место можно выбрать и в списке,
        | набрав часть кода. Если в один бокс не помещается, добавьте «Ещё место»
        | и укажите, сколько кладёте в каждое; негабарит кладётся в ячейку.

      BaseBanner(v-if="!hasPlacementTargets", variant="warn")
        | На участке ещё не заведена тара. Подпишите приёмку как есть — имущество
        | встанет на склад без места. Затем заведите боксы на столе «Боксы» и
        | разложите принятое на столе «Раскладка и маркировка».

      template(v-else)
        .sign-apl__unit-head
          BaseButton(
            v-if="containersEnabled",
            variant="secondary",
            size="sm",
            :loading="resolvingCode",
            @click="boxScannerOpen = true"
          )
            template(#icon-left)
              q-icon(name="qr_code_scanner", size="18px")
            | Сканировать бокс
          span.sign-apl__counter(:class="{ 'is-bad': signBlocked }")
            template(v-if="placementInputInvalid")
              | Укажите количество в каждом месте — не больше принятого
            template(v-else)
              | Размещено: {{ placedCount }} / {{ units.length }}
              template(v-if="placementRequired")  · место обязательно

        .sign-apl__unit.sign-apl__unit--split(v-for="u in units", :key="u.orderId")
          .sign-apl__unit-info
            .sign-apl__unit-name {{ u.productName }}
            .sign-apl__unit-meta
              | {{ unitQuantityLabel(u) }} · {{ u.orderer }}
              template(v-if="barcodeByOrder[u.orderId]")  · {{ barcodeByOrder[u.orderId] }}
            .sign-apl__unit-rest(v-if="rowsOf(u.orderId).length > 1 && !isFullyPlaced(u)")
              | Без места: {{ restQuantityOf(u) }}

          //- Мест может быть несколько: что не влезло в один бокс, кладут в
          //- следующий. Пока место одно, количество не спрашиваем — это всё
          //- принятое по заказу.
          .sign-apl__places
            .sign-apl__place-row(v-for="(row, i) in rowsOf(u.orderId)", :key="i")
              BaseSelect.sign-apl__place-select.field-flush(
                :model-value="row.key",
                :options="placementOptions",
                placeholder="Выберите место",
                searchable,
                clearable,
                @update:model-value="(v: string | number | null) => setPlacement(u.orderId, i, v === null ? null : String(v))"
              )
              BaseInput.sign-apl__place-qty.field-flush(
                v-if="rowsOf(u.orderId).length > 1",
                :model-value="row.quantity === null ? '' : String(row.quantity)",
                type="number",
                :placeholder="String(u.quantity)",
                aria-label="Количество в этом месте",
                @update:model-value="(v: string | number) => setPlacementQuantity(u.orderId, i, v === '' ? null : Number(v))"
              )
              BaseButton(
                v-if="rowsOf(u.orderId).length > 1",
                variant="ghost",
                size="sm",
                icon-only,
                aria-label="Убрать это место",
                @click="removePlacementRow(u, i)"
              )
                template(#icon-left)
                  q-icon(name="close", size="16px")
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

    //- Шаг 2: маркировка — необязательна, поэтому «Пропустить» равноправно.
    template(v-else-if="step === 'labeling'")
      BaseButton(variant="ghost", @click="goBack") Назад
      BaseButton(variant="ghost", @click="goNext") Пропустить
      BaseButton(variant="primary", @click="goNext")
        template(#icon-right)
          q-icon(name="arrow_forward", size="18px")
        | Дальше: размещение

    //- Шаг 3: подпись. Здесь же держится требование указать место — до подписи,
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
        span(v-else-if="signBlocked") Укажите место хранения
        span(v-else) Подписать и оприходовать

  ScannerDialog(
    v-model="boxScannerOpen",
    title="Сканировать бокс",
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

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--p-fs-body-sm, 13px);

    th,
    td {
      padding: var(--p-2, 8px);
      border-bottom: 1px solid var(--p-line);
      text-align: left;
      color: var(--p-ink);
    }

    th {
      color: var(--p-ink-2);
      font-weight: 600;
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    tfoot td {
      font-weight: 600;
      border-bottom: none;
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

  // ─── Единицы имущества (шаги 2–3) ───
  &__unit-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    margin-bottom: var(--p-3, 12px);
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

  &__unit {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) 0;
    border-bottom: 1px solid var(--p-line);
    flex-wrap: wrap;
  }

  &__unit-info {
    flex: 1 1 240px;
    min-width: 0;
  }

  &__unit-name {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__unit-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  &__unit-action {
    flex: 0 0 auto;
  }

  // Место выбирается в строке позиции — поле не показывает ошибок, поэтому
  // резерв строки под них снят классом field-flush в шаблоне.
  &__unit-place {
    flex: 0 1 320px;
    min-width: 220px;
  }

  // Единица, разложенная по нескольким местам: список строк выравнивается по
  // правому краю карточки, чтобы поля не расползались по ширине.
  &__unit--split {
    align-items: flex-start;
  }

  &__unit-rest {
    margin-top: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm, 13px);
    font-variant-numeric: tabular-nums;
    color: var(--p-warn);
  }

  &__places {
    flex: 0 1 420px;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__place-row {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__place-select {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__place-qty {
    flex: 0 0 96px;
  }

  &__place-add {
    align-self: flex-start;
  }
}
</style>
