<template lang="pug">
//- Действие председателя по вопросу: отрицательный консенсус — отклонение,
//- иначе утверждение, доступное после принятия решения советом.
template(v-if='isChairman')
  BaseButton(v-if='rejected', variant='negative', size='sm', :loading='isProcessing', @click='openDecline')
    | {{ $t('questions.questionCard.decline') }}
  span.chairman-decision__approve(v-else)
    BaseButton(variant='primary', size='sm', :disabled='!approved', :loading='isProcessing', @click='emit("authorize")')
      | {{ $t('questions.questionCard.approve') }}
    q-tooltip(v-if='!approved') {{ $t('questions.questionCard.approveDisabledHint') }}
  //- Отклонение — с необязательным пояснением председателя: оно хранится на
  //- узле (в цепь не пишется) и показывается тем, кого касается решение, —
  //- например, преподавателю в отчёте (решение владельца 25.11.2026).
  BaseDialog(v-model='declineOpen', :title='$t("questions.questionCard.declineDialogTitle")', size='md')
    BaseInput(
      v-model='reason',
      :label='$t("questions.questionCard.declineReasonLabel")',
      :hint='$t("questions.questionCard.declineReasonHint")',
      type='textarea',
      autogrow,
      maxlength='1000',
      autofocus
    )
    template(#footer)
      BaseButton(variant='ghost', @click='declineOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='negative', @click='confirmDecline') {{ $t('questions.questionCard.decline') }}
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import type { IAgenda } from 'src/entities/Agenda/model';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog, BaseInput } from 'src/shared/ui/base';
import { isQuestionRejected } from '../../model';

/**
 * Кнопка председателя по вопросу повестки. Стоит в строке вопроса, в подвале
 * панели подробностей и на странице вопроса.
 */
const props = withDefaults(defineProps<{ agenda: IAgenda; isProcessing?: boolean }>(), { isProcessing: false });
/** decline — с пояснением председателя; пустая строка — без пояснения. */
const emit = defineEmits<{ authorize: []; decline: [reason: string] }>();

const session = useSessionStore();
const isChairman = computed(() => session.isChairman);
const rejected = computed(() => isQuestionRejected(props.agenda));
const approved = computed(() => Boolean(props.agenda.table.approved));

const declineOpen = ref(false);
const reason = ref('');
function openDecline(): void {
  reason.value = '';
  declineOpen.value = true;
}
function confirmDecline(): void {
  declineOpen.value = false;
  emit('decline', reason.value.trim());
}
</script>

<style scoped>
.chairman-decision__approve {
  display: inline-flex;
}
</style>
