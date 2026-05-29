<template lang="pug">
div
  q-btn(
    v-if='canDelete'
    flat
    size="sm"
    color='negative'
    class='full-width q-mt-md'
    :label='label'
    @click='showDialog = true'
    :loading='isSubmitting'
  )

  BaseDialog(
    v-model='showDialog',
    title='Удаление задачи',
    size='sm',
    @update:model-value='(v) => !v && close()'
  )
    Form.q-pa-sm(
      :handler-submit='confirmDelete'
      :is-submitting='isSubmitting'
      :button-cancel-txt='"Отменить"'
      :button-submit-txt='"Удалить"'
      @cancel='close'
    )
      div(style='max-width: 360px')
        p Вы уверены, что хотите удалить задачу?
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { useDeleteIssue } from '../model';

interface Props {
  issueHash: string;
  projectHash: string;
  canDelete?: boolean;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  canDelete: false,
  label: 'Удалить',
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
    SuccessAlert('Задача удалена');
    emit('deleted');
    close();
  } catch (e: unknown) {
    FailAlert(e, 'Возникла ошибка при удалении');
    close();
  } finally {
    isSubmitting.value = false;
  }
};
</script>
