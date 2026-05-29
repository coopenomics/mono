<template lang="pug">
q-item(clickable flat size="sm" @click="showDialog=true").full-width
  div.q-pa-sm
    q-icon(name="fa-solid fa-square-check").q-mr-xs
    span обработан

BaseDialog(
  v-model='showDialog',
  title='Отметить обработанным',
  size='sm',
  @update:model-value='(v) => !v && close()'
)
  Form(
    :handler-submit="setCompleted"
    :is-submitting="isSubmitting"
    :button-cancel-txt="'Отменить'"
    :button-submit-txt="'Продолжить'"
    @cancel="close"
  )
    p Вы уверены, что хотите отметить платеж обработанным? Отметка НЕ приводит к изменению лицевых счетов и не выполняет никаких действий по обработке платежа, а только заменяет статус платежа.
</template>
<script lang="ts" setup>
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSetStatus } from '../../model';
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
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
    SuccessAlert('Статус ордера обновлён')
    close()
  } catch(e: any) {
    FailAlert(`Возникла ошибка: ${e.message}`)
    close()
  }
}
</script>
