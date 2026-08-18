<template lang="pug">
CreateDialog(
  ref="dialogRef"
  :title="props.local ? 'Создать персональный проект' : 'Создать проект'"
  submit-text="Создать"
  dialog-style="width: 600px; max-width: 100% !important;"
  :is-submitting="isSubmitting"
  @submit="handleSubmit"
  @dialog-closed="clear"
)
  template(#form-fields)
    .create-form
      BaseInput(
        v-model='formData.title'
        label='Название проекта'
        autocomplete='off'
        required
        :error='titleError'
      )

      BaseInput(
        v-model='formData.description'
        label='Описание проекта'
        placeholder='Опишите проект...'
        type='textarea'
        autogrow
      )
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { BaseInput } from 'src/shared/ui/base';
import { useCreateProject, type ICreateProjectInput } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';

const props = defineProps<{
  /** Персональный проект — только PostgreSQL, без блокчейна */
  local?: boolean;
}>();

const emit = defineEmits<{
  success: [];
  error: [error: any];
}>();

const dialogRef = ref();
const system = useSystemStore();
const { createProject, createLocalProject } = useCreateProject();
const isSubmitting = ref(false);

const formData = ref({
  parent_hash: '',
  title: '',
  description: '',
  data: '',
  invite: '',
  meta: JSON.stringify({}),
});

const titleError = ref('');

watch(() => formData.value.title, (value) => {
  if (value) titleError.value = '';
});

const clear = () => {
  formData.value = {
    parent_hash: '',
    title: '',
    description: '',
    meta: '',
    data: '',
    invite: '',
  };
  titleError.value = '';
};

const handleSubmit = async () => {
  titleError.value = formData.value.title ? '' : 'Это поле обязательно для заполнения';
  if (titleError.value) return;

  isSubmitting.value = true;
  try {
    const projectHash = await generateUniqueHash();

    const inputData: ICreateProjectInput = {
      coopname: system.info.coopname,
      project_hash: projectHash,
      parent_hash: formData.value.parent_hash || '',
      title: formData.value.title,
      description: formData.value.description,
      meta: formData.value.meta,
      data: formData.value.data,
      invite: formData.value.invite,
    };

    if (props.local) {
      await createLocalProject(inputData);
      SuccessAlert('Персональный проект создан');
    } else {
      await createProject(inputData);
      SuccessAlert('Проект успешно создан');
    }

    // Закрываем диалог после успешного создания
    dialogRef.value?.clear();
    emit('success');
  } catch (error) {
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
// Поля идут подряд: канон-обёртки сами резервируют строку под подсказку,
// дополнительный зазор делает форму разреженной
.create-form {
  display: flex;
  flex-direction: column;
}
</style>
