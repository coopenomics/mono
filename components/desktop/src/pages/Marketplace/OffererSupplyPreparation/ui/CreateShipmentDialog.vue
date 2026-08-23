<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { BaseButton, BaseDialog, BaseInput, BaseRadioCard } from 'src/shared/ui/base';
import { createShipment, type CreateShipmentVariables } from '../api';
import { groupAcceptedByKu, type ShipmentKuBucket } from '../lib/shipmentFormation';
import type { MarketplaceOrderView } from '../../MyOrders/types';

/**
 * E14: явное формирование партии поставщиком — «отделить акцептованное от
 * реально погруженного».
 *
 * Поток: (1) способ доставки — самовывоз / экспедитор по ТТН; (2) один
 * кооперативный участок; (3) dual-list заказов этого КУ — «переместить всё» +
 * откат отдельных строк назад (гранулярность целая, количество не дробим).
 * Грузим всё, что в правой колонке; невыбранное остаётся ACCEPTED для следующей
 * партии. Выбранные заказы группируются по заявке (cycle_id) — на каждую заявку
 * создаётся отдельная партия (backend: один shipment = один cycle × КУ × вариант).
 */

// Значения GraphQL-enum'а передаются ПО ИМЕНИ (SELF/EXPEDITOR) — backend мапит в код.
const SELF = Zeus.MarketplaceShipmentDeliveryVariant.SELF;
const EXPEDITOR = Zeus.MarketplaceShipmentDeliveryVariant.EXPEDITOR;
type DeliveryVariant = Zeus.MarketplaceShipmentDeliveryVariant;

// Паспорт/удостоверение экспедитора НЕ собираем (минимизация ПДн, требование
// заказчика). Все поля ниже опциональны и целиком переносятся в документ ТТН.
interface TtnData {
  expeditor_full_name: string;
  expeditor_phone: string;
  vehicle_number: string;
  loading_address: string;
  loading_datetime: string;
  delivery_datetime_estimate: string;
}

const props = defineProps<{
  modelValue: boolean;
  /** Акцептованные заказы поставщика (источник для dual-list по КУ). */
  orders: MarketplaceOrderView[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'created'): void;
}>();

const submitting = ref(false);
const variant = ref<DeliveryVariant>(SELF);
const selectedKu = ref<string | null>(null);
// Заказы, перемещённые в партию (id строк). Невыбранное остаётся ACCEPTED.
const included = ref<Set<string>>(new Set());
const ttn = ref<TtnData>(emptyTtn());
// Блок ТТН свёрнут, пока поставщик сам его не откроет: все поля необязательны,
// и раскрытыми они перетягивали внимание с переноса заказов — главного шага.
const ttnOpen = ref(false);
// Экспедиторская упаковка по строкам: orderId → «сколько в коробке» (строкой из
// number-инпута). Число коробок = ceil(quantity / units_per_box). Задаётся ИМЕННО
// при формировании партии — упаковка для перевозки ≠ упаковка заказчика.
const packaging = ref<Record<string, string>>({});

function emptyTtn(): TtnData {
  return {
    expeditor_full_name: '',
    expeditor_phone: '',
    vehicle_number: '',
    loading_address: '',
    loading_datetime: '',
    delivery_datetime_estimate: '',
  };
}

interface TtnField {
  key: keyof TtnData;
  label: string;
  type?: 'text' | 'tel' | 'date';
  placeholder?: string;
}

/**
 * Поля ТТН двумя смысловыми блоками: кто везёт и откуда-докуда.
 * Шесть одинаковых полей подряд читались как сплошная стена ввода — глазу не за
 * что зацепиться, и внимание уходило с главного шага (перенос заказов в партию).
 */
const TTN_GROUPS: Array<{ title: string; fields: TtnField[] }> = [
  {
    title: 'Перевозчик',
    fields: [
      { key: 'expeditor_full_name', label: 'ФИО экспедитора', placeholder: 'Иванов Иван Иванович' },
      { key: 'expeditor_phone', label: 'Телефон экспедитора', type: 'tel', placeholder: '+7 900 000-00-00' },
      { key: 'vehicle_number', label: 'Гос. номер ТС', placeholder: 'А123ВС 777' },
    ],
  },
  {
    title: 'Погрузка и доставка',
    fields: [
      { key: 'loading_address', label: 'Адрес погрузки', placeholder: 'Москва, ул. Складская, 5' },
      { key: 'loading_datetime', label: 'Дата погрузки', type: 'date' },
      { key: 'delivery_datetime_estimate', label: 'Ожидаемая дата доставки', type: 'date' },
    ],
  },
];

