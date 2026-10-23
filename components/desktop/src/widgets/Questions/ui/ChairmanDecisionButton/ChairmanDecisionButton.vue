<template lang="pug">
//- Действие председателя по вопросу: отрицательный консенсус — отклонение,
//- иначе утверждение, доступное после принятия решения советом.
template(v-if='isChairman')
  BaseButton(v-if='rejected', variant='negative', size='sm', :loading='isProcessing', @click='emit("decline")')
    | {{ $t('questions.questionCard.decline') }}
  span.chairman-decision__approve(v-else)
    BaseButton(variant='primary', size='sm', :disabled='!approved', :loading='isProcessing', @click='emit("authorize")')
      | {{ $t('questions.questionCard.approve') }}
    q-tooltip(v-if='!approved') {{ $t('questions.questionCard.approveDisabledHint') }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import type { IAgenda } from 'src/entities/Agenda/model';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { isQuestionRejected } from '../../model';

/**
 * Кнопка председателя по вопросу повестки. Стоит в строке вопроса, в подвале
 * панели подробностей и на странице вопроса.
 */
const props = withDefaults(defineProps<{ agenda: IAgenda; isProcessing?: boolean }>(), { isProcessing: false });
const emit = defineEmits<{ authorize: []; decline: [] }>();

const session = useSessionStore();
const isChairman = computed(() => session.isChairman);
const rejected = computed(() => isQuestionRejected(props.agenda));
const approved = computed(() => Boolean(props.agenda.table.approved));
</script>

<style scoped>
.chairman-decision__approve {
  display: inline-flex;
}
</style>
