<template lang="pug">
CreateDialog(
  ref="dialogRef"
  :title="$t('capital.addAuthorDialog.title')"
  :submit-text="$t('common.action.add')"
  dialog-style="width: 400px; max-width: 100% !important;"
  :is-submitting="isSubmitting"
  @submit="handleSubmit"
  @dialog-closed="clear"
)
  template(#form-fields)
    div(style='max-width: 400px')
      .text-body2.q-mb-sm
        | {{ $t('capital.addAuthorDialog.warningText') }}

      ContributorSelector(
        v-model='selectedAuthors'
        :multi-select='true'
        :dense='true'
        :disable='isSubmitting'
        :project-hash='props.project?.project_hash'
        :placeholder='$t("capital.addAuthorDialog.selectPlaceholder")'
        :label='$t("capital.addAuthorDialog.selectLabel")'
        class='authors-selector'
      )

      .text-caption.text-grey-6.q-mt-sm(v-if='selectedAuthors.length > 0')
        | {{ $t('capital.addAuthorDialog.selectedCount', { count: selectedAuthors.length }) }}
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAddAuthor } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { ContributorSelector } from '../../../../../entities/Contributor';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import type { IProject } from '../../../../../entities/Project/model';
import type { IContributor } from '../../../../../entities/Contributor/model';
import { t } from '../../../../../i18n';

const props = defineProps<{ project: IProject | null | undefined }>();

const emit = defineEmits<{
  success: [];
  error: [error: any];
}>();

const dialogRef = ref();
const { addAuthors, addAuthorInput } = useAddAuthor();
const isSubmitting = ref(false);
const selectedAuthors = ref<IContributor[]>([]);

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

const clear = () => {
  selectedAuthors.value = [];
};

const handleSubmit = async () => {
  if (selectedAuthors.value.length === 0) {
    FailAlert(t('capital.addAuthorDialog.selectAtLeastOneError'));
    return;
  }

  // Проверяем, что у всех выбранных участников есть username
  const invalidContributors = selectedAuthors.value.filter(c => !c?.username);
  if (invalidContributors.length > 0) {
    FailAlert(t('capital.addAuthorDialog.missingUsernameError'));
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
      ? t('capital.addAuthorDialog.singleAddedSuccess')
      : t('capital.addAuthorDialog.addedCountSuccess', { count });

    SuccessAlert(message);

    // Закрываем диалог после успешного создания
    dialogRef.value?.clear();
    emit('success');
  } catch (error) {
    console.error('AddAuthorDialog: addAuthors error', error);
    FailAlert(error);
    emit('error', error);
  } finally {
    isSubmitting.value = false;
  }
};

// Экспортируем функции для внешнего использования
defineExpose({
  openDialog: () => dialogRef.value?.openDialog(),
  clear: () => dialogRef.value?.clear(),
});
</script>

<style lang="scss" scoped>
.authors-selector {
  :deep(.q-field) {
    min-width: 300px;
  }
}
</style>
