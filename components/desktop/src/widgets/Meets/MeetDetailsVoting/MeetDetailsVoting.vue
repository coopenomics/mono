<template lang="pug">
//- Голосование: вопросы повестки с переключателем «За / Против / Воздержался».
//- Кнопка и счётчик отмеченных — в прилипшем подвале. Кто не голосует или уже
//- проголосовал, видит те же вопросы для чтения: с пояснением или своим ответом.
section.meet-voting
  .meet-voting__head {{ $t('meet.meetDetailsVoting.title') }}

  .banner.banner--info.meet-voting__note(v-if='noVote')
    .banner__icon
      q-icon(name='groups', size='20px')
    .banner__body {{ $t(noVote.key, noVote.params) }}

  .meet-voting__voted(v-else-if='isVoted')
    q-icon(name='how_to_vote', size='18px')
    span {{ $t('meet.meetDetailsVoting.votedAt') }}

  ol.meet-voting__items
    MeetQuestion(
      v-for='(item, index) in meetAgendaItems',
      :key='item.id',
      :number='index + 1',
      :question='item'
    )
      BaseSegmented(
        v-if='canVoteNow',
        :model-value='votes[index] ?? null',
        @update:model-value='(value) => setVote(index, value)',
        :options='voteOptions',
        :aria-label='$t("meet.meetDetailsVoting.yourVoteLabel")'
      )
      BaseBadge(v-else-if='myVote(item)', :variant='voteVariant(myVote(item))')
        | {{ $t('meet.meetDetailsVoting.yourVote', { vote: voteLabel(myVote(item)) }) }}

  .meet-voting__foot(v-if='canVoteNow')
    span.meet-voting__count {{ $t('meet.meetDetailsVoting.selectedCount', { selected: selectedCount, total: meetAgendaItems.length }) }}
    BaseButton(
      variant='primary',
      :loading='isVoting',
      :disabled='!allVotesSelected',
      @click='submitVote'
    ) {{ $t('meet.meetDetailsVoting.submit') }}
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { BaseBadge, BaseButton, BaseSegmented } from 'src/shared/ui/base';
import { MeetQuestion } from 'src/widgets/Meets/MeetQuestion';
import { noVoteMessage, type IMeet } from 'src/entities/Meet';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { signDocument } from 'src/shared/lib/document';
import {
  useVoteOnMeet,
  type IVoteOnMeetInput,
} from 'src/features/Meet/VoteOnMeet';
import { t } from 'src/shared/i18n';

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

// Право пайщика на собрании считает контроллер; без входа признаков нет — форма как прежде.
const noVote = computed(() => noVoteMessage(props.meet));

const isVoting = ref(false);

type Vote = 'for' | 'against' | 'abstained';

const isVoted = computed(() => Boolean(props.meet?.processing?.isVoted));
// Переключатели — только у того, кто голосует и ещё не голосовал.
const canVoteNow = computed(() => !noVote.value && !isVoted.value);

const voteOptions = computed(() => [
  { value: 'for', label: t('meet.meetDetailsVoting.forOption') },
  { value: 'against', label: t('meet.meetDetailsVoting.againstOption') },
  { value: 'abstained', label: t('meet.meetDetailsVoting.abstainOption') },
]);

const selectedCount = computed(
  () => meetAgendaItems.value.filter((_, index) => votes.value[index] !== undefined).length,
);

function setVote(index: number, value: string | number | null | undefined): void {
  if (value === 'for' || value === 'against' || value === 'abstained') votes.value[index] = value;
}

// Ответ вошедшего по вопросу — из списков проголосовавших в цепи.
function myVote(question: { voters_for?: string[]; voters_against?: string[]; voters_abstained?: string[] }): Vote | null {
  const me = sessionStore.username;
  if (question.voters_for?.includes(me)) return 'for';
  if (question.voters_against?.includes(me)) return 'against';
  if (question.voters_abstained?.includes(me)) return 'abstained';
  return null;
}

function voteLabel(vote: Vote | null): string {
  if (vote === 'for') return t('meet.meetDetailsVoting.forOption');
  if (vote === 'against') return t('meet.meetDetailsVoting.againstOption');
  return t('meet.meetDetailsVoting.abstainOption');
}

function voteVariant(vote: Vote | null): 'pos' | 'neg' | 'neutral' {
  if (vote === 'for') return 'pos';
  if (vote === 'against') return 'neg';
  return 'neutral';
}

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
    SuccessAlert(t('meet.meetDetailsVoting.voteSuccess'));
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
  padding: var(--p-5, 20px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
}

.meet-voting__head {
  margin-bottom: var(--p-4, 16px);
  font-size: var(--p-fs-h2, 18px);
  font-weight: 700;
  color: var(--p-ink);
}

.meet-voting__note {
  margin-bottom: var(--p-4, 16px);
}

// После голоса — одна строка, а не карточка в карточке.
.meet-voting__voted {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  margin-bottom: var(--p-4, 16px);
  font-weight: 600;
  color: var(--p-pos);
}

.meet-voting__items {
  margin: 0;
  padding: 0;
  list-style: none;
}

// Подвал прилипает к низу экрана: счётчик и кнопка видны без прокрутки.
.meet-voting__foot {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-4, 16px);
  margin: var(--p-5, 20px) calc(-1 * var(--p-5, 20px)) calc(-1 * var(--p-5, 20px));
  padding: var(--p-4, 16px) var(--p-5, 20px);
  background: var(--p-surface);
  border-top: 1px solid var(--p-line);
  border-radius: 0 0 var(--p-r-lg, 16px) var(--p-r-lg, 16px);
}

.meet-voting__count {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-3);
}
</style>
