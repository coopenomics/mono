<template lang="pug">
span.agreement-link(@click.stop='(event) => showDialog(event)').q-ml-xs {{text}}
  BaseDialog(
    v-model='show',
    :maximized='true',
    :close-on-backdrop='false',
    :close-on-escape='false',
    @update:model-value='(v) => !v && clear()'
  )
    div.row.justify-center
      div(style="padding-bottom: 100px;").col-md-8.col-col-xs-12
        Form(
          :handler-submit="ok"
          :is-submitting="isSubmitting"
          :showSubmit="true"
          :showCancel="true"
          button-cancel-text="Отменить"
          button-submit-txt="Подтвердить"
          @cancel="clear"
        )
          StaticPrivacyPolicy
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { StaticPrivacyPolicy } from 'src/features/Agreementer/StaticPrivacyPolicy';

const emit = defineEmits(['update:agree']);

const show = ref(false);
const isSubmitting = ref(false);

const ok = async() => {
  emit('update:agree', true);
  show.value = false;
};

const clear = () => {
  emit('update:agree', false);
  show.value = false;
};

defineProps({
  agree: {
    type: Boolean,
    required: true,
  },
  text: {
    type: String,
    required: true
  }
});

const showDialog = (event: Event) => {
  event.stopPropagation();
  show.value = true;
};
</script>
