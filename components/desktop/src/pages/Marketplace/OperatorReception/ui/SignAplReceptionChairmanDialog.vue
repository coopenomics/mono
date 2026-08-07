<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useGlobalStore } from 'src/shared/store';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { Avatar, BaseBadge, BaseBanner, BaseButton, BaseDialog, BaseSelect } from 'src/shared/ui/base';
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
import {
  assignInventoryPlacement,
  bindInventoryBarcode,
  listInventory,
  type MarketplaceInventoryItemView,
} from 'src/entities/MarketplaceInventory';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
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
 *   1. СВЕРКА — что и на какую сумму принято. Подпись создаёт позиции склада:
 *      до неё ни клеить этикетку, ни класть в бокс физически не на что.
 *   2. МАРКИРОВКА — принятое разбито по заказчикам (одна позиция на заказ), и
 *      этикетка клеится на конкретную единицу имущества. Шаг необязательный:
 *      маркировка нужна не всем и не всегда.
 *   3. РАЗМЕЩЕНИЕ — промаркированное раскладывается по боксам и ячейкам.
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
    receivedItems.value = [];
    if (props.modelValue && props.group && placementEnabled.value) void loadStorage();
  },
);

async function loadStorage(): Promise<void> {
  const braname = props.group?.braname;
  if (!braname) return;
  try {
    await storage.load(braname, {
      containers: containersEnabled.value,
      cells: cellsEnabled.value,
    });
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить боксы и ячейки участка');
  }
}

// ─────────────────────── Принятые позиции ───────────────────────
// Позиции склада создаются самой подписью — по одной на заказ, со своим
// заказчиком. Именно они, а не строки сверки, и есть «единицы имущества»:
// строка сверки агрегирует десять литров молока десяти заказчиков в одну.

const receivedItems = ref<MarketplaceInventoryItemView[]>([]);
const loadingItems = ref(false);

const receptionOrderIds = computed(
  () => new Set((props.group?.lines ?? []).flatMap((l) => l.orderIds)),
);

async function loadReceivedItems(): Promise<void> {
  const braname = props.group?.braname;
  if (!braname) return;
  loadingItems.value = true;
  try {
    const items = await listInventory({ braname });
    receivedItems.value = items.filter((i) => receptionOrderIds.value.has(String(i.order_id)));
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить принятое имущество');
  } finally {
    loadingItems.value = false;
  }
}

function patchItem(id: string, patch: Partial<MarketplaceInventoryItemView>): void {
  const idx = receivedItems.value.findIndex((i) => i.id === id);
  const current = receivedItems.value[idx];
  if (idx < 0 || !current) return;
  receivedItems.value[idx] = { ...current, ...patch };
}

function ordererLabel(item: MarketplaceInventoryItemView): string {
  return item.orderer_name?.trim() || item.orderer_account_snapshot;
}

const labeledCount = computed(() => receivedItems.value.filter((i) => i.barcode_value).length);

// ─────────────────────── Шаг 2: маркировка ───────────────────────
// Этикетки печатаются впрок и наклеиваются вслепую, а привязку делает сканер:
// какой номер оказался на какой коробке, знает только тот, кто клеил.

const labelScannerOpen = ref(false);
const labelTarget = ref<MarketplaceInventoryItemView | null>(null);
const binding = ref(false);

function openLabelScanner(item: MarketplaceInventoryItemView): void {
  labelTarget.value = item;
  labelScannerOpen.value = true;
}

async function onLabelScanned(raw: string): Promise<void> {
  const item = labelTarget.value;
  const code = raw.trim();
  if (!item || !code || binding.value) return;
  binding.value = true;
  try {
    await bindInventoryBarcode({ inventory_id: item.id, barcode_value: code });
    patchItem(item.id, { barcode_value: code });
    labelScannerOpen.value = false;
    labelTarget.value = null;
  } catch (e) {
    FailAlert(e, 'Не удалось привязать этикетку');
  } finally {
    binding.value = false;
  }
}

