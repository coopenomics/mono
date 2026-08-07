<template lang="pug">
CreateDialog(
  ref="dialogRef"
  title="Создать компонент"
  submit-text="Создать"
  dialog-style="width: 600px; max-width: 100% !important;"
  :is-submitting="isSubmitting"
  @submit="handleSubmit"
  @dialog-closed="clear"
)
  template(#form-fields)
    q-input(
      standout="bg-teal text-white"
      v-model='formData.title',
      label='Название компонента',
      :rules='[(val) => notEmpty(val)]',
      autocomplete='off'
    )

    Editor(
      v-model='formData.description',
      label='Описание компонента',
      placeholder='Опишите компонент подробно...',
      autocomplete='off',
      :minHeight='200',
      :padded='false'
    )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { Editor } from 'src/shared/ui';
import type { ICreateProjectInput, IProject } from 'app/extensions/capital/entities/Project/model';
import { useCreateComponent } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';

const props = defineProps<{
  project: IProject;
}>();

const emit = defineEmits<{
  success: [];
  error: [error: any];
}>();

const dialogRef = ref();
const system = useSystemStore();
const { createComponent } = useCreateComponent();
const isSubmitting = ref(false);

const formData = ref({
  title: '',
  description: '',
});

const notEmpty = (val: any) => {
  return !!val || 'Это поле обязательно для заполнения';
};

const clear = () => {
  formData.value = {
    title: '',
    description: '',
  };
};

const handleSubmit = async () => {
  isSubmitting.value = true;
  try {
    const projectHash = await generateUniqueHash();

    const inputData: ICreateProjectInput = {
      coopname: system.info.coopname,
      project_hash: projectHash,
      parent_hash: props.project.project_hash,
      title: formData.value.title,
      description: formData.value.description,
      meta: JSON.stringify({}),
      data: '',
      invite: '',
    };

    await createComponent(inputData, {
      local: props.project.origin === 'local',
    });
    SuccessAlert('Компонент успешно создан');

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
