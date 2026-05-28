<template lang="pug">
//- Canon header-кнопка: на мобильном — только иконка + tooltip,
//- на десктопе — иконка + лейбл.
q-btn(
  @click='show = true',
  :color='isMobile ? "accent" : "primary"',
  :flat='isMobile',
  :dense='isMobile',
  :size='isMobile ? "sm" : undefined',
  no-wrap
)
  q-icon(name='fa-solid fa-plus')
  span.q-ml-sm(v-if='!isMobile') Предложить
  q-tooltip(v-if='isMobile') Предложить повестку

BaseDialog(
  v-model='show',
  title='Предложить повестку',
  :maximized='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  Form(
    :handler-submit='create',
    :is-submitting='isSubmitting',
    :showSubmit='!isLoading',
    :showCancel='true',
    :button-submit-txt='"Предложить"',
    @cancel='clear'
  )
    q-input(
      dense,
      v-model='createProjectInput.title',
      standout='bg-teal text-white',
      placeholder='',
      label='Заголовок документа',
      counter,
      :maxlength='200',
      autocomplete='off',
      hint='Кратко опишите суть предложения (до 200 символов)'
    ).q-mb-md
    q-input(
      dense,
      v-model='createProjectInput.question',
      standout='bg-teal text-white',
      placeholder='',
      label='Вопрос на повестке дня',
      :rules='[(val) => notEmpty(val)]',
      autocomplete='off',
      type='textarea'
      hint="Сформулируйте вопрос к обсуждению на повестке голосования"
    ).q-mb-md
    q-input(
      dense,
      v-model='createProjectInput.decision',
      standout='bg-teal text-white',
      placeholder='',
      label='Предлагаемое решение вопроса для голосования',
      :rules='[(val) => notEmpty(val)]',
      autocomplete='off',
      type='textarea'
      hint="Сформулируйте проект решения по поставленному вопросу"
    )
</template>

<script lang="ts" setup>
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
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
    createProjectInput.value.title = '';
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
