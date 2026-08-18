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
    .create-component-form
      //- Родитель известен, когда компонент создают внутри проекта. Из раздела
      //- «Компоненты» проекта нет — выбираем его здесь, из тех, где есть право
      BaseSelect(
        v-if='!props.project'
        v-model='selectedProjectHash'
        :options='projectOptions'
        label='Проект'
        placeholder='Выберите проект'
        searchable
        required
        :error='projectError'
      )

      BaseInput(
        v-model='formData.title'
        label='Название компонента'
        autocomplete='off'
        required
        :error='titleError'
      )

      BaseInput(
        v-model='formData.description'
        label='Описание компонента'
        placeholder='Опишите компонент подробно...'
        type='textarea'
        autogrow
        :rows='3'
      )
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { BaseInput, BaseSelect } from 'src/shared/ui/base';
import type { ICreateProjectInput, IProject } from 'app/extensions/capital/entities/Project/model';
import { useCreateComponent, useEditableProjects } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';

const props = defineProps<{
  /** Родительский проект. Не задан — выбирается в диалоге */
  project?: IProject;
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

// Выбор проекта нужен только когда родитель не передан снаружи
const {
  options: projectOptions,
  getProject,
  loadEditableProjects,
} = useEditableProjects();
const selectedProjectHash = ref<string | null>(null);
const projectError = ref('');
const titleError = ref('');

const clear = () => {
  formData.value = {
    title: '',
    description: '',
  };
  selectedProjectHash.value = null;
  projectError.value = '';
  titleError.value = '';
};

onMounted(() => {
  if (!props.project) void loadEditableProjects();
});

watch(selectedProjectHash, (value) => {
  if (value) projectError.value = '';
});

watch(() => formData.value.title, (value) => {
  if (value) titleError.value = '';
});

/** Родитель: переданный проект либо выбранный в диалоге. */
const resolveParentProject = (): IProject | undefined => {
  if (props.project) return props.project;
  if (!selectedProjectHash.value) return undefined;
  return getProject(selectedProjectHash.value);
};

const handleSubmit = async () => {
  const parentProject = resolveParentProject();
  titleError.value = formData.value.title ? '' : 'Это поле обязательно для заполнения';
  if (!parentProject) {
    projectError.value = 'Выберите проект';
  }
  if (!parentProject || titleError.value) return;

  isSubmitting.value = true;
  try {
    const projectHash = await generateUniqueHash();

    const inputData: ICreateProjectInput = {
      coopname: system.info.coopname,
      project_hash: projectHash,
      parent_hash: parentProject.project_hash,
      title: formData.value.title,
      description: formData.value.description,
      meta: JSON.stringify({}),
      data: '',
      invite: '',
    };

    await createComponent(inputData, {
      local: parentProject.origin === 'local',
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

<style lang="scss" scoped>
// Поля идут подряд: канон-обёртки сами резервируют строку под подсказку,
// дополнительный зазор делает форму разреженной
.create-component-form {
  display: flex;
  flex-direction: column;
}

</style>
