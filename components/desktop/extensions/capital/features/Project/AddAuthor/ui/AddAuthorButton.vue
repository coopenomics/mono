<template lang="pug">
span
  BaseButton(
    variant='primary',
    size='sm',
    :loading='isSubmitting',
    :aria-label='$t("capital.addAuthorButton.ariaLabel")',
    @click.stop='showDialog = true'
  )
    template(#icon-left)
      q-icon(name='add', size='18px')
    | {{ $t('capital.addAuthorButton.label') }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("capital.addAuthorButton.dialogTitle")',
    size='md',
    @update:model-value='(v) => !v && close()'
  )
    Form.q-pa-sm(
      :handler-submit='handleAddAuthors',
      :is-submitting='isSubmitting',
      :button-cancel-txt='$t("capital.addAuthorButton.cancel")',
      :button-submit-txt='$t("common.action.add")',
      @cancel='close'
    )
      div(style='max-width: 400px')
        .text-body2.q-mb-sm
          | {{ $t('capital.addAuthorButton.warningText') }}

        ContributorSelector(
          v-model='selectedAuthors'
          :multi-select='true'
          :dense='true'
          :disable='isSubmitting'
          :project-hash='props.project.project_hash'
          :placeholder='$t("capital.addAuthorButton.selectPlaceholder")'
          :label='$t("capital.addAuthorButton.selectLabel")'
          class='authors-selector'
        )

        .text-caption.text-grey-6.q-mt-sm(v-if='selectedAuthors.length > 0')
          | {{ $t('capital.addAuthorButton.selectedCount', { count: selectedAuthors.length }) }}
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAddAuthor } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { ContributorSelector } from '../../../../entities/Contributor';
import { BaseButton } from 'src/shared/ui/base';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import type { IProject } from '../../../../entities/Project/model';
import type { IContributor } from '../../../../entities/Contributor/model';
import { t } from '../../../../i18n';

const props = defineProps<{ project: IProject }>();

const emit = defineEmits<{
  authorsAdded: [];
}>();

const { addAuthors, addAuthorInput } = useAddAuthor();
const showDialog = ref(false);
const selectedAuthors = ref<IContributor[]>([]);
const isSubmitting = ref(false);

// Обновляем входные данные при изменении проекта
watch(
  () => props.project,
  (newProject) => {
    if (newProject) {
      addAuthorInput.value.coopname = newProject.coopname || '';
      addAuthorInput.value.project_hash = newProject.project_hash;
    }
  },
  { immediate: true },
);

const close = () => {
  showDialog.value = false;
  selectedAuthors.value = [];
};

const handleAddAuthors = async () => {
  if (selectedAuthors.value.length === 0) {
    FailAlert(t('capital.addAuthorButton.selectAtLeastOneError'));
    return;
  }

  // Проверяем, что у всех выбранных участников есть username
  const invalidContributors = selectedAuthors.value.filter(c => !c?.username);
  if (invalidContributors.length > 0) {
    FailAlert(t('capital.addAuthorButton.missingUsernameError'));
    return;
  }

  isSubmitting.value = true;

  try {
    const authorUsernames: string[] = [];
    for (const contributor of selectedAuthors.value) {
      if (contributor && contributor.username) {
        authorUsernames.push(contributor.username);
      }
    }

    const baseInput = {
      coopname: addAuthorInput.value.coopname,
      project_hash: addAuthorInput.value.project_hash,
    };

    await addAuthors(authorUsernames, baseInput);

    const count = authorUsernames.length;
    const message = count === 1
      ? t('capital.addAuthorButton.singleAddedSuccess')
      : t('capital.addAuthorButton.addedCountSuccess', { count });

    SuccessAlert(message);
    emit('authorsAdded');
    close();
  } catch (error) {
    console.error('AddAuthorButton: addAuthors error', error);
    FailAlert(error);
  } finally {
    isSubmitting.value = false;
  }
};

defineExpose({
  openDialog: () => {
    showDialog.value = true;
  },
});
</script>

<style lang="scss" scoped>
.authors-selector {
  :deep(.q-field) {
    min-width: 300px;
  }
}
</style>
