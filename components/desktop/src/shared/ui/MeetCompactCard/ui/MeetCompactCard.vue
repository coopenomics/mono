<template lang="pug">
.meet-card(
  role='button',
  tabindex='0',
  @click='$emit("navigate")',
  @keydown.enter.prevent='$emit("navigate")',
  @keydown.space.prevent='$emit("navigate")'
)
  .meet-card__head
    .meet-card__icon(aria-hidden='true')
      q-icon(name='event', size='20px')
    .meet-card__title Общее собрание № {{ meet.processing?.meet?.id }}

  .meet-card__tiles
    .meet-card__tile
      .meet-card__tile-label Открытие
      .meet-card__tile-value {{ meetStatus.formattedOpenDate }} {{ getTimezoneLabel() }}
    .meet-card__tile
      .meet-card__tile-label Закрытие
      .meet-card__tile-value {{ meetStatus.formattedCloseDate }} {{ getTimezoneLabel() }}

  MeetStatusBanner(:meet='meet')

  .meet-card__foot
    span.meet-card__more
      span Подробнее
      q-icon(name='arrow_forward', size='16px')
</template>

<script setup lang="ts">
import type { IMeet } from 'src/entities/Meet';
import { useMeetStatus } from 'src/shared/lib/composables';

import { getTimezoneLabel } from 'src/shared/lib/utils/dates';
import { MeetStatusBanner } from 'src/shared/ui/MeetStatusBanner';

const props = defineProps<{
  meet: IMeet;
}>();

defineEmits<{
  navigate: [];
}>();

const meetStatus = useMeetStatus(props.meet);
</script>

<style lang="scss" scoped>
.meet-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  width: 100%;
  padding: var(--p-5, 20px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  cursor: pointer;
  transition:
    border-color var(--p-dur-fast, 120ms) var(--p-ease-standard),
    box-shadow var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.meet-card:hover {
  border-color: var(--p-line-1);
  box-shadow: var(--p-shadow-card);
}
.meet-card:focus-visible {
  outline: none;
  border-color: var(--p-line-1);
  box-shadow: inset var(--p-focus-ring);
}

.meet-card__head {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
}
.meet-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--p-r-md, 12px);
  background: var(--p-surface-2);
  color: var(--p-ink-2);
}
.meet-card__title {
  font-size: var(--p-fs-h6, 16px);
  font-weight: 600;
  line-height: 1.3;
  color: var(--p-ink);
}

.meet-card__tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-3, 12px);
}
@media (max-width: 600px) {
  .meet-card__tiles {
    grid-template-columns: 1fr;
  }
}
.meet-card__tile {
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.meet-card__tile-label {
  font-size: var(--p-fs-meta, 12px);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--p-ink-3);
  margin-bottom: var(--p-1, 4px);
}
.meet-card__tile-value {
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  line-height: 1.35;
  color: var(--p-ink-1);
  overflow-wrap: anywhere;
}

.meet-card__foot {
  display: flex;
}
.meet-card__more {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-2);
}
.meet-card:hover .meet-card__more {
  color: var(--p-ink);
}
</style>
