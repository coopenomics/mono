<template lang="pug">
.segment-votes
  .segment-votes__skel(v-if='loading && !rows.length')
    .skel(v-for='i in 2', :key='i')

  EmptyState(
    v-else-if='!loading && !rows.length',
    title='Нет данных о голосах',
    body='Этот участник ещё не распределил голосующую сумму.'
  )
    template(#icon)
      q-icon(name='how_to_vote')

  .segment-votes__items(v-else)
    .segment-votes__item(v-for='vote in rows', :key='vote._id')
      span.segment-votes__name {{ vote.recipient_display_name }}
      span.t-mono.segment-votes__amount {{ formatAsset2Digits(vote.amount) }}
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useVoteStore } from 'app/extensions/capital/entities/Vote/model';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { EmptyState } from 'src/shared/ui/base';

interface Props {
  projectHash: string;
  coopname: string;
  segmentUsername: string;
  segmentDisplayName: string;
  forceReload?: number;
}

const props = defineProps<Props>();

const voteStore = useVoteStore();

const loading = ref(false);
const votes = ref<any>(null);
const rows = computed(() => votes.value?.items || []);

const loadVotes = async () => {
  loading.value = true;
  try {
    await voteStore.loadVotes({
      filter: {
        project_hash: props.projectHash,
        voter: props.segmentUsername,
      },
      options: {
        page: 1,
        limit: 100,
        sortOrder: 'ASC',
      },
    });

    votes.value = voteStore.votes;
  } catch (error) {
    console.error('Ошибка при загрузке голосов:', error);
    FailAlert('Не удалось загрузить голоса участника');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadVotes();
});

watch(
  () => props.segmentUsername,
  async () => {
    await loadVotes();
  },
);

watch(
  () => props.forceReload,
  async (newVal) => {
    if (newVal) {
      await loadVotes();
    }
  },
);

defineExpose({
  reloadVotes: loadVotes,
});
</script>

<style lang="scss" scoped>
.segment-votes {
  min-width: 0;
  background: var(--p-surface-2);
  border-radius: var(--p-r-sm);
  padding: var(--p-3) var(--p-4);
}

.segment-votes__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.segment-votes__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.segment-votes__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  min-height: 32px;
}

.segment-votes__name {
  font-weight: 500;
  color: var(--p-ink);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.segment-votes__amount {
  flex-shrink: 0;
  color: var(--p-pos);
  font-weight: 600;
}
</style>
