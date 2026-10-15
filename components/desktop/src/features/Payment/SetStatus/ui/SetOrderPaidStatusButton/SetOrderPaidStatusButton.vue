<template lang="pug">
BaseButton(variant="primary" size="sm" @click="showDialog=true")
  template(#icon-left)
    q-icon(name="fa-regular fa-square-check" size="14px").q-mr-xs
  | {{ $t('common.action.confirm') }}

BaseDialog(
  v-model='showDialog',
  :title='$t("payment.setOrderPaidStatusButton.title")',
  size='sm',
  @update:model-value='(v) => !v && close()'
)
  Form(
    :handler-submit="setPaid"
    :is-submitting="isSubmitting"
    :button-cancel-txt="$t('payment.setOrderPaidStatusButton.cancel')"
    :button-submit-txt="$t('payment.setOrderPaidStatusButton.confirm')"
    @cancel="close"
  )
    p {{ $t('payment.setOrderPaidStatusButton.confirmText') }}
</template>
<script lang="ts" setup>
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSetStatus } from '../../model';
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { Form } from 'src/shared/ui/Form';
import { t } from 'src/shared/i18n';

const {setPaidStatus} = useSetStatus()
const isSubmitting = ref(false)
const showDialog = ref(false)

const emit = defineEmits(['close'])

const props = defineProps({
  id: {
    type: String,
    required: true
  },
})

const close = () => {
  showDialog.value = false
  emit('close')
}

const setPaid = async() => {
  isSubmitting.value = true
  try {
    await setPaidStatus(props.id)
    SuccessAlert(t('payment.setOrderPaidStatusButton.updateSuccess'))
    close()
  } catch(e: any) {
    FailAlert(t('payment.setOrderPaidStatusButton.updateError', { message: e.message }))
    close()
  } finally {
    isSubmitting.value = false
  }
}
</script>