const buckets = computed<ShipmentKuBucket[]>(() => groupAcceptedByKu(props.orders));

const activeBucket = computed<ShipmentKuBucket | null>(
  () => buckets.value.find((b) => b.braname === selectedKu.value) ?? null,
);

// Левая колонка — доступно к погрузке; правая — в партии.
const availableLines = computed(() =>
  (activeBucket.value?.lines ?? []).filter((l) => !included.value.has(l.id)),
);
const includedLines = computed(() =>
  (activeBucket.value?.lines ?? []).filter((l) => included.value.has(l.id)),
);

const includedSum = computed(() => includedLines.value.reduce((acc, l) => acc + l.sum, 0));

// Сброс выбора при открытии/смене диалога.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      variant.value = SELF;
      selectedKu.value = buckets.value.length === 1 ? buckets.value[0].braname : null;
      included.value = new Set();
      ttn.value = emptyTtn();
      ttnOpen.value = false;
      packaging.value = {};
    }
  },
  { immediate: true },
);

// Смена КУ — заново пустой выбор (заказы у каждого КУ свои).
watch(selectedKu, () => {
  included.value = new Set();
  packaging.value = {};
});

function selectKu(braname: string): void {
  selectedKu.value = braname;
}

function include(id: string): void {
  const next = new Set(included.value);
  next.add(id);
  included.value = next;
}
function exclude(id: string): void {
  const next = new Set(included.value);
  next.delete(id);
  included.value = next;
}
function includeAll(): void {
  included.value = new Set((activeBucket.value?.lines ?? []).map((l) => l.id));
}
function excludeAll(): void {
  included.value = new Set();
}

const isExpeditor = computed(() => variant.value === EXPEDITOR);

// Что показывает свёрнутая строка ТТН. Сначала то, по чему поставщик узнаёт
// перевозку (кто и на чём), и лишь если этого нет — сухой счётчик заполненного.
const ttnSummary = computed(() => {
  const named = [ttn.value.expeditor_full_name, ttn.value.vehicle_number]
    .map((v) => v.trim())
    .filter(Boolean);
  if (named.length) return named.join(' · ');
  const filled = Object.values(ttn.value).filter((v) => String(v).trim() !== '').length;
  return filled ? `заполнено полей: ${filled}` : 'Не заполнено — необязательно';
});

// Поля ТТН необязательны (правка 2026-06-07): партию можно сформировать с тем,
// что известно о перевозчике, — даже пусто. Единственное условие сабмита — КУ
// выбран и есть хотя бы один заказ в партии.
const canSubmit = computed(
  () => Boolean(selectedKu.value) && included.value.size > 0,
);

function formatPrice(v: number): string {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0 }).format(v) + ' ₽';
}

// Число коробок строки = ceil(количество / штук_в_коробке). null — пока упаковка
// не задана (или некорректна): тогда коробки в ТТН не печатаются.
function boxesFor(line: { id: string; quantity: number }): number | null {
  const per = Math.trunc(Number(packaging.value[line.id]));
  if (!Number.isFinite(per) || per <= 0) return null;
  return Math.ceil(line.quantity / per);
}

