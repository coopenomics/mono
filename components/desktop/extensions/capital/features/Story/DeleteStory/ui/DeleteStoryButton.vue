<template lang="pug">
div
  q-btn(
    color='grey',
    flat,
    dense,
    clickable,
    size='sm',
    @click='showDialog = true',
    :loading='isSubmitting'
  )
    q-icon(name='delete')

  BaseDialog(
    v-model='showDialog',
    :title='$t("capital.deleteStoryButton.dialogTitle")',
    size='sm',
    @update:model-value='(v) => !v && close()'
  )
    Form.q-pa-sm(
      :handler-submit='deleteStory',
      :is-submitting='isSubmitting',
      :button-cancel-txt='$t("capital.deleteStoryButton.cancel")',
      :button-submit-txt='$t("common.action.delete")',
      @cancel='close'
    )
      div(style='max-width: 300px')
        p {{ $t('capital.deleteStoryButton.confirmText') }}
</template>

<script lang="ts" setup>
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDeleteStory } from '../model';
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { t } from '../../../../i18n';

const { deleteStory: deleteStoryAction } = useDeleteStory();
const isSubmitting = ref(false);
const showDialog = ref(false);

const emit = defineEmits(['deleted', 'close']);

const props = defineProps({
  storyHash: {
    type: String,
    required: true,
  },
});

const close = () => {
  showDialog.value = false;
  emit('close');
};

const deleteStory = async () => {
  isSubmitting.value = true;
  try {
    await deleteStoryAction({ story_hash: props.storyHash });
    SuccessAlert(t('capital.deleteStoryButton.success'));
    emit('deleted');
    close();
  } catch (e: any) {
    FailAlert(e, t('capital.deleteStoryButton.error'));
    close();
  } finally {
    isSubmitting.value = false;
  }
};
</script>
