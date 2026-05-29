<template lang="pug">
div
  q-btn(
    color='negative',
    @click='showDialog = true',
    :loading='loading',
    label="Отклонить",
    :size='mini ? "sm" : "md"',
    :dense="isMobile"
  )

  BaseDialog(
    v-model='showDialog',
    title='Отклонить коммит',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    Form.q-pa-md(
      :handler-submit='handleDeclineCommit',
      :is-submitting='isSubmitting',
      :button-submit-txt='"Отклонить"',
      :button-cancel-txt='"Отмена"',
      @cancel='clear'
    )
      q-input(
        v-model='reason',
        outline
        label='Причина отклонения',
        :rules='[(val) => !!val || "Причина обязательна"]',
        autocomplete='off'
        placeholder='Укажите причину отклонения...'
        type='textarea'
        rows='3'
      )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDeclineCommit } from '../model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();
const props = defineProps<{
  mini?: boolean;
  commitHash: string;
}>();

const system = useSystemStore();
const { declineCommit } = useDeclineCommit();

const loading = ref(false);
const showDialog = ref(false);
const isSubmitting = ref(false);
const reason = ref('');

const clear = () => {
  showDialog.value = false;
  reason.value = '';
};

const handleDeclineCommit = async () => {
  try {
    isSubmitting.value = true;

    const declineData = {
      commit_hash: props.commitHash,
      coopname: system.info.coopname,
      reason: reason.value,
    };

    await declineCommit(declineData);
    SuccessAlert('Коммит успешно отклонен');
    clear();
  } catch (error) {
    FailAlert(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
