<template lang="pug">
div
  q-btn(
    color='negative',
    icon='close',
    size='sm',
    flat,
    round,
    @click='showDialog = true',
    :loading='isSubmitting'
  )
    q-tooltip Отклонить

  BaseDialog(
    v-model='showDialog',
    title='Отклонение одобрения',
    size='md',
    @update:model-value='(v) => !v && close()'
  )
    Form.q-pa-sm(
      :handler-submit='declineApproval',
      :is-submitting='isSubmitting',
      :button-cancel-txt='"Отменить"',
      :button-submit-txt='"Отклонить"',
      @cancel='close'
    )
      div(style='max-width: 400px')
        p Вы уверены, что хотите отклонить одобрение?
        q-input.q-mt-md(
          v-model='reason',
          label='Причина отклонения',
          outlined,
          type='textarea',
          rows='3',
          :rules='[val => !!val || "Причина обязательна"]'
        )
</template>

<script lang="ts" setup>
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDeclineApproval } from '../model';
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';

interface Props {
  approvalHash: string;
  coopname: string;
}

const props = defineProps<Props>();

const { declineApproval: declineApprovalAction } = useDeclineApproval();
const isSubmitting = ref(false);
const showDialog = ref(false);
const reason = ref('');

const emit = defineEmits(['declined', 'close']);

const close = () => {
  showDialog.value = false;
  reason.value = '';
  emit('close');
};

const declineApproval = async () => {
  if (!reason.value.trim()) return;

  isSubmitting.value = true;
  try {
    await declineApprovalAction({
      approval_hash: props.approvalHash,
      coopname: props.coopname,
      reason: reason.value.trim(),
    });
    SuccessAlert('Одобрение отклонено');
    emit('declined');
    close();
  } catch (e: any) {
    FailAlert(`Возникла ошибка: ${e.message}`);
    close();
  } finally {
    isSubmitting.value = false;
  }
};
</script>
