<template lang="pug">
div
  BaseButton(
    v-if='canDelete'
    variant='danger'
    size='sm'
    block
    aria-label='Удалить задачу'
    :loading='isSubmitting'
    @click='showDialog = true'
  ) {{ label }}

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
import { BaseButton } from 'src/shared/ui/base';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { useDeleteIssue } from '../model';

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
