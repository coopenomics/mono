<template lang="pug">
CreateDialog(
  ref="dialogRef"
  title="Создать задачу"
  submit-text="Создать"
  dialog-style="width: 600px; max-width: 100% !important;"
  :is-submitting="isSubmitting"
  @submit="handleSubmit"
  @dialog-closed="clear"
)
  template(#form-fields)
    .create-issue-form
      //- Компонент известен, когда задачу создают внутри него. Из раздела
      //- «Задачи» его выбирают здесь — из тех, где есть право вести задачи.
      //- Поле необязательное: задачу можно завести свободной и привязать потом.
      BaseSelect(
        v-if='!currentProjectHash'
        v-model='selectedComponentHash'
        :options='componentOptions'
        label='Компонент'
        placeholder='Без компонента'
        searchable
        clearable
      )

      BaseInput(
        ref='titleInput'
        v-model='formData.title'
        label='Название задачи'
        autofocus
        autocomplete='off'
        required
        :error='titleError'
      )

      BaseInput.create-issue-form__description(
        v-model='formData.description'
        label='Описание задачи'
        placeholder='Опишите задачу подробно...'
        type='textarea'
        autogrow
      )

      BaseSelect(
        v-model='formData.priority'
        :options='priorityOptions'
        label='Приоритет'
      )

      BaseSelect(
        v-model='formData.status'
        :options='statusOptions'
        label='Статус'
      )

      BaseInput(
        v-model='formData.estimate'
        label='Оценка (часы)'
        type='number'
        autocomplete='off'
        :error='estimateError'
      )

      BaseCheckbox(
        v-model='createAnother'
        label='Создать ещё одну задачу'
      )
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useRoute, useRouter } from 'vue-router';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { BaseInput, BaseSelect, BaseCheckbox } from 'src/shared/ui/base';
import { Zeus } from '@coopenomics/sdk';
import { getIssueStatusLabel, capitalRouteName } from 'app/extensions/capital/shared/lib';
import { useCreateIssue, useIssueTargets, type ICreateIssueInput } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';

const props = defineProps<{
  projectHash?: string;
}>();

const emit = defineEmits<{
  success: [];
  error: [error: any];
}>();

const route = useRoute();
const router = useRouter();
const dialogRef = ref();
const titleInput = ref();
const system = useSystemStore();
const { createIssue } = useCreateIssue();

const createAnother = ref(false);
const isSubmitting = ref(false);

// Получаем project_hash из пропса или маршрута
const currentProjectHash = computed(() => props.projectHash || (route.params.project_hash as string));

const formData = ref({
  title: '',
  description: '',
  priority: Zeus.IssuePriority.MEDIUM,
  status: Zeus.IssueStatus.BACKLOG,
  estimate: 0,
  labels: [] as string[],
  attachments: [] as string[],
});

const priorityOptions = [
  { value: Zeus.IssuePriority.LOW, label: 'Низкий' },
  { value: Zeus.IssuePriority.MEDIUM, label: 'Средний' },
  { value: Zeus.IssuePriority.HIGH, label: 'Высокий' },
  { value: Zeus.IssuePriority.URGENT, label: 'Срочный' },
];

const statusOptions = computed(() => [
  { value: Zeus.IssueStatus.BACKLOG, label: getIssueStatusLabel(Zeus.IssueStatus.BACKLOG) },
  { value: Zeus.IssueStatus.TODO, label: getIssueStatusLabel(Zeus.IssueStatus.TODO) },
  { value: Zeus.IssueStatus.IN_PROGRESS, label: getIssueStatusLabel(Zeus.IssueStatus.IN_PROGRESS) },
  { value: Zeus.IssueStatus.ON_REVIEW, label: getIssueStatusLabel(Zeus.IssueStatus.ON_REVIEW) },
  { value: Zeus.IssueStatus.DONE, label: getIssueStatusLabel(Zeus.IssueStatus.DONE) },
  { value: Zeus.IssueStatus.CANCELED, label: getIssueStatusLabel(Zeus.IssueStatus.CANCELED) },
]);

