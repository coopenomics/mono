<template lang="pug">
.meet-compact-card.q-pa-lg(@click='$emit("navigate")')
  .meet-header.q-mb-md
    .row.items-center.justify-between
      .col-auto.flex.items-center
        q-icon.q-mr-md(name='event', size='28px', color='primary')
        .meet-info
          .meet-title Общее собрание № {{ meet.processing?.meet?.id }}

  .meet-body.q-mb-md
    .row
      .col-md-6.col-xs-12.q-pa-sm
        .balance-card.balance-card-primary
          .balance-label Открытие
          .balance-value {{ meetStatus.formattedOpenDate }} {{ getTimezoneLabel() }}
      .col-md-6.col-xs-12.q-pa-sm
        .balance-card.balance-card-primary
          .balance-label Закрытие
          .balance-value {{ meetStatus.formattedCloseDate }} {{ getTimezoneLabel() }}
  .meet-status-row
    MeetStatusBanner(:meet='meet')

  .row.q-mt-lg
    .col-auto
      q-btn(
        color='primary',
        icon='arrow_forward',
        label='Подробнее',
        flat,
        @click.stop='$emit("navigate")'
      )
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
@import 'src/shared/ui/CardStyles/index.scss';

.meet-compact-card {
  @extend .card-container;
  cursor: pointer;
  transition: all 0.3s ease;

  // Дополнительная стилизация для темной темы
  .q-dark & {
    background-color: rgba(255, 255, 255, 0.07) !important;
    border: 1px solid rgba(255, 255, 255, 0.25) !important;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);

    .q-dark & {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      background-color: rgba(255, 255, 255, 0.1) !important;
    }

    .balance-card {
      &:hover {
        background: rgba(25, 118, 210, 0.12);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(25, 118, 210, 0.2);

        .q-dark & {
          background: rgba(25, 118, 210, 0.22);
        }
      }
    }
  }

  .meet-header {
    .meet-info {
      .meet-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--q-primary);
        margin-bottom: 2px;
      }
    }
  }

  .meet-body {
    .balance-card {
      @extend .balance-card;
      @extend .balance-card-primary;
      transition: all 0.2s ease;

      .balance-value {
        font-size: 16px;
        font-weight: 600;
      }
    }
  }

  .meet-status-row {
    width: 100%;
  }
}

// Адаптивность
@media (max-width: 768px) {
  .meet-compact-card {
    .meet-header {
      .row {
        flex-direction: column;
        gap: 16px;
      }
    }

    .meet-body {
      .row {
        flex-direction: column;
      }
    }
  }
}
</style>
