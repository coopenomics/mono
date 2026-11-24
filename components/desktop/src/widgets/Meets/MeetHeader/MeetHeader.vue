<template lang="pug">
//- Шапка собрания: на каком шаге собрание и что дальше — слева, действие шага
//- для вошедшего — справа. Название собрания уже стоит в верхней полосе
//- приложения и здесь не повторяется.
.meet-header
  .meet-header__main
    BaseBadge(v-if='status', :variant='status.variant') {{ status.label }}
    .meet-header__detail(v-if='status?.detail') {{ status.detail }}
    .meet-header__meta
      span {{ datesLine }}
      span(v-if='kindLine') · {{ kindLine }}
  .meet-header__actions(v-if='$slots.actions')
    slot(name='actions')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseBadge } from 'src/shared/ui/base';
import { meetDatesLine, meetKindLine, meetStatusView, type IMeet } from 'src/entities/Meet';

const props = defineProps<{ meet: IMeet }>();

const status = computed(() => meetStatusView(props.meet));
const datesLine = computed(() => meetDatesLine(props.meet));
const kindLine = computed(() => meetKindLine(props.meet));
</script>

<style lang="scss" scoped>
.meet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-5, 20px);
  padding: var(--p-5, 20px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
}

.meet-header__main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-2, 8px);
  min-width: 0;
}

.meet-header__detail {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  line-height: var(--p-lh-h3, 1.3);
  color: var(--p-ink);
  // Первая буква уточнения — прописная: в строке списка оно идёт под бейджем строчным.
  &::first-letter {
    text-transform: uppercase;
  }
}

.meet-header__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-3);
}

.meet-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
  justify-content: flex-end;
}

// Телефон: действие стоит под статусом и растягивается на всю ширину.
@media (max-width: 600px) {
  .meet-header {
    flex-direction: column;
    align-items: stretch;
  }

  .meet-header__actions {
    justify-content: stretch;

    > :deep(*) {
      flex: 1;
    }
  }
}
</style>
