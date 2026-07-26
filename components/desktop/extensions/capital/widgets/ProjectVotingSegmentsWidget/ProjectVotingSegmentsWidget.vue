<template lang="pug">
.voting-segments
  .banner.banner--info(v-if='!isVotingCompleted && !isVotingParticipant')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | В голосовании принимают участие только авторы и исполнители проекта.

  .voting-segments__skel(v-if='loading && !rows.length')
    .skel(v-for='i in 3', :key='i')

  EmptyState(
    v-else-if='!loading && !rows.length',
    :title='hasVoted ? "Вы уже проголосовали" : "Нет участников голосования"',
    :body='hasVoted ? "Ожидайте завершения голосования остальными участниками." : "Участники появятся после формирования сегментов с правом голоса."'
  )
    template(#icon)
      q-icon(:name='hasVoted ? "hourglass_empty" : "group"')

  template(v-else)
    .voting-segments__items
      .voting-segments__item(v-for='segment in rows', :key='segment.username')
        .voting-segments__row(
          :class='{ "voting-segments__row--clickable": isVotingCompleted }',
          @click='isVotingCompleted ? handleSegmentClick(segment.username) : undefined'
        )
          ExpandToggleButton(
            :expanded='!!expanded[segment.username]',
            :disable='!isResultStatus',
            @click='handleToggleExpand(segment.username)'
          )
            q-tooltip(v-if='!isResultStatus')
              | Результаты голосования каждого участника станут доступны после завершения голосования

          .voting-segments__main
            .voting-segments__name {{ segment.display_name }}
            .voting-segments__roles
              BaseBadge(v-if='segment.is_author', variant='info') Соавтор
              BaseBadge(v-if='segment.is_creator', variant='neutral') Исполнитель

          .voting-segments__side(@click.stop)
            //- До завершения: ввод голоса / ожидание / нельзя за себя
            template(v-if='!isVotingCompleted')
              .voting-segments__input(
                v-if='!hasVoted && !isCurrentUser(segment.username) && isVotingParticipant'
              )
                BaseInput(
                  :model-value='voteAmounts[segment.username]',
                  type='number',
                  :suffix='governSymbol',
                  mono,
                  @update:model-value='(v) => setVoteAmount(segment.username, v)'
                )
                q-slider(
                  v-model='voteAmounts[segment.username]',
                  :min='0',
                  :max='getSliderMax(segment.username)',
                  :step='0.0001',
                  color='primary',
                  track-color='grey-3',
                  :disable='hasVoted'
                )
              .voting-segments__hint(v-else-if='hasVoted')
                q-icon(name='hourglass_empty', size='16px')
                span Голосование ещё идёт
              .voting-segments__hint.voting-segments__hint--self(
                v-else-if='isCurrentUser(segment.username)'
              )
                q-icon(name='block', size='16px')
                span Нельзя голосовать за себя
              .voting-segments__hint(v-else)
                q-icon(name='visibility_off', size='16px')
                span Только для участников

            //- После завершения
            template(v-else)
              .voting-segments__hint(v-if='!isResultStatus')
                q-icon(name='hourglass_empty', size='16px')
                span Голосование ещё идёт
              .voting-segments__result(v-else-if='segment.is_votes_calculated === false')
                CalculateVotesButton(
                  :coopname='coopname',
                  :project-hash='projectHash',
                  :username='segment.username'
                )
              .voting-segments__result(v-else)
                span.t-mono.voting-segments__bonus
                  | {{ formatAsset2Digits(segment.voting_bonus || '0.0000 RUB') }}
                span.t-sm.t-muted Результат

        .voting-segments__details(
          v-if='isResultStatus && expanded[segment.username]'
        )
          slot(
            name='segment-content',
            :segment='segment',
            :segments-to-reload='segmentsToReload'
          )

    .voting-segments__foot(
      v-if='isVotingParticipant && !isVotingCompleted && !hasVoted'
    )
      .voting-segments__remain(v-if='maxVotingAmount > 0')
        span.t-sm.t-muted Осталось распределить
        span.t-mono {{ remainingLabel }}
      SubmitVoteButton(
        :coopname='coopname',
        :project-hash='projectHash',
        :votes='preparedVotes',
        :disabled='!isValidVoting',
        @vote-submitted='handleVoteSubmitted'
      )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useSegmentStore } from 'app/extensions/capital/entities/Segment/model';
