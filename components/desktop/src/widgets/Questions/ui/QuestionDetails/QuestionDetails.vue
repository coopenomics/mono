<template lang="pug">
//- Подробности вопроса: заголовок и заявитель, сведения по вопросу от
//- приложения (их задаёт обработчик типа решения), ниже документы пакета.
.question-details
  .question-details__title {{ title }}
  .question-details__applicant {{ applicant }}

  component.q-mt-md(v-if='infoComponent', :is='infoComponent', :agenda='agenda')

  ComplexDocument.q-mt-md(:documents='agenda.documents', collapsible)
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import type { IAgenda } from 'src/entities/Agenda/model';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { applicantNameOf, questionTitleOf } from '../../model';

/**
 * Содержимое вопроса повестки. Одно и то же в правой панели и на отдельной
 * странице вопроса.
 */
const props = defineProps<{ agenda: IAgenda }>();

const title = computed(() => questionTitleOf(props.agenda));
const applicant = computed(() => applicantNameOf(props.agenda));

// Сведения по вопросу показывает компонент, который приложение назвало для типа решения.
const infoComponent = computed(() => {
  const type = props.agenda.table?.type;
  return type ? decisionFactory.getInfoComponent(type) : null;
});
</script>

<style scoped>
.question-details__title {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  line-height: 1.4;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}
.question-details__applicant {
  margin-top: 2px;
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
}
</style>
