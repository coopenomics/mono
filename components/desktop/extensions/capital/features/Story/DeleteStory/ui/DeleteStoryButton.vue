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
    title='Удаление',
    size='sm',
    @update:model-value='(v) => !v && close()'
  )
    Form.q-pa-sm(
      :handler-submit='deleteStory',
      :is-submitting='isSubmitting',
      :button-cancel-txt='"Отменить"',
      :button-submit-txt='"Удалить"',
      @cancel='close'
    )
      div(style='max-width: 300px')
        p Вы уверены, что хотите удалить?
</template>

<script lang="ts" setup>
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDeleteStory } from '../model';
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';

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
    SuccessAlert('Успешно удалено');
    emit('deleted');
    close();
  } catch (e: any) {
    FailAlert(e, 'Возникла ошибка при удалении');
    close();
  } finally {
    isSubmitting.value = false;
  }
};
</script>
