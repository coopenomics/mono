<template>
  <q-dialog v-model="model" full-width position="right" persistent>
    <q-card class="mp-card" style="width: min(720px, 100vw); height: 100vh">
      <q-card-section class="row items-center q-pb-sm">
        <div class="text-h6 col">
          {{ humanProcessType(view?.process_type) }}
        </div>
        <q-btn flat dense icon="close" @click="onClose" />
      </q-card-section>
      <q-separator />
      <q-card-section v-if="loading" class="row justify-center q-py-md">
        <q-spinner size="32px" color="primary" />
      </q-card-section>
      <q-card-section v-else-if="view" class="q-gutter-md">
        <div>
          <div class="text-caption text-grey-7">process_hash</div>
          <div class="text-mono text-body2">{{ view.process_hash }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">
            {{ formatRange(view.first_seen_at, view.last_seen_at) }}
          </div>
        </div>

        <q-expansion-item label="Действия" default-opened :caption="`${view.actions.length}`">
          <q-list bordered separator dense>
            <q-item v-for="a in view.actions" :key="a.id">
              <q-item-section>
                <q-item-label>{{ a.account }} · {{ a.name }}</q-item-label>
                <q-item-label caption>
                  блок {{ a.block_num }} · seq {{ a.global_sequence }} ·
                  {{ formatDateTime(a.created_at) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>

        <q-expansion-item
          label="Дельты состояния"
          :caption="`${view.delta_history.length}`"
        >
          <q-list bordered separator dense>
            <q-item v-for="d in view.delta_history" :key="d.id">
              <q-item-section>
                <q-item-label>{{ d.code }}::{{ d.table }} · {{ d.primary_key }}</q-item-label>
                <q-item-label caption>
                  блок {{ d.block_num }} ·
                  {{ d.present ? 'присутствует' : 'удалено' }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>

        <q-expansion-item
          label="Документы"
          :caption="`${view.documents.length}`"
        >
          <q-list bordered separator dense>
            <q-item v-for="doc in view.documents" :key="doc.hash">
              <q-item-section>
                <q-item-label>{{ doc.source.code }}::{{ doc.source.table }}</q-item-label>
                <q-item-label caption class="text-mono">{{ doc.hash }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>

        <div class="row q-gutter-sm">
          <q-btn flat no-caps color="primary" icon="download" label="Скачать JSON" @click="onDownload" />
        </div>
      </q-card-section>
      <q-card-section v-else class="text-grey-7">
        Контекст процесса недоступен.
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { ProcessView } from '../api';

interface Props {
  modelValue: boolean;
  view: ProcessView | null;
  loading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const model = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

function onClose(): void {
  model.value = false;
}

function onDownload(): void {
  if (!props.view) return;
  const blob = new Blob([JSON.stringify(props.view, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `process-${props.view.process_hash.slice(0, 12)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function humanProcessType(type: string | undefined): string {
  switch (type) {
    case 'p.mkt.supply':
      return 'Прямая поставка и приобретение имущества';
    case 'p.mkt.return':
      return 'Гарантийный возврат имущества';
    case 'p.mkt.wroff':
      return 'Утилизация скоропорта';
    default:
      return type ?? 'Процесс';
  }
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('ru-RU');
}

function formatRange(from: unknown, to: unknown): string {
  return `${formatDateTime(from)} → ${formatDateTime(to)}`;
}
</script>

<style scoped>
.text-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>
