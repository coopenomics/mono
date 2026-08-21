<template lang="pug">
.q-pa-md
  PageHint(storage-key="edu:admin-connectors:banner-dismissed")
    | Площадки — носители доступа. Ключи API задаются в настройках приложения и видны только председателю;
    | здесь — состояние подключения и последняя проверка.
  .row.q-col-gutter-md
    .col-12.col-md-6.col-lg-4(v-for="c in items" :key="c.carrier")
      BaseCard(variant="default" :title="carrierLabel(c.carrier)")
        .row.items-center.q-gutter-sm.q-mb-sm
          BaseBadge(:variant="healthOf(c.health).variant") {{ healthOf(c.health).label }}
          BaseChip(:variant="c.configured ? 'pos' : 'warn'" size="sm") {{ c.configured ? 'ключи заданы' : 'ключи не заданы' }}
          BaseChip(v-if="!c.enabled" variant="neutral" size="sm") выключена
        DataRow(label="Последняя проверка" :value="c.last_check_at ? formatDateTime(c.last_check_at) : '—'")
        DataRow(v-if="c.last_check_message" label="Сообщение" :value="c.last_check_message")
        .row.justify-end.q-gutter-sm.q-mt-md
          BaseButton(variant="ghost" size="sm" :loading="busy === c.carrier + ':toggle'" @click="toggle(c)") {{ c.enabled ? 'Выключить' : 'Включить' }}
          BaseButton(variant="secondary" size="sm" :loading="busy === c.carrier" @click="check(c)") Проверить сейчас
  CardListSkeleton(v-if="loading && !items.length" :count="3")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseChip, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { CARRIER_LABELS } from '../../entities/Course';
import { HEALTH_LABELS, checkConnector, fetchConnectors, setConnectorEnabled, type IConnector } from '../../entities/Admin';

const items = ref<IConnector[]>([]);
const loading = ref(false);
const busy = ref<string | null>(null);
const carrierLabel = (c: string) => CARRIER_LABELS[c] ?? c;
const healthOf = (h: string) => HEALTH_LABELS[h] ?? { label: h, variant: 'neutral' as const };
const formatDateTime = (v: string | Date) => new Date(v).toLocaleString('ru-RU');

function replace(c: IConnector): void {
  items.value = items.value.map((x) => (x.carrier === c.carrier ? c : x));
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await fetchConnectors();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
async function check(c: IConnector): Promise<void> {
  busy.value = c.carrier;
  try {
    replace(await checkConnector(c.carrier));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}
async function toggle(c: IConnector): Promise<void> {
  busy.value = `${c.carrier}:toggle`;
  try {
    replace(await setConnectorEnabled(c.carrier, !c.enabled));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}
onMounted(load);
</script>
