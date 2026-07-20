<template lang="pug">
div
  BaseButton(
    variant='danger',
    :size='size',
    icon-only,
    aria-label='Удалить метод платежа',
    @click='showDialog = true'
  )
    template(#icon-left)
      q-icon(name='delete_outline', size='18px')

  BaseDialog(
    v-model='showDialog',
    title='Удалить метод платежа',
    size='sm',
    @update:model-value='(v) => !v && clear()'
  )
    Form(
      :handler-submit="handlerSubmit"
      :is-submitting="isSubmitting"
      :button-cancel-txt="'Отменить'"
      :button-submit-txt="'Продолжить'"
      @cancel="clear"
    )
      p Вы уверены, что хотите удалить метод платежа?
</template>
<script lang="ts" setup>
import { computed, ref, type PropType } from 'vue';
import { useDeletePaymentMethod } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, type BaseButtonSize } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';

const props = defineProps({
  username: {
    type: String,
    required: true,
  },
  method_id: {
    type: String,
    required: true,
  },
  size: {
    type: String as PropType<BaseButtonSize>,
    required: false,
    default: 'md'
  }
})

const username = computed(() => props.username)

const showDialog = ref(false)
const isSubmitting = ref(false)

const clear = (): void => {
  showDialog.value = false
}

const { deletePaymentMethod } = useDeletePaymentMethod()

const handlerSubmit = async (): Promise<void> => {

  isSubmitting.value = true
  try {
    await deletePaymentMethod({
      username: username.value,
      method_id: props.method_id
    })

    showDialog.value = false
    isSubmitting.value = false
    SuccessAlert('Метод платежа успешно удалён')

  } catch (e: any) {
    showDialog.value = false
    isSubmitting.value = false
    FailAlert(e)
  }
}


</script>
