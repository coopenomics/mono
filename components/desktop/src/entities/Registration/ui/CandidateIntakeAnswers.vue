<template lang="pug">
//- Что заявитель сообщил о себе при вступлении. Грузит сам по имени аккаунта;
//- когда сообщать было нечего (анкет не было) — не показывает ничего, даже
//- заголовка.
.candidate-intake(v-if='(failed && !quiet) || hasContent')
  .candidate-intake__title.t-sm.t-muted {{ title }}
  .candidate-intake__error.t-sm.t-muted(v-if='failed') Сведения заявителя недоступны
  template(v-else)
    DataRow(v-if='programTitle', label='Программа при вступлении', :value='programTitle')
    IntakeAnswersView(v-if='intake?.answers.length', :answers='intake.answers')
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { api } from '../api';
import { registrationProgramTitle, type ICandidateIntake } from '../model';
import IntakeAnswersView from './IntakeAnswersView.vue';

const props = withDefaults(
  defineProps<{
    username: string;
    title?: string;
    /** Показывать ли программу вступления рядом с ответами. */
    withProgram?: boolean;
    /** Не сообщать о недоступности сведений — там, где блок лишь дополнение. */
    quiet?: boolean;
  }>(),
  { title: 'Сведения при вступлении', withProgram: false, quiet: false },
);

const intake = ref<ICandidateIntake | null>(null);
const failed = ref(false);

const programTitle = computed(() =>
  props.withProgram ? registrationProgramTitle(intake.value?.program_key) : '',
);
const hasContent = computed(() => Boolean(intake.value?.answers.length) || Boolean(programTitle.value));

watch(
  () => props.username,
  async (username) => {
    intake.value = null;
    failed.value = false;
    if (!username) return;
    try {
      const loaded = await api.getCandidateIntake(username);
      if (username === props.username) intake.value = loaded;
    } catch (e) {
      // Сведения — дополнение к карточке: их недоступность не должна ронять
      // ни вопрос повестки, ни строку реестра.
      console.error('Не удалось загрузить сведения заявителя:', e);
      if (username === props.username) failed.value = true;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.candidate-intake__title {
  margin-bottom: var(--p-2, 8px);
}
</style>
