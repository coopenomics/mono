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
    q-tooltip {{ $t('chairman.confirmApprovalButton.approveLabel') }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("chairman.confirmApprovalButton.title")',
    size='sm',
    @update:model-value='(v) => !v && close()'
  )
    Form.q-pa-sm(
      :handler-submit='confirmApproval',
      :is-submitting='isSubmitting',
      :button-cancel-txt='$t("chairman.confirmApprovalButton.cancelLabel")',
      :button-submit-txt='$t("chairman.confirmApprovalButton.approveLabel")',
      @cancel='close'
    )
      div(style='max-width: 300px')
        p {{ $t('chairman.confirmApprovalButton.confirmText') }}
</template>

<script lang="ts" setup>
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useConfirmApproval } from '../model';
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import type { IDocumentAggregate } from 'src/entities/Document/model/types';
import { t } from '../../../../i18n';

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
    SuccessAlert(t('chairman.confirmApprovalButton.successMessage'));
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