import { SubmitVoteButton } from 'app/extensions/capital/features/Vote/SubmitVote';
import { CalculateVotesButton } from 'app/extensions/capital/features/Vote/CalculateVotes/ui';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { FailAlert } from 'src/shared/api';
import { Zeus } from '@coopenomics/sdk';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { EmptyState, BaseBadge, BaseInput } from 'src/shared/ui/base';

interface Props {
  projectHash: string;
  coopname: string;
  expanded: Record<string, boolean>;
  project?: IProject;
  currentUsername: string;
  segmentsToReload: Record<string, number>;
}

interface Emits {
  (e: 'toggle-expand', value: string): void;
  (e: 'segment-click', value: string): void;
  (e: 'data-loaded', value: string[]): void;
  (e: 'votes-changed', value: { projectHash: string; voter: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { info } = useSystemStore();
const segmentStore = useSegmentStore();

const loading = ref(false);
const segments = computed(() =>
  segmentStore.getSegmentsByProject(props.projectHash),
);
const rows = computed(() => segments.value?.items || []);
const voteAmounts = ref<Record<string, number>>({});
const hasVoted = ref(false);

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const maxVotingAmount = computed(() => {
  if (!props.project?.voting?.amounts?.active_voting_amount) return 0;
  const amount = props.project.voting.amounts.active_voting_amount;
  return parseFloat(amount.split(' ')[0]);
});

const totalDistributed = computed(() => {
  return Object.values(voteAmounts.value).reduce(
    (sum, amount) => sum + (amount || 0),
    0,
  );
});

const remaining = computed(() =>
  Math.max(0, maxVotingAmount.value - totalDistributed.value),
);

const remainingLabel = computed(() => {
  const formatted = formatAsset2Digits(
    `${remaining.value} ${governSymbol.value}`,
  );
  return formatted;
});

const getSliderMax = (username: string) => {
  const totalOtherVotes = Object.entries(voteAmounts.value)
    .filter(([u]) => u !== username)
    .reduce((sum, [, amount]) => sum + (amount || 0), 0);
  return Math.max(0, maxVotingAmount.value - totalOtherVotes);
};

const isVotingParticipant = computed(() => {
  return (
    segments.value?.items.some(
      (segment) => segment.username === props.currentUsername,
    ) || false
  );
});

const isVotingCompleted = computed(() => {
  if (!props.project) return false;
  const status = String(props.project.status);
  const voting = props.project.voting;
  if (status === Zeus.ProjectStatus.RESULT || status === 'RESULT') return true;
  if (voting && voting.votes_received === voting.total_voters) return true;
  return false;
});

const isResultStatus = computed(() => {
  if (!props.project) return false;
  const status = String(props.project.status);
  return status === Zeus.ProjectStatus.RESULT || status === 'RESULT';
});

const isValidVoting = computed(() => {
  if (hasVoted.value || !isVotingParticipant.value) return false;

  const votes = Object.entries(voteAmounts.value).filter(
    ([, amount]) => amount > 0,
  );
  const expectedVotes = (segments.value?.items.length || 0) - 1;
  if (votes.length !== expectedVotes) return false;

  // Допуск на погрешность float
  if (Math.abs(totalDistributed.value - maxVotingAmount.value) > 1e-6) {
    return false;
  }

  return true;
});

const preparedVotes = computed(() => {
  return Object.entries(voteAmounts.value)
    .filter(([, amount]) => amount > 0)
    .map(([username, amount]) => ({
      recipient: username,
      amount: `${amount.toFixed(info.symbols.root_govern_precision)} ${info.symbols.root_govern_symbol}`,
    }));
});

const isCurrentUser = (username: string) => {
  return username === props.currentUsername;
};

const setVoteAmount = (username: string, value: string | number) => {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  voteAmounts.value[username] = Number.isFinite(n) ? Math.max(0, n) : 0;
};

const loadSegments = async () => {
  loading.value = true;
  try {
    await segmentStore.loadSegments({
      filter: {
        coopname: props.coopname,
        project_hash: props.projectHash,
        has_vote: true,
      },
      options: {
        page: 1,
        limit: 1000,
        sortOrder: 'ASC',
      },
    });

    segments.value?.items.forEach((segment: any) => {
      if (!isCurrentUser(segment.username)) {
        voteAmounts.value[segment.username] = 0;
      }
    });

    const usernames = segments.value?.items.map((s: any) => s.username) || [];
    emit('data-loaded', usernames);
  } catch (error) {
    console.error('Ошибка при загрузке сегментов:', error);
    FailAlert('Не удалось загрузить участников голосования');
  } finally {
    loading.value = false;
  }
};

const handleSegmentClick = (username: string) => {
  emit('segment-click', username);
};

const handleToggleExpand = (username: string) => {
  emit('toggle-expand', username);
};

const handleVoteSubmitted = () => {
  hasVoted.value = true;
  Object.keys(voteAmounts.value).forEach((key) => {
    voteAmounts.value[key] = 0;
  });
  emit('votes-changed', {
    projectHash: props.projectHash,
    voter: props.currentUsername,
  });
};

onMounted(async () => {
  await loadSegments();
});

watch(
  () => props.projectHash,
  async () => {
    await loadSegments();
  },
);

watch(
  voteAmounts,
  (newAmounts) => {
    Object.keys(newAmounts).forEach((username) => {
      const max = getSliderMax(username);
      if (newAmounts[username] > max) {
        voteAmounts.value[username] = max;
      }
      if (newAmounts[username] < 0) {
        voteAmounts.value[username] = 0;
      }
    });
  },
  { deep: true },
);
</script>

<style lang="scss" scoped>
.voting-segments {
  min-width: 0;
}

.voting-segments__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-4) 0;

  .skel {
    height: 56px;
  }
}

.voting-segments__items {
  display: flex;
  flex-direction: column;
}

.voting-segments__item {
  border-bottom: 1px solid var(--p-line);

  &:last-child {
    border-bottom: none;
  }
}

.voting-segments__row {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-3) 0;
  min-width: 0;

