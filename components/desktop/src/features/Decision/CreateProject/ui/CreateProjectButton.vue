<template lang="pug">
q-btn(
  @click='show = true',
  color='primary',
  push,
  no-wrap,
  :stretch='isMobile',
  :size='isMobile ? "sm" : "md"'
)
  span.q-pr-sm предложить
  i.fa-solid.fa-plus

q-dialog(v-model='show', persistent, :maximized='true')
  ModalBase(
    style='max-width: 100% !important',
    :title='"Предложить повестку"',
    :show_close='true'
  )
    Form.q-pa-md(
      :handler-submit='create',
      :is-submitting='isSubmitting',
      :showSubmit='!isLoading',
      :showCancel='true',
      :button-submit-txt='"Создать"',
      @cancel='clear'
    )
      .q-mb-lg
        q-input(
          dense,
          v-model='createProjectInput.question',
          standout='bg-teal text-white',
          placeholder='',
          label='Вопрос на повестку дня',
          :rules='[(val) => notEmpty(val)]',
          autocomplete='off',
          type='textarea'
        )
        q-input(
          dense,
          v-model='createProjectInput.decision',
          standout='bg-teal text-white',
          placeholder='',
          label='Предлагаемое решение вопроса для голосования',
          :rules='[(val) => notEmpty(val)]',
          autocomplete='off',
          type='textarea'
        )
</template>

<script lang="ts" setup>
import { ModalBase } from 'src/shared/ui/ModalBase';
import { Form } from 'src/shared/ui/Form';
import { ref } from 'vue';
import { useCreateProjectOfFreeDecision } from '../model';
import {
  extractGraphQLErrorMessages,
  FailAlert,
  SuccessAlert,
} from 'src/shared/api';
import { notEmpty } from 'src/shared/lib/utils';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();
const show = ref(false);
const isSubmitting = ref(false);
const isLoading = ref(false);
const { createProjectInput, createProject } = useCreateProjectOfFreeDecision();
const session = useSessionStore();
const system = useSystemStore();

const create = async () => {
  try {
    isSubmitting.value = true;
    await createProject(system.info.coopname, session.username);
    isSubmitting.value = false;
    show.value = false;
    SuccessAlert('Вопрос добавлен на повестку для голосования');
    createProjectInput.value.question = '';
    createProjectInput.value.decision = '';
  } catch (e) {
    isSubmitting.value = false;
    FailAlert(`Ошибка: ${extractGraphQLErrorMessages(e)}`);
  }
};

const clear = () => {
  show.value = false;
};
</script>
