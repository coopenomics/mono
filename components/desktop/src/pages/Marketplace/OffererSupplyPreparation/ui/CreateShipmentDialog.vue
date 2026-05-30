<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Notify } from 'quasar';
import { BaseButton, BaseDialog, BaseInput, BaseRadioCard } from 'src/shared/ui/base';
import { createShipment } from '../api';
import type { ShipmentFormationCycle } from '../lib/shipmentFormation';

/**
 * Story 14.1 / 14.5: явное формирование партии поставщиком.
 *
 * Поставщик выбирает вариант доставки ПО КАЖДОМУ КУ заявки (А — самовывоз,
 * Б — экспедитор + ТТН) и формирует партию через `marketplaceCreateShipment`.
 * Backend требует группу на каждый КУ заявки (1:1), поэтому диалог показывает
 * все КУ заявки сразу. Для Варианта Б обязательны поля ТТН.
 */

interface TtnData {
  expeditor_full_name: string;
  expeditor_phone: string;
  expeditor_id_doc: string;
  vehicle_number: string;
  loading_address: string;
  loading_datetime: string;
  delivery_datetime_estimate: string;
}

const SELF = 'A';
const EXPEDITOR = 'B';

const props = defineProps<{
  modelValue: boolean;
  cycle: ShipmentFormationCycle | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'created'): void;
}>();

const submitting = ref(false);
// Вариант доставки и данные ТТН — по каждому КУ (ключ = braname).
const variants = ref<Record<string, string>>({});
const ttn = ref<Record<string, TtnData>>({});

function emptyTtn(): TtnData {
  return {
    expeditor_full_name: '',
    expeditor_phone: '',
    expeditor_id_doc: '',
    vehicle_number: '',
    loading_address: '',
    loading_datetime: '',
    delivery_datetime_estimate: '',
  };
}

// При открытии диалога — инициализируем выбор «самовывоз» для всех КУ.
watch(
  () => props.cycle,
  (cycle) => {
    const v: Record<string, string> = {};
    const t: Record<string, TtnData> = {};
    for (const g of cycle?.groups ?? []) {
      v[g.braname] = SELF;
      t[g.braname] = emptyTtn();
    }
    variants.value = v;
    ttn.value = t;
  },
  { immediate: true },
);

const TTN_FIELDS: Array<{ key: keyof TtnData; label: string; type?: 'text' | 'tel' | 'date' }> = [
  { key: 'expeditor_full_name', label: 'ФИО экспедитора' },
  { key: 'expeditor_phone', label: 'Телефон экспедитора', type: 'tel' },
  { key: 'expeditor_id_doc', label: 'Документ (серия/номер)' },
  { key: 'vehicle_number', label: 'Гос. номер ТС' },
  { key: 'loading_address', label: 'Адрес погрузки' },
  { key: 'loading_datetime', label: 'Дата погрузки', type: 'date' },
  { key: 'delivery_datetime_estimate', label: 'Ожидаемая дата доставки', type: 'date' },
];

function isExpeditor(braname: string): boolean {
  return variants.value[braname] === EXPEDITOR;
}

// Все поля ТТН для каждого Варианта Б должны быть заполнены.
const canSubmit = computed(() => {
  if (!props.cycle) return false;
  return props.cycle.groups.every((g) => {
    if (variants.value[g.braname] !== EXPEDITOR) return true;
    const t = ttn.value[g.braname];
    return t && TTN_FIELDS.every((f) => String(t[f.key]).trim().length > 0);
  });
});

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (!props.cycle || !canSubmit.value) return;
  submitting.value = true;
  try {
    const groups = props.cycle.groups.map((g) => ({
      braname: g.braname,
      delivery_variant: variants.value[g.braname] as 'A' | 'B',
      ttn_data: variants.value[g.braname] === EXPEDITOR ? ttn.value[g.braname] : null,
    }));
    await createShipment({ cycle_id: props.cycle.cycle_id, groups });
    Notify.create({ type: 'positive', message: 'Партия сформирована', timeout: 4000 });
    emit('created');
    close();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message, timeout: 6000 });
  } finally {
    submitting.value = false;
  }
}
</script>

<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  title='Сформировать партию',
  size='lg',
  @update:model-value='emit("update:modelValue", $event)'
)
  .create-shipment(v-if='cycle')
    .create-shipment__intro
      | Выберите способ доставки по каждому пункту выдачи. Самовывоз — привезёте
      | сами, оператор откроет приёмку на КУ. Через экспедитора — заполните ТТН.

    .create-shipment__group(v-for='g in cycle.groups', :key='g.braname')
      .create-shipment__ku
        .create-shipment__ku-name {{ g.kuName }}
        .create-shipment__ku-addr(v-if='g.kuAddress') {{ g.kuAddress }}
        .create-shipment__ku-meta {{ g.ordersCount }} заказ(ов) · {{ g.units }} ед. · {{ g.sum }} ₽

      .create-shipment__variants
        BaseRadioCard(
          v-model='variants[g.braname]',
          :value='SELF',
          title='Самовывоз',
          description='Привезу сам на пункт выдачи'
        )
        BaseRadioCard(
          v-model='variants[g.braname]',
          :value='EXPEDITOR',
          title='Через экспедитора',
          description='Передам по товарно-транспортной накладной'
        )

      .create-shipment__ttn(v-if='isExpeditor(g.braname)')
        .create-shipment__ttn-title Данные ТТН
        .create-shipment__ttn-grid
          BaseInput(
            v-for='f in TTN_FIELDS',
            :key='f.key',
            v-model='ttn[g.braname][f.key]',
            :label='f.label',
            :type='f.type ?? "text"',
            required
          )

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
  gap: var(--p-4, 16px);

  &__intro {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    line-height: 1.4;
  }

  &__group {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__ku-name {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__ku-addr {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__ku-meta {
    margin-top: 2px;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__variants {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--p-2, 8px);
  }

  &__ttn {
    border-top: 1px solid var(--p-line);
    padding-top: var(--p-3, 12px);
  }

  &__ttn-title {
    font-size: var(--p-fs-eyebrow, 11px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
    margin-bottom: var(--p-2, 8px);
  }

  &__ttn-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--p-3, 12px);
  }
}
</style>
