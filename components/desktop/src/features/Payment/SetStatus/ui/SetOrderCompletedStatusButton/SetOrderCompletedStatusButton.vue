<template lang="pug">
q-item(clickable flat size="sm" @click="showDialog=true").full-width
  div.q-pa-sm
    q-icon(name="fa-solid fa-square-check").q-mr-xs
    span {{ $t('payment.setOrderCompletedStatusButton.processedBadge') }}

BaseDialog(
  v-model='showDialog',
  :title='$t("payment.setOrderCompletedStatusButton.title")',
  size='sm',
  @update:model-value='(v) => !v && close()'
)
  Form(
    :handler-submit="setCompleted"
    :is-submitting="isSubmitting"
    :button-cancel-txt="$t('payment.setOrderCompletedStatusButton.cancel')"
    :button-submit-txt="$t('payment.setOrderCompletedStatusButton.confirm')"
    @cancel="close"
  )
    p {{ $t('payment.setOrderCompletedStatusButton.confirmText') }}
</template>
<script lang="ts" setup>
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSetStatus } from '../../model';
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { t } from 'src/shared/i18n';
const {setCompletedStatus} = useSetStatus()
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

const setCompleted = async() => {
  try {
    await setCompletedStatus(props.id)
    SuccessAlert(t('payment.setOrderCompletedStatusButton.updateSuccess'))
    close()
  } catch(e: any) {
    FailAlert(t('payment.setOrderCompletedStatusButton.updateError', { message: e.message }))
    close()
  }
}
</script>
