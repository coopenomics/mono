<template lang="pug">
//- Дополнение к вопросу о приёме пайщика: что заявитель рассказал о себе.
//- Совет читает это рядом с заявлением, прежде чем голосовать.
.participant-intake-info(v-if='username')
  CandidateIntakeAnswers(:username='username', title='Сведения от заявителя')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IAgenda } from 'src/entities/Agenda/model';
import { CandidateIntakeAnswers } from 'src/entities/Registration';

const props = defineProps<{
  agenda: IAgenda;
}>();

const username = computed(() => props.agenda.table?.username ?? '');
</script>

<style scoped>
/* Отступы задаёт контейнер подробностей вопроса. */
.participant-intake-info {
  padding: 0;
}
</style>
