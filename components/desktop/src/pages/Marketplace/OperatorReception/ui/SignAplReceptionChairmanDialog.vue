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
import {
  HandoffTokenKind,
  decodeScannedCode,
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
 * Закрывающая подпись председателя КУ на СВОДНОЙ поставке (on-chain `signchair`).
 *
 * Председатель видит и подписывает доставку целиком — все акты приёмки одного
 * поставщика на этом КУ с одним способом доставки. Под капотом по каждому акту
 * отдельная транзакция (блокчейн не проведёт всё одной tx); крипто-флоу вынесен
 * в api (signReceptionGroupAsChairman), акты подписываются параллельно. Прогресс
 * показываем пользователю; после закрытия всех актов партии приняты в кооператив.
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

// Сброс режима просмотра при открытии/смене поставки — каждая поставка
// начинается с таблицы состава, без подтянутых от прошлой документов.
watch(() => [props.modelValue, props.group?.key], resetActs);

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

// ─────────────────────── Оприходование (Эпик 19) ───────────────────────
// Закрывающая подпись — это момент, когда имущество физически ложится на
// склад. Раньше место назначалось потом, отдельным заходом на стол раскладки, и
// в поле это разъезжалось: председатель стоит с коробками у стойки, а «положил»
// и «отметил» разнесены во времени. Теперь место задаётся здесь же.

const storage = useMarketplaceStorageStore();

const containersEnabled = computed(
  () => branchStore.warehouseSettings.containers_enabled,
);
const cellsEnabled = computed(() => branchStore.warehouseSettings.cells_enabled);
const placementEnabled = computed(() => branchStore.addressedStorageEnabled);
const placementRequired = computed(
  () => branchStore.warehouseSettings.posting_on_reception_required,
);

/** Выбранное место по строке сверки: `container:<id>` либо `cell:<id>`. */
const placementByLine = ref<Record<string, string | null>>({});
const inventoryCountByContainer = ref<Record<string, number>>({});
const scannerOpen = ref(false);
const resolvingCode = ref(false);

/** Сброс при открытии/смене поставки: место — свойство конкретной приёмки. */
watch(
  () => [props.modelValue, props.group?.key],
  () => {
    placementByLine.value = {};
    if (props.modelValue && props.group) void loadStorage();
  },
);

async function loadStorage(): Promise<void> {
  const braname = props.group?.braname;
  if (!braname || !placementEnabled.value) return;
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
  return inventoryCountByContainer.value[containerId] ?? 0;
}

const placedLinesCount = computed(
  () => (props.group?.lines ?? []).filter((l) => placementByLine.value[l.key]).length,
);

const allPlaced = computed(
  () => !!props.group && placedLinesCount.value === props.group.lines.length,
);

/** Есть ли вообще куда класть: заведена ли на участке тара или ячейки. */
const hasPlacementTargets = computed(() => placementOptions.value.length > 0);

/**
 * Подпись блокируется, только если кооператив потребовал место обязательным
 * И положить действительно есть куда. Если тара ещё не заведена, блокировать
 * бессмысленно: председатель стоит с коробками, а выхода из окна нет — вместо
 * запрета показываем, что нужно завести боксы, и даём принять как есть.
 */
const signBlocked = computed(
  () =>
    placementEnabled.value &&
    placementRequired.value &&
    hasPlacementTargets.value &&
    !allPlaced.value,
);

function setPlacementForAll(value: string | null): void {
  const next: Record<string, string | null> = {};
  for (const line of props.group?.lines ?? []) next[line.key] = value;
  placementByLine.value = next;
}

/** Скан QR бокса задаёт место всей поставке разом — обычный случай у стойки. */
async function onScanned(raw: string): Promise<void> {
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
        new Error(
          `Бокс ${container.code} числится за другим участком — принять в него нельзя.`,
        ),
      );
      return;
    }
    setPlacementForAll(placementValueOf({ container_id: container.id }));
    SuccessAlert(`Всё принятое ляжет в бокс ${container.code}`);
    scannerOpen.value = false;
  } catch (e) {
    FailAlert(e, 'Бокс по этому коду не найден');
  } finally {
    resolvingCode.value = false;
  }
}

/** Строки сверки → размещения по заказам: строка агрегирована по товару. */
function buildPlacements(): ChairmanPlacement[] {
  const out: ChairmanPlacement[] = [];
  for (const line of props.group?.lines ?? []) {
    const value = placementByLine.value[line.key];
    if (!value) continue;
    const { container_id, cell_id } = parsePlacementValue(value);
    for (const order_id of line.orderIds) out.push({ order_id, container_id, cell_id });
  }
  return out;
}

