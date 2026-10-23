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
  span.q-ml-sm(v-if='!isMobile') {{ $t('decision.createProjectButton.submit') }}
  q-tooltip(v-if='isMobile') {{ $t('decision.createProjectButton.title') }}

BaseDialog(
  v-model='show',
  :title='$t("decision.createProjectButton.title")',
  :maximized='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  Form(
    :handler-submit='create',
    :is-submitting='isSubmitting',
    :showSubmit='!isLoading',
    :showCancel='true',
    :button-submit-txt='$t("decision.createProjectButton.submit")',
    @cancel='clear'
  )
    q-input(
      dense,
      v-model='createProjectInput.title',
      standout='bg-teal text-white',
      placeholder='',
      :label='$t("decision.createProjectButton.titleLabel")',
      counter,
      :maxlength='200',
      autocomplete='off',
      :hint='$t("decision.createProjectButton.titleHint")'
    ).q-mb-md
    q-input(
      dense,
      v-model='createProjectInput.question',
      standout='bg-teal text-white',
      placeholder='',
      :label='$t("decision.createProjectButton.questionLabel")',
      :rules='[(val) => notEmpty(val)]',
      autocomplete='off',
      type='textarea'
      :hint="$t('decision.createProjectButton.questionHint')"
    ).q-mb-md
    q-input(
      dense,
      v-model='createProjectInput.decision',
      standout='bg-teal text-white',
      placeholder='',
      :label='$t("decision.createProjectButton.decisionLabel")',
      :rules='[(val) => notEmpty(val)]',
      autocomplete='off',
      type='textarea'
      :hint="$t('decision.createProjectButton.decisionHint')"
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
import { useAgendaStore } from 'src/entities/Agenda/model';
import { useWindowSize } from 'src/shared/hooks';
import { t } from 'src/shared/i18n';

const { isMobile } = useWindowSize();
const show = ref(false);
const isSubmitting = ref(false);
const isLoading = ref(false);
const { createProjectInput, createProject } = useCreateProjectOfFreeDecision();
const session = useSessionStore();
const system = useSystemStore();
const agendaStore = useAgendaStore();

const create = async () => {
  try {
    isSubmitting.value = true;
    const createdItem = await createProject(system.info.coopname, session.username);
    isSubmitting.value = false;
    show.value = false;
    SuccessAlert(t('decision.createProjectButton.success'));
    createProjectInput.value.title = '';
    createProjectInput.value.question = '';
    createProjectInput.value.decision = '';
    // Бэкенд вернул созданный вопрос (извлёк из блокчейна) — показываем его в
    // таблице немедленно; голос/правка по нему заблокированы до подтверждения
    // ближайшим getAgenda-поллингом.
    if (createdItem) agendaStore.insertCreated(createdItem);
  } catch (e) {
    isSubmitting.value = false;
    FailAlert(t('decision.createProjectButton.error', { message: extractGraphQLErrorMessages(e) }));
  }
};

const clear = () => {
  show.value = false;
};
</script>
