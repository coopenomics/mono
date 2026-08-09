<template lang="pug">
BaseButton(
  variant='secondary',
  size='sm',
  :loading='loading',
  @click='handleCalculateVotes'
) Рассчитать голоса
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCalculateVotes } from '../model';
import { FailAlert } from 'src/shared/api/alerts';
import { BaseButton } from 'src/shared/ui/base';

interface Props {
  coopname: string;
  projectHash: string;
  username: string;
}

const props = defineProps<Props>();

const { calculateVotes } = useCalculateVotes();
const loading = ref(false);

const handleCalculateVotes = async () => {
  loading.value = true;
  try {
    await calculateVotes({
      coopname: props.coopname,
      project_hash: props.projectHash,
      username: props.username,
    });
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