// Подсказка под полем «В коробке» (живёт в hint BaseInput — место зарезервировано,
// ряд не прыгает): расчётное число коробок либо призыв заполнить.
function packHint(line: { id: string; quantity: number }): string {
  const b = boxesFor(line);
  return b != null ? `≈ ${b} кор.` : 'укажите упаковку';
}

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (!selectedKu.value || !canSubmit.value) return;
  submitting.value = true;
  try {
    // Выбранные строки → группируем по заявке (одна партия = один cycle × КУ).
    const byCycle = new Map<string, string[]>();
    for (const line of includedLines.value) {
      const arr = byCycle.get(line.cycle_id) ?? [];
      arr.push(line.id);
      byCycle.set(line.cycle_id, arr);
    }

    // В партию кладём только заполненные поля — пустое не должно попасть ни в
    // хранилище, ни в документ ТТН (все поля опциональны). Плюс экспедиторская
    // упаковка по строкам: «штук в коробке» на каждый включённый заказ.
    type TtnDataInput = NonNullable<CreateShipmentVariables['groups'][number]['ttn_data']>;
    let ttn_data: TtnDataInput | null = null;
    if (isExpeditor.value) {
      const d: TtnDataInput = {};
      for (const [k, v] of Object.entries(ttn.value)) {
        const s = String(v).trim();
        if (s !== '') (d as Record<string, unknown>)[k] = s;
      }
      const pack = includedLines.value
        .map((l) => ({ order_id: l.id, units_per_box: Math.trunc(Number(packaging.value[l.id])) }))
        .filter((p) => Number.isFinite(p.units_per_box) && p.units_per_box >= 1);
      if (pack.length) d.packaging = pack;
      ttn_data = d;
    }
    let created = 0;
    for (const [cycle_id, order_ids] of byCycle) {
      const result = await createShipment({
        cycle_id,
        groups: [
          {
            braname: selectedKu.value,
            delivery_variant: variant.value,
            order_ids,
            ttn_data,
          },
        ],
      });
      created += result.shipments.length;
    }

    SuccessAlert(created > 1 ? `Сформировано партий: ${created}` : 'Партия сформирована');
    emit('created');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  title='Сформировать партию',
  maximized,
  @update:model-value='emit("update:modelValue", $event)'
)
  .create-shipment(v-if='buckets.length')
    //- Шаг 1: способ доставки.
    .create-shipment__step
      .create-shipment__step-title Способ доставки
      .create-shipment__variants
        BaseRadioCard(
          v-model='variant',
          :value='SELF',
          title='Самоввоз',
          description='Привезу сам на пункт выдачи — без ТТН'
        )
        BaseRadioCard(
          v-model='variant',
          :value='EXPEDITOR',
          title='Через экспедитора',
          description='Передам по товарно-транспортной накладной (с QR приёмки)'
        )

    //- Шаг 2: кооперативный участок.
    .create-shipment__step
      .create-shipment__step-title Кооперативный участок
      .create-shipment__ku-list
        .create-shipment__ku-row(
          v-for='b in buckets',
          :key='b.braname',
          :class='{ "create-shipment__ku-row--active": selectedKu === b.braname }',
          role='button',
          tabindex='0',
          @click='selectKu(b.braname)',
          @keydown.enter='selectKu(b.braname)'
        )
          q-icon.create-shipment__ku-icon(name='place', size='18px')
          .create-shipment__ku-text
            .create-shipment__ku-name {{ b.kuName }}
            .create-shipment__ku-addr(v-if='b.kuAddress') {{ b.kuAddress }}

    //- Шаг 3: dual-list заказов выбранного КУ.
    .create-shipment__step(v-if='activeBucket')
      .create-shipment__step-title Что грузим в партию
      .create-shipment__hint
        | Перенесите заказы в партию. Грузим всё, что справа; остальное останется
        | акцептованным для следующей партии. Количество в заказе не дробим.
        span(v-if='isExpeditor')
          |  У каждого заказа в партии укажите, сколько единиц кладёте в одну
          | коробку — число коробок посчитается само и попадёт в накладную.
      .create-shipment__transfer
        .create-shipment__col
          .create-shipment__col-head
            span Доступно ({{ availableLines.length }})
            BaseButton(variant='ghost', size='sm', :disabled='!availableLines.length', @click='includeAll')
              | Переместить всё →
          .create-shipment__col-body
            .create-shipment__empty(v-if='!availableLines.length') Все заказы в партии
            .create-shipment__line(v-for='l in availableLines', :key='l.id')
              .create-shipment__line-info
                .create-shipment__line-title {{ l.title }}
                .create-shipment__line-meta {{ l.units }}×{{ l.unitLabel }} · {{ formatPrice(l.sum) }}
              BaseButton(variant='ghost', size='sm', icon-only, aria-label='В партию', @click='include(l.id)')
                template(#icon-left)
                  q-icon(name='chevron_right', size='18px')

        .create-shipment__col
          .create-shipment__col-head
            span В партии ({{ includedLines.length }})
            BaseButton(variant='ghost', size='sm', :disabled='!includedLines.length', @click='excludeAll')
              | ← Убрать всё
          .create-shipment__col-body
            .create-shipment__empty(v-if='!includedLines.length') Перенесите заказы сюда
            .create-shipment__line.create-shipment__line--in(v-for='l in includedLines', :key='l.id')
              BaseButton(variant='ghost', size='sm', icon-only, aria-label='Откатить', @click='exclude(l.id)')
                template(#icon-left)
                  q-icon(name='chevron_left', size='18px')
              .create-shipment__line-info
                .create-shipment__line-title {{ l.title }}
                .create-shipment__line-meta {{ l.units }}×{{ l.unitLabel }} · {{ formatPrice(l.sum) }}
              BaseInput.create-shipment__pack-input(
                v-if='isExpeditor',
                v-model='packaging[l.id]',
                type='number',
                label='В коробке, шт',
                :hint='packHint(l)'
              )
      .create-shipment__total(v-if='includedLines.length')
        | Итого партии: {{ formatPrice(includedSum) }}

    //- Шаг 4: данные ТТН (только экспедитор). Свёрнут по умолчанию — все поля
    //- необязательные, и раскрытыми они спорили за внимание с переносом заказов.
    .create-shipment__step(v-if='activeBucket && isExpeditor')
      .create-shipment__step-title Данные ТТН
      .create-shipment__ttn
        .create-shipment__ttn-head(
          role='button',
          tabindex='0',
          :aria-expanded='ttnOpen',
          @click='ttnOpen = !ttnOpen',
          @keydown.enter='ttnOpen = !ttnOpen',
          @keydown.space.prevent='ttnOpen = !ttnOpen'
        )
          span.create-shipment__ttn-summary {{ ttnSummary }}
          span.create-shipment__ttn-toggle {{ ttnOpen ? 'Свернуть' : 'Заполнить' }}
          q-icon.create-shipment__ttn-chev(:name='ttnOpen ? "expand_less" : "expand_more"', size='20px')

        .create-shipment__ttn-body(v-if='ttnOpen')
          .create-shipment__hint
            | Заполните, что известно о перевозчике. ТТН можно сформировать и с
            | минимумом данных, а незаполненное просто не попадёт в документ.
          .create-shipment__ttn-group(v-for='g in TTN_GROUPS', :key='g.title')
            .create-shipment__ttn-group-title {{ g.title }}
            .create-shipment__ttn-grid
              //- stack-label на всю группу: у полей даты Quasar поднимает метку
              //- сам, и без этого ряд выглядел бы из разных по виду рамок.
              BaseInput(
                v-for='f in g.fields',
                :key='f.key',
                v-model='ttn[f.key]',
                :label='f.label',
                :placeholder='f.placeholder',
                :type='f.type ?? "text"',
                stack-label
              )

  .create-shipment__nodata(v-else)
    | Нет акцептованных заказов для формирования партии. Примите заказы во
    | «Входящих заказах» — они появятся здесь.

  template(#footer)
    BaseButton(variant='ghost', :disabled='submitting', @click='close') Отмена
    BaseButton(
      variant='primary',
      :loading='submitting',
      :disabled='!canSubmit',
      @click='submit'
    ) Сформировать партию
</template>

<style scoped lang="scss">
.create-shipment {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);

  &__step {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__step-title {
    font-size: var(--p-fs-eyebrow, 11px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
  }

  &__hint {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    line-height: 1.4;
  }

  &__variants {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--p-2, 8px);
  }

  &__ku-list {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__ku-row {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    cursor: pointer;

    &--active {
      border-color: var(--q-primary);
      background: var(--p-surface-2, rgba(15, 118, 110, 0.06));
    }
  }

  &__ku-icon {
    color: var(--p-ink-3);
    flex-shrink: 0;
  }

  &__ku-text {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__ku-name {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__ku-addr {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  &__transfer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--p-3, 12px);
  }

  &__col {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    min-height: 120px;
  }

  &__col-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    border-bottom: 1px solid var(--p-line);
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink-2);
  }

  &__col-body {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
    padding: var(--p-2, 8px);
    max-height: 280px;
    overflow-y: auto;
  }

  &__empty {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    padding: var(--p-3, 12px);
    text-align: center;
  }

  &__line {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding: var(--p-1, 4px) var(--p-2, 8px);
    border-radius: var(--p-r-sm, 8px);

    &:hover {
      background: var(--p-surface-2, rgba(0, 0, 0, 0.03));
    }

    &--in {
      flex-direction: row;
      align-items: flex-start;
    }
  }

  &__line-info {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__line-title {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__line-meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
  }

  &__pack-input {
    width: 150px;
    flex-shrink: 0;
  }

  &__total {
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  // Блок ТТН — одна рамка, как у колонок переноса: свёрнутый он читается
  // строкой, а не россыпью полей.
  &__ttn {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    overflow: hidden;
  }

  &__ttn-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    cursor: pointer;
    font-size: var(--p-fs-body-sm, 13px);

    &:hover {
      background: var(--p-surface-2);
    }
  }

  &__ttn-summary {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  &__ttn-toggle {
    flex: 0 0 auto;
    color: var(--p-primary);
    font-weight: 600;
  }

  &__ttn-chev {
    flex: 0 0 auto;
    color: var(--p-ink-3);
  }

  &__ttn-body {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    padding: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }

  &__ttn-group {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__ttn-group-title {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
  }

  &__ttn-grid {
    // Три поля в группе — три колонки, ровным рядом без «сироты» в конце.
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--p-3, 12px);

    @media (max-width: 860px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    @media (max-width: 520px) {
      grid-template-columns: 1fr;
    }
  }

  &__nodata {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    padding: var(--p-4, 16px);
  }
}
</style>
