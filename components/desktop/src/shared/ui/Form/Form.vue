<template lang="pug">
BaseForm.form-shim(@submit='handlerSubmit', :loading='isSubmitting')
  slot
  template(#footer)
    .form-shim__actions
      BaseButton(
        v-if='showCancel',
        variant='ghost',
        :size='size',
        @click='cancel'
      ) {{ buttonCancelTxt }}
      BaseButton(
        v-if='showSubmit',
        variant='primary',
        :size='size',
        type='submit',
        :loading='isSubmitting',
        :disabled='disabled'
      ) {{ buttonSubmitTxt }}
</template>

<script setup lang="ts">
import { BaseForm } from 'src/shared/ui/base/BaseForm';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const emit = defineEmits(['cancel']);

interface IFormProps {
  handlerSubmit: (e?: Event) => Promise<void>;
  isSubmitting?: boolean;
  showSubmit?: boolean;
  showCancel?: boolean;
  buttonSubmitTxt?: string;
  buttonCancelTxt?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

withDefaults(defineProps<IFormProps>(), {
  isSubmitting: false,
  showCancel: true,
  showSubmit: true,
  buttonSubmitTxt: 'Продолжить',
  buttonCancelTxt: 'Отменить',
  disabled: false,
  size: 'md',
});

const cancel = (): void => {
  emit('cancel');
};
</script>

<style scoped lang="scss">
.form-shim__actions {
  display: flex;
  gap: var(--p-2, 8px);
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
