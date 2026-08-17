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
import { onMounted, ref, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { Editor } from 'src/shared/ui';
import { BaseSelect } from 'src/shared/ui/base';
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

const notEmpty = (val: any) => {
  return !!val || 'Это поле обязательно для заполнения';
};

const clear = () => {
  formData.value = {
    title: '',
    description: '',
  };
  selectedProjectHash.value = null;
  projectError.value = '';
};

onMounted(() => {
  if (!props.project) void loadEditableProjects();
});

watch(selectedProjectHash, (value) => {
  if (value) projectError.value = '';
});

/** Родитель: переданный проект либо выбранный в диалоге. */
const resolveParentProject = (): IProject | undefined => {
  if (props.project) return props.project;
  if (!selectedProjectHash.value) return undefined;
  return getProject(selectedProjectHash.value);
};

const handleSubmit = async () => {
  const parentProject = resolveParentProject();
  if (!parentProject) {
    projectError.value = 'Выберите проект';
    return;
  }

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