function printLabels(): void {
  printBarcodeSheet(Math.max(receivedItems.value.length, 1));
}

// ─────────────────────── Шаг 3: размещение ───────────────────────

const boxScannerOpen = ref(false);
const resolvingCode = ref(false);

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

/** Сколько позиций уже лежит в боксе — вместе с только что принятыми. */
function countIn(containerId: string): number {
  return receivedItems.value.filter((i) => i.container_id === containerId).length;
}

const placedCount = computed(
  () => receivedItems.value.filter((i) => i.container_id || i.cell_id).length,
);
const allPlaced = computed(
  () => receivedItems.value.length > 0 && placedCount.value === receivedItems.value.length,
);

/** Есть ли вообще куда класть: заведена ли на участке тара или ячейки. */
const hasPlacementTargets = computed(() => placementOptions.value.length > 0);

/**
 * Требование места держит третий шаг, а не подпись: имущество уже на складе,
 * и «не дать закрыть окно» — единственное честное принуждение. Если класть
 * некуда, требование молчит: тупика у стойки быть не должно.
 */
const finishBlocked = computed(
  () => placementRequired.value && hasPlacementTargets.value && !allPlaced.value,
);

async function placeItem(item: MarketplaceInventoryItemView, value: string | null): Promise<void> {
  const { container_id, cell_id } = parsePlacementValue(value);
  const before = { container_id: item.container_id, cell_id: item.cell_id };
  if (before.container_id === container_id && before.cell_id === cell_id) return;

  patchItem(item.id, { container_id, cell_id });
  try {
    await assignInventoryPlacement({
      inventory_id: item.id,
      container_id,
      cell_id,
    });
  } catch (e) {
    patchItem(item.id, before);
    FailAlert(e, 'Не удалось разместить позицию');
  }
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
    boxScannerOpen.value = false;
    const value = placementValueOf({ container_id: container.id });
    await Promise.all(receivedItems.value.map((item) => placeItem(item, value)));
    SuccessAlert(`Всё принятое лежит в боксе ${container.code}`);
  } catch (e) {
    FailAlert(e, 'Бокс по этому коду не найден');
  } finally {
    resolvingCode.value = false;
  }
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

    // Без адресного хранения оприходование на подписи и заканчивается.
    if (!placementEnabled.value) {
      emit('update:modelValue', false);
      return;
    }
    showActs.value = false;
    step.value = 'labeling';
    await loadReceivedItems();
  } finally {
    signing.value = false;
  }
}

function goPlacement(): void {
  step.value = 'placement';
}

function finish(): void {
  close();
}

/**
 * Закрытие окна после подписи. Запирать здесь нельзя — имущество уже на складе,
 * и председатель вправе уйти. Но уйти молча, оставив принятое без места, значит
 * потом искать его по всему участку, поэтому говорим, где оно найдётся.
 */
function close(): void {
  const unplaced = receivedItems.value.length - placedCount.value;
  if (placementEnabled.value && step.value !== 'check' && unplaced > 0) {
    SuccessAlert(
      `Принято на склад. Без места осталось позиций — ${unplaced}: они ждут в «Поступило» на столе «Раскладка и маркировка».`,
    );
  }
  emit('update:modelValue', false);
}

function cancel(): void {
  emit('update:modelValue', false);
}

