<template lang="pug">
BaseButton(
  variant='primary',
  :loading='loading',
  :disabled='disabled',
  @click='handleSubmitVote'
) {{ $t('capital.submitVoteButton.label') }}
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSubmitVote } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseButton } from 'src/shared/ui/base';
import { t } from '../../../../i18n';

interface Props {
  coopname: string;
  projectHash: string;
  votes: Array<{
    recipient: string;
    amount: string;
  }>;
  disabled?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  voteSubmitted: [];
}>();

const { submitVoteAndUpdateStores } = useSubmitVote();
const loading = ref(false);

const handleSubmitVote = async () => {
  loading.value = true;
  try {
    await submitVoteAndUpdateStores({
      coopname: props.coopname,
      project_hash: props.projectHash,
      votes: props.votes,
    });

    SuccessAlert(t('capital.submitVoteButton.success'));
    emit('voteSubmitted');
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
