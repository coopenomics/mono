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
    .voting-segments__tools(v-if='canDistribute')
      span.t-sm.t-muted Распределите голосующую сумму между участниками — остаток должен стать нулевым
      .voting-segments__tools-actions
        BaseButton(variant='ghost', size='sm', @click='splitEqually')
          template(#icon-left)
            q-icon(name='balance', size='16px')
          | Поровну
        BaseButton(
          variant='ghost',
          size='sm',
          :disabled='distributedUnits === 0',
          @click='resetAll'
        )
          template(#icon-left)
            q-icon(name='restart_alt', size='16px')
          | Сбросить

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
                v-if='canDistribute && !isCurrentUser(segment.username)'
              )
                BaseInput(
                  :model-value='inputValue(segment.username)',
                  type='number',
                  :suffix='governSymbol',
                  mono,
                  @update:model-value='(v) => setVoteFromInput(segment.username, v)'
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

        //- Ползунок во всю ширину: шкала всегда равна голосующей сумме,
        //- поэтому чужие ручки не сдвигаются, когда двигаешь свою.
        .voting-segments__vote(
          v-if='canDistribute && !isCurrentUser(segment.username)',
          :class='{ "voting-segments__vote--locked": innerMaxUnits(segment.username) === 0 }',
          @click.stop
        )
          q-slider(
            :model-value='voteUnits[segment.username] || 0',
            :min='0',
            :max='poolUnits',
            :inner-max='innerMaxUnits(segment.username)',
            :step='1',
            color='primary',
            track-size='10px',
            thumb-size='22px',
            @update:model-value='(v) => setVoteUnits(segment.username, v ?? 0)'
          )
          .voting-segments__vote-foot
            span.t-sm.t-muted(v-if='innerMaxUnits(segment.username) === 0')
              | Запас исчерпан — уменьшите долю у других участников
            span.t-sm.t-muted(v-else) {{ sharePercent(segment.username) }}% голосующей суммы
            BaseButton(
              variant='ghost',
              size='sm',
              :disabled='remainingUnits === 0',
              @click='giveRemainder(segment.username)'
            )
              template(#icon-left)
                q-icon(name='add', size='16px')
              | Отдать остаток

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
      .voting-segments__remain(v-if='poolUnits > 0')
        .voting-segments__remain-head
          span.t-sm.t-muted Осталось распределить
          span.t-mono.voting-segments__remain-value(
            :class='{ "voting-segments__remain-value--done": remainingUnits === 0 }'
          ) {{ remainingLabel }}
        q-linear-progress.voting-segments__remain-bar(
          :value='distributedRatio',
          size='6px',
          color='primary',
          track-color='transparent',
          rounded
        )
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
import { EmptyState, BaseBadge, BaseInput, BaseButton } from 'src/shared/ui/base';

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
/**
 * Голоса в целых единицах символа (десятитысячных для RUB): суммы обязаны
 * сойтись с active_voting_amount ровно, а сложение долей во float на шаге
 * 0.0001 копит погрешность и контракт отбивает голос.
 */
const voteUnits = ref<Record<string, number>>({});
/**
 * Голос отдаётся один раз, и после перезагрузки страницы это должно быть видно:
 * признак приходит с сервера, а собственная отправка поднимает его сразу, не
 * дожидаясь следующего чтения списка.
 */
const voteSubmitted = ref(false);
const hasVoted = computed(
  () =>
    voteSubmitted.value ||
    !!segments.value?.items.some(
      (segment) => segment.username === props.currentUsername && segment.has_voted,
    ),
);

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const precision = computed(() => info.symbols?.root_govern_precision ?? 4);
const unitScale = computed(() => 10 ** precision.value);

const parseAssetToUnits = (raw?: string | null): number => {
  if (!raw) return 0;
  const [amount = '0'] = String(raw).trim().split(' ');
  const [intPart = '0', fracPart = ''] = amount.split('.');
  const frac = `${fracPart}${'0'.repeat(precision.value)}`.slice(
    0,
    precision.value,
  );
  return Number(intPart) * unitScale.value + Number(frac || '0');
};

const unitsToAssetString = (units: number) =>
  `${(units / unitScale.value).toFixed(precision.value)} ${governSymbol.value}`;

const formatUnits = (units: number) =>
  formatAsset2Digits(unitsToAssetString(units));

/** Вся сумма, которую голосующий обязан раздать другим участникам */
const poolUnits = computed(() =>
  parseAssetToUnits(props.project?.voting?.amounts?.active_voting_amount),
);

const distributedUnits = computed(() =>
  Object.values(voteUnits.value).reduce((sum, units) => sum + (units || 0), 0),
);

const remainingUnits = computed(() =>
  Math.max(0, poolUnits.value - distributedUnits.value),
);

const remainingLabel = computed(() => formatUnits(remainingUnits.value));

const distributedRatio = computed(() =>
  poolUnits.value > 0 ? distributedUnits.value / poolUnits.value : 0,
);

/**
 * Предел хода конкретного ползунка: своё значение плюс весь нераспределённый
 * остаток. Максимум шкалы при этом фиксирован (poolUnits) — именно поэтому
 * ручки остальных участников не двигаются, пока тянешь эту.
 */
const innerMaxUnits = (username: string) =>
  Math.min(poolUnits.value, (voteUnits.value[username] || 0) + remainingUnits.value);

const sharePercent = (username: string) => {
  if (poolUnits.value <= 0) return 0;
  return Math.round(((voteUnits.value[username] || 0) / poolUnits.value) * 100);
};

const inputValue = (username: string) =>
  (voteUnits.value[username] || 0) / unitScale.value;

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

  const votes = Object.entries(voteUnits.value).filter(
    ([username, units]) => units > 0 && !isCurrentUser(username),
  );
  const expectedVotes = (segments.value?.items.length || 0) - 1;
  if (votes.length !== expectedVotes) return false;

  // Суммы целые, поэтому сходятся точно — допуска на погрешность не нужно
  return remainingUnits.value === 0;
});

const preparedVotes = computed(() => {
  return Object.entries(voteUnits.value)
    .filter(([username, units]) => units > 0 && !isCurrentUser(username))
    .map(([username, units]) => ({
      recipient: username,
      amount: unitsToAssetString(units),
    }));
});

const isCurrentUser = (username: string) => {
  return username === props.currentUsername;
};

/** Голосующий раздаёт сумму — значит его собственная строка ползунка не нужна */
const canDistribute = computed(
  () =>
    !isVotingCompleted.value &&
    !hasVoted.value &&
    isVotingParticipant.value &&
    poolUnits.value > 0,
);

const setVoteUnits = (username: string, value: number) => {
  const units = Math.round(Number(value));
  if (!Number.isFinite(units)) return;
  voteUnits.value[username] = Math.max(
    0,
    Math.min(units, innerMaxUnits(username)),
  );
};

const setVoteFromInput = (username: string, value: string | number) => {
  const amount = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(amount)) {
    voteUnits.value[username] = 0;
    return;
  }
  setVoteUnits(username, Math.round(amount * unitScale.value));
};