function onDialogModel(v: boolean): void {
  if (v) return;
  close();
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  :title="dialogTitle"
  maximized
  @update:model-value="onDialogModel"
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
        | Принятое разошлось по заказчикам — по позиции на каждый заказ. Наклейте
        | этикетку на коробку и привяжите её сканером: тогда при выдаче позиция
        | находится за секунду. Шаг необязательный, его можно пропустить.

      .sign-apl__unit-head
        BaseButton(variant="secondary", size="sm", @click="printLabels")
          template(#icon-left)
            q-icon(name="print", size="18px")
          | Напечатать этикетки ({{ receivedItems.length }})
        span.sign-apl__counter Промаркировано: {{ labeledCount }} / {{ receivedItems.length }}

      .sign-apl__skel(v-if="loadingItems && !receivedItems.length")
        .skel.skel--text(v-for="n in 3", :key="n")

      .sign-apl__unit(v-for="item in receivedItems", :key="item.id")
        .sign-apl__unit-info
          .sign-apl__unit-name {{ item.product_name_snapshot || 'Товар по предложению' }}
          .sign-apl__unit-meta {{ item.quantity_per_label }} ед. · {{ ordererLabel(item) }}
        .sign-apl__unit-action
          BaseBadge(v-if="item.barcode_value", variant="pos") {{ item.barcode_value }}
          BaseButton(v-else, variant="ghost", size="sm", @click="openLabelScanner(item)")
            template(#icon-left)
              q-icon(name="qr_code_scanner", size="18px")
            | Привязать этикетку

    //- ─────────────── Шаг 3: размещение ───────────────
    template(v-else)
      .sign-apl__lead
        | Разложите принятое по местам хранения. Отсканируйте QR на таре — всё
        | ляжет в этот бокс; место по отдельной позиции меняется в списке,
        | негабарит кладётся в ячейку напрямую.

      BaseBanner(v-if="!hasPlacementTargets", variant="warn")
        | На участке ещё не заведена тара. Имущество уже на складе — заведите боксы
        | на столе «Боксы» и разложите принятое на столе «Раскладка и маркировка».

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
          span.sign-apl__counter(:class="{ 'is-bad': finishBlocked }")
            | Размещено: {{ placedCount }} / {{ receivedItems.length }}
            template(v-if="placementRequired")  · место обязательно

        .sign-apl__unit(v-for="item in receivedItems", :key="item.id")
          .sign-apl__unit-info
            .sign-apl__unit-name {{ item.product_name_snapshot || 'Товар по предложению' }}
            .sign-apl__unit-meta
              | {{ item.quantity_per_label }} ед. · {{ ordererLabel(item) }}
              template(v-if="item.barcode_value")  · {{ item.barcode_value }}
          BaseSelect.sign-apl__unit-place.field-flush(
            :model-value="placementValueOf(item)",
            :options="placementOptions",
            placeholder="Выберите место",
            @update:model-value="(v: string | number | null) => placeItem(item, v === null ? null : String(v))"
          )

  template(#footer)
    //- Шаг 1: сверка и подпись.
    template(v-if="step === 'check'")
      BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
      BaseButton(variant="ghost", :loading="previewLoading", :disabled="!group", @click="toggleActs")
        template(#icon-left)
          q-icon(name="description", size="18px")
        | {{ showActs ? 'Скрыть акты' : 'Показать акты' }}
      BaseButton(variant="primary", :loading="signing", :disabled="!group", @click="confirm")
        template(#icon-left)
          q-icon(name="draw", size="18px")
        span(v-if="signing && group") Подписано {{ done }}/{{ deliveriesCount }}…
        span(v-else) Подписать и оприходовать

    //- Шаг 2: маркировка — необязательна, поэтому «Пропустить» равноправно.
    template(v-else-if="step === 'labeling'")
      BaseButton(variant="ghost", @click="goPlacement") Пропустить
      BaseButton(variant="primary", :disabled="loadingItems", @click="goPlacement")
        | Дальше: размещение

    //- Шаг 3: размещение — здесь и держится требование указать место.
    template(v-else)
      BaseButton(variant="ghost", @click="close") Закрыть
      BaseButton(variant="primary", :disabled="finishBlocked", @click="finish")
        template(#icon-left)
          q-icon(name="check", size="18px")
        span(v-if="finishBlocked") Укажите место хранения
        span(v-else) Готово

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
}
</style>
