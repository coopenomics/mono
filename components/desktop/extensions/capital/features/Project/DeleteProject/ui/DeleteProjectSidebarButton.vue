<template lang="pug">
div
  q-btn(
    v-if='canDelete'
    flat
    color='negative'
    class='full-width q-mt-md'
    :label='$t("common.action.delete")'
    @click='showDialog = true'
    :loading='isSubmitting'
    size="sm"
  )

  BaseDialog(
    v-model='showDialog',
    :title='dialogTitle',
    size='sm',
    @update:model-value='(v) => !v && close()'
  )
    Form.q-pa-sm(
      :handler-submit='confirmDelete'
      :is-submitting='isSubmitting'
      :button-cancel-txt='$t("capital.deleteProjectSidebarButton.cancel")'
      :button-submit-txt='$t("common.action.delete")'
      @cancel='close'
    )
      div(style='max-width: 360px')
        p {{ confirmMessage }}
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { useDeleteProject } from '../model';
import { t } from '../../../../i18n';

interface Props {
  coopname: string;
  projectHash: string;
  canDelete?: boolean;
  /** Подпись сущности в тексте подтверждения (например «проект» или «компонент») */
  entityLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  canDelete: false,
  entityLabel: t('capital.deleteProjectSidebarButton.entityLabel'),
});

const emit = defineEmits<{
  deleted: [];
  close: [];
}>();

const { deleteProject: deleteProjectAction } = useDeleteProject();
const isSubmitting = ref(false);
const showDialog = ref(false);

const dialogTitle = computed(() => {
  const first = props.entityLabel.charAt(0).toUpperCase();
  const rest = props.entityLabel.slice(1);
  return t('capital.deleteProjectSidebarButton.dialogTitle', { firstLetter: first, rest });
});

const confirmMessage = computed(
  () => t('capital.deleteProjectSidebarButton.confirmText', { entityLabel: props.entityLabel }),
);

const close = () => {
  showDialog.value = false;
  emit('close');
};

const confirmDelete = async () => {
  isSubmitting.value = true;
  try {
    await deleteProjectAction({
      coopname: props.coopname,
      project_hash: props.projectHash,
    });
    SuccessAlert(t('capital.deleteProjectSidebarButton.success'));
    emit('deleted');
    close();
  } catch (e: unknown) {
    FailAlert(e, t('capital.deleteProjectSidebarButton.error'));
    close();
  } finally {
    isSubmitting.value = false;
  }
};
</script>
