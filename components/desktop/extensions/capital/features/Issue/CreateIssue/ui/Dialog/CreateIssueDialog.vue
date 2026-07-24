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
    q-input(
      ref='titleInput'
      autofocus
      v-model='formData.title',
      standout='bg-teal text-white',
      label='Название задачи',
      :rules='[(val) => notEmpty(val)]',
      autocomplete='off'
    )

    q-input(
      standout='bg-teal text-white',
      v-model='formData.description',
      label='Описание задачи',
      placeholder='Опишите задачу подробно...',
      type="textarea"
      autogrow
    )

    q-select(
      v-model='formData.priority',
      standout='bg-teal text-white',
      label='Приоритет',
      :options='priorityOptions',
      option-value='value',
      option-label='label',
      emit-value,
      map-options
    )

    q-select(
      v-model='formData.status',
      standout='bg-teal text-white',
      label='Статус',
      :options='statusOptions',
      option-value='value',
      option-label='label',
      emit-value,
      map-options
    )

    q-input(
      v-model.number='formData.estimate',
      standout='bg-teal text-white',
      label='Оценка (часы)',
      type='number',
      :min='0',
      step='any',
      :rules='[(val) => val >= 0 || "Оценка не может быть отрицательной"]',
      autocomplete='off'
    )

    q-checkbox(
      v-model='createAnother',
      label='Создать еще одну задачу',

    )
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useRoute, useRouter } from 'vue-router';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { Zeus } from '@coopenomics/sdk';
import { getIssueStatusLabel } from 'app/extensions/capital/shared/lib';
import { useCreateIssue } from '../../model';
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

const notEmpty = (val: any) => {
  return !!val || 'Это поле обязательно для заполнения';
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

  // Устанавливаем фокус на первое поле после очистки
  await nextTick();
  titleInput.value?.focus();
};

const clear = async () => {
  await clearForm();
  createAnother.value = false;
};

const handleSubmit = async () => {
  isSubmitting.value = true;
  try {
    const inputData = {
      coopname: system.info.coopname,
      project_hash: currentProjectHash.value,
      title: formData.value.title,
      description: formData.value.description,
      priority: formData.value.priority,
      status: formData.value.status,
      estimate: formData.value.estimate,
      labels: formData.value.labels,
      attachments: formData.value.attachments,
    };

    const result = await createIssue(inputData);

    // Получаем ID и хэш задачи из результата
    // result - это объект задачи, у которого есть поля id и issue_hash
    const issueId = typeof result === 'string' ? result : result?.id;
    const issueHash = result?.issue_hash;

    SuccessAlert(
      `Задача ${issueId} успешно создана`,
      issueHash ? {
        text: '', // Пустой текст, только иконка
        icon: 'launch',
        handler: () => {
          router.push({
            name: 'component-issue-description',
            params: {
              coopname: system.info.coopname,
              project_hash: currentProjectHash.value,
              issue_hash: issueHash
            }
          });
        }
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