// Выбор компонента нужен, только когда он не задан снаружи и не следует из маршрута
const { options: componentOptions, loadIssueTargets } = useIssueTargets();
const selectedComponentHash = ref<string | null>(null);

const titleError = ref('');
const estimateError = ref('');

/** Компонент задачи: переданный снаружи либо выбранный в диалоге. */
const targetProjectHash = computed(
  () => currentProjectHash.value || selectedComponentHash.value || '',
);

onMounted(() => {
  if (!currentProjectHash.value) void loadIssueTargets();
});

watch(() => formData.value.title, (value) => {
  if (value) titleError.value = '';
});

const validate = (): boolean => {
  titleError.value = formData.value.title ? '' : 'Это поле обязательно для заполнения';
  estimateError.value =
    Number(formData.value.estimate) >= 0 ? '' : 'Оценка не может быть отрицательной';
  return !titleError.value && !estimateError.value;
};

const clearForm = async () => {
  formData.value = {
    title: '',
    description: '',
    priority: Zeus.IssuePriority.MEDIUM,
    status: Zeus.IssueStatus.BACKLOG,
    estimate: 0,
    labels: [],
    attachments: [],
  };
  titleError.value = '';
  estimateError.value = '';

  // Фокус на первое поле после очистки: у канон-обёртки своего focus() нет,
  // поэтому зовём его только если он есть
  await nextTick();
  titleInput.value?.focus?.();
};

const clear = async () => {
  await clearForm();
  selectedComponentHash.value = null;
  createAnother.value = false;
};

/** Переход к созданной задаче из уведомления: у свободной задачи компонента нет. */
const openCreatedIssue = (issueHash: string, projectHash: string) => {
  if (projectHash) {
    router.push({
      name: capitalRouteName('component-issue-description', route),
      params: {
        coopname: system.info.coopname,
        project_hash: projectHash,
        issue_hash: issueHash,
      },
    });
    return;
  }
  router.push({
    name: 'my-task-issue-description',
    params: {
      coopname: system.info.coopname,
      issue_hash: issueHash,
    },
  });
};

const handleSubmit = async () => {
  if (!validate()) return;

  isSubmitting.value = true;
  try {
    const inputData: ICreateIssueInput = {
      coopname: system.info.coopname,
      title: formData.value.title,
      description: formData.value.description,
      priority: formData.value.priority,
      status: formData.value.status,
      estimate: Number(formData.value.estimate) || 0,
      labels: formData.value.labels,
      attachments: formData.value.attachments,
    };
    if (targetProjectHash.value) {
      inputData.project_hash = targetProjectHash.value;
    }

    const result = await createIssue(inputData);

    const issueId = typeof result === 'string' ? result : result?.id;
    const issueHash = result?.issue_hash;
    const resultProjectHash = result?.project_hash || targetProjectHash.value;

    SuccessAlert(
      `Задача ${issueId} успешно создана`,
      issueHash ? {
        text: '', // Пустой текст, только иконка
        icon: 'launch',
        handler: () => openCreatedIssue(issueHash, resultProjectHash),
      } : undefined
    );

    if (createAnother.value) {
      // Очищаем форму для создания следующей задачи
      clearForm();
      // Диалог остается открытым
    } else {
      // Закрываем диалог после успешного создания
      dialogRef.value?.clear();
      emit('success');
    }
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
.create-issue-form {
  display: flex;
  flex-direction: column;
}

// Чекбокс не участвует в резерве подсказки — отбиваем его от полей вручную
.create-issue-form :deep(.base-checkbox) {
  margin-top: var(--p-1);
}

// Описание сразу открыто на три строки: поле в одну строку не показывает,
// что сюда ждут развёрнутый текст
.create-issue-form__description :deep(textarea) {
  min-height: 4.5em;
}
</style>
