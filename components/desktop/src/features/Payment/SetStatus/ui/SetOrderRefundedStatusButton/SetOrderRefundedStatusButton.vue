<template lang="pug">
BaseButton(variant="danger" size="sm" @click="showDialog=true")
  template(#icon-left)
    q-icon(name="cancel" size="14px").q-mr-xs
  | {{ $t('payment.setOrderRefundedStatusButton.title') }}

BaseDialog(
  v-model='showDialog',
  :title='$t("payment.setOrderRefundedStatusButton.dialogTitle")',
  size='sm',
  @update:model-value='(v) => !v && close()'
)
  Form(
    :handler-submit="setRefund"
    :is-submitting="isSubmitting"
    :button-cancel-txt="$t('payment.setOrderRefundedStatusButton.cancel')"
    :button-submit-txt="$t('payment.setOrderRefundedStatusButton.confirm')"
    @cancel="close"
  )
    p {{ $t('payment.setOrderRefundedStatusButton.confirmText') }}
    BaseInput(
      v-model='reason',
      :label='$t("payment.setOrderRefundedStatusButton.reasonLabel")',
      :placeholder='$t("payment.setOrderRefundedStatusButton.reasonPlaceholder")',
      :hint='$t("payment.setOrderRefundedStatusButton.reasonHint")'
    )
</template>
<script lang="ts" setup>
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSetStatus } from '../../model';
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { Form } from 'src/shared/ui/Form';
import { t } from 'src/shared/i18n';
const {setCancelledStatus} = useSetStatus()
const isSubmitting = ref(false)
const showDialog = ref(false)
const reason = ref('')

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

const setRefund = async() => {
  isSubmitting.value = true
  try {
    await setCancelledStatus(props.id, reason.value || undefined)
    SuccessAlert(t('payment.setOrderRefundedStatusButton.updateSuccess'))
    close()
  } catch(e: any) {
    FailAlert(t('payment.setOrderRefundedStatusButton.updateError', { message: e.message }))
    close()
  } finally {
    isSubmitting.value = false
  }
}
</script>