  &--clickable {
    cursor: pointer;
  }
}

.voting-segments__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.voting-segments__name {
  font-weight: 500;
  font-size: var(--p-fs-body);
  color: var(--p-ink);
}

.voting-segments__roles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-1);
}

.voting-segments__side {
  flex: 0 1 220px;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: var(--p-2);
}

.voting-segments__input {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.voting-segments__hint {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-ink-3);
  font-size: var(--p-fs-sm, 12px);
  text-align: right;

  .q-icon {
    flex-shrink: 0;
  }

  &--self {
    color: var(--p-ink-2);
  }
}

.voting-segments__result {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-1);
}

.voting-segments__bonus {
  font-weight: 600;
  color: var(--p-pos);
}

.voting-segments__details {
  padding: 0 0 var(--p-3) var(--p-8);
}

.voting-segments__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--p-4);
  flex-wrap: wrap;
  padding-top: var(--p-4);
  margin-top: var(--p-2);
  border-top: 1px solid var(--p-line);
}

.voting-segments__remain {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  margin-right: auto;
}

@media (max-width: 640px) {
  .voting-segments__row {
    flex-wrap: wrap;
  }

  .voting-segments__side {
    flex: 1 1 100%;
    align-items: stretch;
    min-width: 0;
  }

  .voting-segments__hint {
    justify-content: flex-start;
    text-align: left;
  }

  .voting-segments__result {
    align-items: flex-start;
  }
}
</style>
