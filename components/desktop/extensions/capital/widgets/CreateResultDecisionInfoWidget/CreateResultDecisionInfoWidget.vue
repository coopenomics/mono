<template lang="pug">
q-card(flat, style='margin-left: 40px; margin-top: 8px;')
  q-card-section.q-py-sm
    .text-subtitle1.text-grey-7 Детальная информация по результату createresult

  q-separator

  q-card-section
    .row.justify-center
      .col-md-6.col-12.q-pa-sm
        ColorCard(color='blue')
          .card-label Тип решения
          .card-value Решение о приросте благороста
      .col-md-6.col-12.q-pa-sm
        ColorCard(color='green')
          .card-label Статус
          .card-value Активно

    .row.justify-center.q-mt-md
      .col-12
        .text-body2.text-grey-7
          | Этот компонент отображает дополнительную информацию для решения типа createresult.
          | Фабрика решений успешно зарегистрировала и отобразила этот компонент.
</template>

<script lang="ts" setup>
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import type { IAgenda } from 'src/entities/Agenda/model';

interface Props {
  agenda: IAgenda;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>

.card-value {
  font-size: 16px;
  font-weight: 500;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}

.card-label {
  font-size: var(--p-fs-body);
  color: var(--p-ink-2);
  margin-bottom: var(--p-1);
}
</style>
