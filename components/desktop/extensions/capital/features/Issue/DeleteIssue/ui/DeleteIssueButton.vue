<template lang="pug">
div
  BaseButton(
    v-if='canDelete'
    variant='danger'
    size='sm'
    block
    :aria-label='$t("capital.deleteIssueButton.ariaLabel")'
    :loading='isSubmitting'
    @click='showDialog = true'
  ) {{ label }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("capital.deleteIssueButton.dialogTitle")',
    size='sm',
    @update:model-value='(v) => !v && close()'
  )
    Form.q-pa-sm(
      :handler-submit='confirmDelete'
      :is-submitting='isSubmitting'
      :button-cancel-txt='$t("capital.deleteIssueButton.cancel")'
      :button-submit-txt='$t("common.action.delete")'
      @cancel='close'
    )
      div(style='max-width: 360px')
        p {{ $t('capital.deleteIssueButton.confirmText') }}
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton } from 'src/shared/ui/base';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { useDeleteIssue } from '../model';
import { t, t as i18nT } from '../../../../i18n';

interface Props {
  issueHash: string;
  /** Для свободных задач может быть пустым — только сброс кэша списка */
  projectHash?: string;
  canDelete?: boolean;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  projectHash: '',
  canDelete: false,
  label: i18nT('common.action.delete'),
});

const emit = defineEmits<{
  deleted: [];
  close: [];
}>();

const { deleteIssue: deleteIssueAction } = useDeleteIssue();
const isSubmitting = ref(false);
const showDialog = ref(false);

const close = () => {
  showDialog.value = false;
  emit('close');
};

const confirmDelete = async () => {
  isSubmitting.value = true;
  try {
    await deleteIssueAction(
      { issue_hash: props.issueHash },
      props.projectHash,
    );
    SuccessAlert(t('capital.deleteIssueButton.success'));
    emit('deleted');
    close();
  } catch (e: unknown) {
    FailAlert(e, t('capital.deleteIssueButton.error'));
    close();
  } finally {
    isSubmitting.value = false;
  }
};
</script>
