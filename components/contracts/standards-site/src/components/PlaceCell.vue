<script setup lang="ts">
/**
 * Где в процессе возникает запись сводки (проводка, движение, документ):
 *   • номера шагов этого процесса — кнопки перехода к шагу;
 *   • шаг другого процесса — ссылка на его страницу с прокруткой к шагу;
 *   • ни то ни другое — действие стандарта, которого нет в шагах сценария.
 */
import type { ProcessPoint } from '@/data/process-model';
import type { ForeignPlace } from '@/data/cross';

defineProps<{
  points: ProcessPoint[];
  external?: ForeignPlace | null;
}>();

const emit = defineEmits<{ (e: 'go', number: string): void }>();
</script>

<template>
  <span v-if="points.some((p) => p.number)" class="place__steps">
    <button
      v-for="p in points.filter((x) => x.number)"
      :key="p.number"
      type="button"
      class="place__step"
      :title="p.title"
      @click="emit('go', p.number)"
    >{{ p.number }}</button>
  </span>
  <RouterLink
    v-else-if="external"
    class="place__external"
    :to="{
      name: 'process',
      params: { contract: external.standard.contract, processType: external.standard.process_type },
      query: external.point ? { at: external.point.anchor } : {},
    }"
    :title="`Открыть процесс «${external.standard.title}»`"
  >
    {{ external.point?.number ? `шаг ${external.point.number}` : 'процесс' }} ↗
  </RouterLink>
  <span v-else class="place__none" title="Действие стандарта, которого нет в шагах сценария">без шага</span>
</template>

<style scoped>
.place__steps { display: inline-flex; flex-wrap: wrap; gap: 3px; max-width: 120px; }
.place__step {
  min-width: 34px;
  padding: 1px 8px;
  border: 1px solid var(--accent-border);
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  font-size: 12px;
}
.place__external {
  display: inline-block;
  padding: 1px 8px;
  border: 1px dashed var(--accent-border);
  border-radius: 10px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.place__none { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
</style>
