<template lang="pug">
div
  q-btn(@click="show = true" color="primary" icon="add") {{ $t('decision.createProjectFreeDecisionButton.openButton') }}

  BaseDialog(
    v-model='show',
    :title='$t("decision.createProjectFreeDecisionButton.title")',
    size='lg',
    :close-on-backdrop='false',
    :close-on-escape='false'
  )
    Form(
      :handler-submit="create"
      :is-submitting="isSubmitting"
      :showSubmit="!isLoading"
      :showCancel="true"
      :button-submit-txt="$t('common.action.create')"
      @cancel="clear"
    )
      q-input(
        dense
        v-model="createProjectInput.title"
        standout="bg-teal text-white"
        placeholder=""
        :label="$t('decision.createProjectFreeDecisionButton.titleLabel')"
        counter
        :maxlength="200"
        autocomplete="off"
      )
      q-input(
        dense
        v-model="createProjectInput.question"
        standout="bg-teal text-white"
        placeholder=""
        :label="$t('decision.createProjectFreeDecisionButton.questionLabel')"
        :rules="[val => notEmpty(val)]"
        autocomplete="off"
        type="textarea"
      )
      q-input(
        dense
        v-model="createProjectInput.decision"
        standout="bg-teal text-white"
        placeholder=""
        :label="$t('decision.createProjectFreeDecisionButton.decisionLabel')"
        :rules="[val => notEmpty(val)]"
        autocomplete="off"
        type="textarea"
      )
</template>

<script lang="ts" setup>
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { ref } from 'vue';
import { useCreateProjectOfFreeDecision } from '../model';
import { extractGraphQLErrorMessages, FailAlert, SuccessAlert } from 'src/shared/api';
import { notEmpty } from 'src/shared/lib/utils';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';

const show = ref(false)
const isSubmitting = ref(false)
const isLoading = ref(false)
const {createProjectInput, createProject} = useCreateProjectOfFreeDecision()
const session = useSessionStore()
const system = useSystemStore()

const create = async () => {
  try {
    isSubmitting.value = true
    await createProject(system.info.coopname, session.username)
    isSubmitting.value = false
    show.value = false
    SuccessAlert(t('decision.createProjectFreeDecisionButton.success'))
    createProjectInput.value.title = ''
    createProjectInput.value.question = ''
    createProjectInput.value.decision = ''
  } catch(e){
    isSubmitting.value = false
    FailAlert(t('decision.createProjectFreeDecisionButton.error', { message: extractGraphQLErrorMessages(e) }))
  }

}

const clear = () => {
  show.value = false
}

</script>
