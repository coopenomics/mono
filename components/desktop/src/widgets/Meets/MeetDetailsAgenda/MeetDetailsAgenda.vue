<template lang="pug">
//- Повестка собрания: вопросы и проекты решений. Пояснение к собранию — над
//- списком. Подтверждение уведомления — действие шага, оно стоит в шапке.
section.meet-agenda
  .meet-agenda__head {{ $t('meet.meetDetailsAgenda.title') }}

  .meet-agenda__intro(v-if='meetDetailsHtml', v-html='meetDetailsHtml')

  ol.meet-agenda__items
    MeetQuestion(
      v-for='(item, index) in meetAgendaItems',
      :key='index',
      :number='index + 1',
      :question='item'
    )
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IMeet } from 'src/entities/Meet';
import { parseLinks } from 'src/shared/lib/utils';
import { MeetQuestion } from 'src/widgets/Meets/MeetQuestion';

const props = defineProps<{
  meet: IMeet;
}>();

const meetDetailsHtml = computed(() => {
  const raw = props.meet?.pre?.details?.trim();
  return raw ? parseLinks(raw) : '';
});

const meetAgendaItems = computed(() => props.meet?.processing?.questions || []);
</script>

<style lang="scss" scoped>
.meet-agenda {
  padding: var(--p-5, 20px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
}

.meet-agenda__head {
  margin-bottom: var(--p-4, 16px);
  font-size: var(--p-fs-h2, 18px);
  font-weight: 700;
  color: var(--p-ink);
}

.meet-agenda__intro {
  margin-bottom: var(--p-4, 16px);
  font-size: var(--p-fs-body, 14px);
  line-height: 1.5;
  color: var(--p-ink-2);
}

.meet-agenda__items {
  margin: 0;
  padding: 0;
  list-style: none;
}

</style>
