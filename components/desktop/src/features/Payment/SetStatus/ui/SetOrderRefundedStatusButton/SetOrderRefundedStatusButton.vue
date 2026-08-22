<template lang="pug">
BaseButton(variant="danger" size="sm" @click="showDialog=true")
  template(#icon-left)
    q-icon(name="cancel" size="14px").q-mr-xs
  | Отклонить

BaseDialog(
  v-model='showDialog',
  title='Отклонить платеж',
  size='sm',
  @update:model-value='(v) => !v && close()'
)
  Form(
    :handler-submit="setRefund"
    :is-submitting="isSubmitting"
    :button-cancel-txt="'Отменить'"
    :button-submit-txt="'Продолжить'"
    @cancel="close"
  )
    p Вы уверены, что хотите отклонить платеж? При отклонении входящего платежа - верните средства пайщику. При отклонении исходящего платежа - система запустит соответствующую автоматическую цепочку обратных действий.
    BaseInput(
      v-model='reason',
      label='Причина отклонения',
      placeholder='Например: средства не поступили или пришли с чужого счёта',
      hint='Причину увидит пайщик'
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
    SuccessAlert('Статус платежа обновлён')
    close()
  } catch(e: any) {
    FailAlert(`Возникла ошибка: ${e.message}`)
    close()
  } finally {
    isSubmitting.value = false
  }
}
</script>
