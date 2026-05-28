<template lang="pug">
.meet-voting
  .meet-voting__voted(v-if='meet?.processing?.isVoted')
    .meet-voting__voted-icon(aria-hidden='true')
      q-icon(name='how_to_vote', size='24px')
    .meet-voting__voted-text Вы уже приняли участие в голосовании.

  template(v-else)
    .meet-voting__head
      q-icon(name='how_to_vote', size='18px')
      span.meet-voting__title Голосование

    .meet-voting__items
      .meet-vote-card(
        v-for='(item, index) in meetAgendaItems',
        :key='index'
      )
        .meet-vote-card__head
          AgendaNumberAvatar(:number='index + 1')
          span.meet-vote-card__title {{ item.title }}

        .meet-vote-card__context(
          v-if='item.context',
          v-html='parseLinks(item.context)'
        )

        .meet-vote-card__decision
          span.meet-vote-card__decision-label Проект решения
          span.meet-vote-card__decision-text {{ item.decision }}

        .meet-vote-card__prompt Ваш голос
        .meet-vote-card__options
          label.vote-option.vote-option--for
            q-radio(
              v-model='votes[index]',
              val='for',
              color='positive',
              size='md',
              label='ЗА'
            )
          label.vote-option.vote-option--against
            q-radio(
              v-model='votes[index]',
              val='against',
              color='negative',
              size='md',
              label='ПРОТИВ'
            )
          label.vote-option.vote-option--abstain
            q-radio(
              v-model='votes[index]',
              val='abstained',
              color='grey',
              size='md',
              label='ВОЗДЕРЖАЛСЯ'
            )

    .meet-voting__foot
      BaseButton(
        variant='primary',
        size='lg',
        :loading='isVoting',
        :disabled='!allVotesSelected',
        @click='submitVote'
      )
        span Голосовать
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { AgendaNumberAvatar } from 'src/shared/ui/AgendaNumberAvatar';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import type { IMeet } from 'src/entities/Meet';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSignDocument } from 'src/shared/lib/document';
import {
  useVoteOnMeet,
  type IVoteOnMeetInput,
} from 'src/features/Meet/VoteOnMeet';
import { parseLinks } from 'src/shared/lib/utils';

const props = defineProps<{
  meet: IMeet;
  coopname: string;
  meetHash: string;
}>();

const {
  votes,
  meetAgendaItems,
  allVotesSelected,
  setMeet,
  voteOnMeet,
  resetVotes,
  generateBallot,
} = useVoteOnMeet();

const sessionStore = useSessionStore();
const { signDocument } = useSignDocument();

const isVoting = ref(false);

// Устанавливаем собрание из пропсов при монтировании
onMounted(() => {
  setMeet(props.meet);
  resetVotes();
});

// Очищаем ссылку на собрание при размонтировании
onUnmounted(() => {
  setMeet(null);
  resetVotes();
});

const submitVote = async () => {
  if (!allVotesSelected.value) return;

  isVoting.value = true;
  try {
    const generatedBallot = await generateBallot({
      coopname: props.coopname,
      username: sessionStore.username,
      meet_hash: props.meetHash,
      answers: meetAgendaItems.value.map((question, index) => ({
        id: question.id.toString(),
        number: question.number.toString(),
        vote: votes.value[index],
      })),
    });

    const signedBallot = await signDocument(
      generatedBallot,
      sessionStore.username,
    );

    const vote: IVoteOnMeetInput = {
      coopname: props.coopname,
      hash: props.meetHash,
      ballot: signedBallot,
      username: sessionStore.username,
      votes: meetAgendaItems.value.map((item, index) => ({
        question_id: item.id,
        vote: votes.value[index],
      })),
    };

    await voteOnMeet(vote);
    SuccessAlert('Ваш голос успешно отправлен');
  } catch (error: any) {
    console.error(error);
    FailAlert(error);
  } finally {
    isVoting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.meet-voting {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  padding: var(--p-5, 20px);
}

/* Уже проголосовали — спокойный позитивный баннер */
.meet-voting__voted {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  padding: var(--p-4, 16px);
  border-radius: var(--p-r-md, 12px);
  background: var(--p-pos-soft);
}
.meet-voting__voted-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-surface);
  color: var(--p-pos);
}
.meet-voting__voted-text {
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  line-height: 1.4;
  color: var(--p-ink-1);
}

.meet-voting__head {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  color: var(--p-ink-2);
  margin-bottom: var(--p-4, 16px);
}
.meet-voting__title {
  font-size: var(--p-fs-h2, 18px);
  font-weight: 600;
  color: var(--p-ink);
}

.meet-voting__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.meet-vote-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.meet-vote-card__head {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3, 12px);
}
.meet-vote-card__title {
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  line-height: 1.4;
  color: var(--p-ink-1);
  padding-top: 6px;
  overflow-wrap: anywhere;
}
.meet-vote-card__context {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.5;
  color: var(--p-ink-2);
  overflow-wrap: anywhere;

  :deep(a) {
    color: var(--p-primary);
    word-break: break-word;
  }
}

/* Проект решения — спокойный акцент */
.meet-vote-card__decision {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-primary-soft);
}
.meet-vote-card__decision-label {
  font-size: var(--p-fs-meta, 12px);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-primary);
}
.meet-vote-card__decision-text {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.45;
  color: var(--p-ink-1);
  overflow-wrap: anywhere;
}

.meet-vote-card__prompt {
  font-size: var(--p-fs-meta, 12px);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}

.meet-vote-card__options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--p-2, 8px);
}
@media (max-width: 599px) {
  .meet-vote-card__options {
    grid-template-columns: 1fr;
  }
}

.vote-option {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: var(--p-2, 8px) var(--p-3, 12px);
  border-radius: var(--p-r-sm, 8px);
  border: 1px solid var(--p-line);
  background: var(--p-surface-2);
  cursor: pointer;
  transition: border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.vote-option:hover {
  border-color: var(--p-line-2);
}
.vote-option--for:hover {
  border-color: var(--p-pos);
}
.vote-option--against:hover {
  border-color: var(--p-neg);
}

:deep(.vote-option .q-radio) {
  width: 100%;
  justify-content: flex-start;
}
:deep(.vote-option .q-radio__label) {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--p-ink-1);
}

.meet-voting__foot {
  display: flex;
  justify-content: center;
  margin-top: var(--p-5, 20px);
}
</style>
