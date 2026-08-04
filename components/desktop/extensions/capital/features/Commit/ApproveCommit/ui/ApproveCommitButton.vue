<template lang="pug">
BaseButton(
  variant='primary',
  :size='mini || isMobile ? "sm" : "md"',
  :loading='loading',
  @click.stop='handleApproveCommit'
) Одобрить
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useApproveCommit } from '../model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseButton } from 'src/shared/ui/base';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();
const props = defineProps<{
  mini?: boolean;
  commitHash: string;
}>();

const system = useSystemStore();
const { approveCommit } = useApproveCommit();

const loading = ref(false);

const handleApproveCommit = async () => {
  try {
    loading.value = true;

    const approveData = {
      commit_hash: props.commitHash,
      coopname: system.info.coopname,
    };

    await approveCommit(approveData);
    SuccessAlert('Коммит успешно одобрен');
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};
</script>