function lineQuantityLabel(l: { quantity: number; unit: string; packageSize: number | null }): string {
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

    if (errors.length === 0) {
      SuccessAlert(
        done.value > 1
          ? `Поставка принята в кооператив: подписано актов — ${done.value}.`
          : 'Акт приёмки закрыт подписью председателя. Партия принята в кооператив.',
      );
    } else {
      FailAlert(
        new Error(
          `Подписано ${done.value} из ${deliveriesCount.value}; по ${errors.length} осталась ошибка — повторите.`,
        ),
      );
    }
    emit('signed');
    if (errors.length === 0) emit('update:modelValue', false);
  } finally {
    signing.value = false;
  }
}

function cancel(): void {
  emit('update:modelValue', false);
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  title="Закрывающая подпись поставки"
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

    table.sign-apl__table(v-if="!showActs")
      thead
        tr
          th Товар
          th.num Кол-во
          th.num Сумма
          th.sign-apl__where(v-if="placementEnabled") Куда
      tbody
        tr(v-for="l in group.lines", :key="l.key")
          td {{ l.productName }}
          td.num {{ lineQuantityLabel(l) }}
          td.num {{ formatAsset2Digits(l.amount.toFixed(4)) }} ₽
          td.sign-apl__where(v-if="placementEnabled")
            BaseSelect(
              :model-value="placementByLine[l.key] ?? null",
              :options="placementOptions",
              placeholder="Выберите место",
              @update:model-value="(v: string | number | null) => (placementByLine[l.key] = v === null ? null : String(v))"
            )
      tfoot
        tr
          td Итого к приёмке
          td.num
          td.num {{ formatAsset2Digits(group.totalAmount) }} ₽
          td.sign-apl__where(v-if="placementEnabled")

    //- Канон загрузки: скелетон, а не спиннер поверх контента. Повторное
    //- открытие актов обновляет их молча — уже показанный документ не мигает.
    .sign-apl__preview(v-else)
      .sign-apl__preview-skel(v-if="previewLoading && !previewHtml")
        .skel.skel--title
        .skel.skel--text(v-for="n in 8", :key="n")
      div(v-else-if="previewHtml", v-html="previewHtml")

    //- Оприходование: место назначается здесь же, в момент закрывающей подписи.
    //- Блок держит высоту всегда, когда контур включён, — чтобы таблица не
    //- прыгала при появлении подсказки о неразмещённых строках.
    template(#after, v-if="placementEnabled && !showActs")
      .sign-apl__placement
        .sign-apl__placement-head
          q-icon(name="inventory_2", size="18px")
          span Размещение
        //- Класть некуда — вместо запрета объясняем, что делать. Председатель
        //- стоит у стойки с коробками, тупик в этом окне недопустим.
        BaseBanner(v-if="!hasPlacementTargets", variant="warn")
          | На участке ещё не заведена тара. Подпишите приёмку как есть — имущество
          | встанет на склад без места. Затем заведите боксы на столе «Боксы» и
          | разложите принятое на столе «Раскладка и маркировка».

        .sign-apl__placement-body(v-else)
          BaseButton(
            v-if="containersEnabled",
            variant="secondary",
            :loading="resolvingCode",
            @click="scannerOpen = true"
          )
            template(#icon-left)
              q-icon(name="qr_code_scanner", size="18px")
            | Сканировать бокс
          .sign-apl__placement-note
            | Отсканируйте QR на таре — всё принятое ляжет в этот бокс. Место
            | по отдельной строке можно поменять в колонке «Куда»; негабарит
            | кладётся в ячейку напрямую.
          .sign-apl__placement-state(:class="{ 'is-bad': signBlocked }")
            | Размещено строк: {{ placedLinesCount }} / {{ group.lines.length }}
            template(v-if="placementRequired")  · место обязательно

  template(#footer)
    BaseButton(variant="ghost", :disabled="signing", @click="cancel") Отмена
    BaseButton(variant="ghost", :loading="previewLoading", :disabled="!group", @click="toggleActs")
      template(#icon-left)
        q-icon(name="description", size="18px")
      | {{ showActs ? 'Скрыть акты' : 'Показать акты' }}
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
      span(v-else) Подписать председателем

  ScannerDialog(
    v-model="scannerOpen",
    title="Сканировать бокс",
    idle-caption="Наведите камеру на QR-этикетку бокса",
    frame-hint="Поместите QR-код в рамку",
    manual-label="Или введите код бокса",
    manual-placeholder="BX-0001",
    manual-button="Применить",
    @scanned="onScanned"
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

  // Колонка «Куда» шире прочих: в подписи места видны и код бокса, и адрес.
  &__where {
    width: 280px;
  }

  &__placement {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-3, 12px);
  }

  &__placement-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__placement-body {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__placement-note {
    flex: 1 1 320px;
    min-width: 0;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  // Счётчик держит собственную строку всегда — без него блок «дёргался» бы
  // при переходе от «размещено не всё» к «размещено всё».
  &__placement-state {
    flex: 0 0 auto;
    min-height: 20px;
    font-size: var(--p-fs-body-sm, 13px);
    font-variant-numeric: tabular-nums;
    color: var(--p-ink-2);

    &.is-bad {
      color: var(--p-warn);
      font-weight: 600;
    }
  }
}
</style>