/** Добить остаток одним кликом: мышью последние копейки не поймать */
const giveRemainder = (username: string) => {
  if (remainingUnits.value === 0) return;
  setVoteUnits(username, (voteUnits.value[username] || 0) + remainingUnits.value);
};

const splitEqually = () => {
  const targets = rows.value
    .map((segment: any) => segment.username)
    .filter((username: string) => !isCurrentUser(username));

  if (!targets.length || poolUnits.value <= 0) return;

  const base = Math.floor(poolUnits.value / targets.length);
  let rest = poolUnits.value - base * targets.length;

  targets.forEach((username: string) => {
    voteUnits.value[username] = base + (rest > 0 ? 1 : 0);
    if (rest > 0) rest -= 1;
  });
};

const resetAll = () => {
  Object.keys(voteUnits.value).forEach((username) => {
    voteUnits.value[username] = 0;
  });
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
        voteUnits.value[segment.username] = 0;
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
  voteSubmitted.value = true;
  resetAll();
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

// Голосующая сумма приходит с сервера и может обновиться под открытой формой —
// тогда набранное распределение уже не про этот пул, начинаем с нуля.
watch(poolUnits, () => {
  resetAll();
});
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

.voting-segments__tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--p-2);
  padding: var(--p-3) 0;
  border-bottom: 1px solid var(--p-line);
}

.voting-segments__tools-actions {
  display: flex;
  align-items: center;
  gap: var(--p-1);
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

.voting-segments__vote {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding: 0 var(--p-1) var(--p-3) var(--p-8);
  min-width: 0;

  //- Три зоны трека: отдано этому участнику (selection), доступный запас
  //- (inner) и уже роздано другим (track). Цвета — токенами, чтобы тема
  //- переключалась вместе с остальным интерфейсом.
  :deep(.q-slider__track) {
    background: var(--p-line-1);
  }

  :deep(.q-slider__inner) {
    background: var(--p-line-2);
  }

  :deep(.q-slider__thumb) {
    color: var(--p-primary);
  }

  :deep(.q-slider) {
    margin-left: 0;
    margin-right: var(--p-2);
  }

  //- Запас исчерпан: Quasar сам делает такой ползунок неперетаскиваемым,
  //- показываем это состоянием, а не молчанием.
  &--locked :deep(.q-slider__thumb) {
    opacity: 0.45;
  }
}

.voting-segments__vote-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
  min-width: 0;
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
  gap: var(--p-1);
  margin-right: auto;
  min-width: 240px;
  flex: 1 1 240px;
}

.voting-segments__remain-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-3);
}

.voting-segments__remain-value {
  font-weight: 600;
  color: var(--p-ink);

  &--done {
    color: var(--p-pos);
  }
}

.voting-segments__remain-bar {
  border-radius: var(--p-r-pill);
  background: var(--p-line-1);
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
