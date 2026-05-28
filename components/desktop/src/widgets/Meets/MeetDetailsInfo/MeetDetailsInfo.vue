<template lang="pug">
.meet-details-info
  MeetInfoCard(:meet='meet')
  .meet-details-info__actions(v-if='$slots.actions')
    slot(name='actions')
</template>

<script setup lang="ts">
import { MeetInfoCard } from 'src/shared/ui/MeetInfoCard';
import type { IMeet } from 'src/entities/Meet';

defineProps<{
  meet: IMeet;
}>();
</script>

<style lang="scss" scoped>
.meet-details-info__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
  align-items: center;
  margin-top: var(--p-4, 16px);
}
</style>
