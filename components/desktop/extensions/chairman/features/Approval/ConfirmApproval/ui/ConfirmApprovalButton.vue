<template lang="pug">
div
  q-btn(
    color='positive',
    icon='check',
    size='sm',
    flat,
    round,
    @click='showDialog = true',
    :loading='isSubmitting'
  )
    q-tooltip Одобрить

  BaseDialog(
    v-model='showDialog',
    title='Подтверждение одобрения',
    size='sm',
    @update:model-value='(v) => !v && close()'
  )
    Form.q-pa-sm(
      :handler-submit='confirmApproval',
      :is-submitting='isSubmitting',
      :button-cancel-txt='"Отменить"',
      :button-submit-txt='"Одобрить"',
      @cancel='close'
    )
      div(style='max-width: 300px')
        p Вы уверены, что хотите одобрить документ?
</template>

<script lang="ts" setup>
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useConfirmApproval } from '../model';
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import type { IDocumentAggregate } from 'src/entities/Document/model/types';

interface Props {
  approvalHash: string;
  coopname: string;
  approvedDocument: IDocumentAggregate;
}

const props = defineProps<Props>();

const { confirmApproval: confirmApprovalAction } = useConfirmApproval();
const isSubmitting = ref(false);
const showDialog = ref(false);

const emit = defineEmits(['confirmed', 'close']);

const close = () => {
  showDialog.value = false;
  emit('close');
};

const confirmApproval = async () => {
  isSubmitting.value = true;
  try {
    await confirmApprovalAction(
      props.coopname,
      props.approvalHash,
      props.approvedDocument,
    );
    SuccessAlert('Одобрение подтверждено');
    emit('confirmed');
    close();
  } catch (e: any) {
    FailAlert(e);
    close();
  } finally {
    isSubmitting.value = false;
  }
};
</script>
