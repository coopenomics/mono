<template lang="pug">
BaseDialog(
  v-model='showDialog',
  :title='props.title',
  size='md',
  @update:model-value='onModelUpdate'
)
  template(v-if='$slots.title', #head)
    slot(name="title")
  Form(
    ref='formWrapperRef'
    :handler-submit='handleSubmit',
    :is-submitting='props.isSubmitting',
    :button-submit-txt='props.submitText',
    :button-cancel-txt='"Отмена"',
    :disabled='props.disabled',
    @cancel='clear'
  )
    slot(name="form-fields")
</template>

<script setup lang="ts">
import { ref, nextTick, watch, type ComponentPublicInstance } from 'vue';
import { BaseDialog } from '../base/BaseDialog';
import { Form } from '../Form';

const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([disabled]), ' +
  'textarea:not([disabled]), ' +
  '[contenteditable="true"]:not([contenteditable="false"])';

const props = withDefaults(defineProps<{
  title?: string;
  submitText?: string;
  dialogStyle?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
}>(), {
  title: '',
  isSubmitting: false,
  disabled: false,
});

const emit = defineEmits<{
  submit: [data: any];
  dialogClosed: [];
}>();

const showDialog = ref(false);
const formWrapperRef = ref<ComponentPublicInstance | null>(null);

function focusFirstFieldInForm(): void {
  const root = formWrapperRef.value?.$el as HTMLElement | undefined;
  if (!root?.querySelector) {
    return;
  }
  const el = root.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null;
  el?.focus?.();
}

function onModelUpdate(v: boolean): void {
  showDialog.value = v;
  if (!v) emit('dialogClosed');
}

watch(showDialog, (next) => {
  if (!next) return;
  nextTick(() => {
    focusFirstFieldInForm();
    nextTick(() => {
      const root = formWrapperRef.value?.$el as HTMLElement | undefined;
      if (root?.contains(document.activeElement)) {
        return;
      }
      focusFirstFieldInForm();
    });
  });
});

const openDialog = () => {
  showDialog.value = true;
};

const clear = () => {
  showDialog.value = false;
  emit('dialogClosed');
};

const handleSubmit = async (formData: any) => {
  emit('submit', formData);
};

defineExpose({
  openDialog,
  clear,
});
</script>
