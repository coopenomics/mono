<template lang="pug">
q-btn(
  :color="fab ? 'accent' : 'primary'"
  :label="buttonLabel"
  @click="dialogRef?.openDialog()"
  :fab="fab"
  :disable="isSubmitting"
  v-if="!project?.permissions?.pending_clearance"
  :class="{ 'bg-fab-accent-radial': fab }"
)
  CreateDialog(
    ref="dialogRef"
    title="Откликнуться на приглашение"
    submit-text="Отправить отклик"
    size="lg"
    :is-submitting="isSubmitting"
    :disabled="isSubmitDisabled"
    @submit="handleConfirmRespond"
    @dialog-closed="clear"
  )
    template(#form-fields)
      .invite-dialog__target.q-mb-md
        .text-caption.text-grey-7.q-mb-xs Куда отклик
        ProjectPathWidget(:project="project")

      BaseInput(
        v-model="contributionText"
        type="textarea"
        autogrow
        label="Опишите какой вклад вы можете внести в проект"
        required
      )
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { formatCapitalFabLabel } from 'app/extensions/capital/shared/lib';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useMakeClearance } from '../model';
import { ProjectPathWidget } from 'app/extensions/capital/widgets/ProjectPathWidget';
import type { IGetProjectOutput } from 'app/extensions/capital/entities/Project/model';
import { useSystemStore } from 'src/entities/System/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { BaseInput } from 'src/shared/ui/base';

interface Props {
  project: IGetProjectOutput;
  fab?: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  'clearance-submitted': [];
}>();


const buttonLabel = computed(() =>
  props.fab
    ? formatCapitalFabLabel('Принять участие', 'join')
    : 'Принять участие',
);

const { info } = useSystemStore();
const projectStore = useProjectStore();
const contributorStore = useContributorStore();

const { respondToInvite } = useMakeClearance();

const dialogRef = ref();
const contributionText = ref('');
const isSubmitting = ref(false);
const parentProject = ref<IGetProjectOutput | null>(null);

const isSubmitDisabled = computed(() => contributionText.value.trim().length === 0);


// Функция загрузки родительского проекта
const loadParentProject = async () => {
  if (!props.project?.parent_hash) {
    parentProject.value = null;
    return;
  }

  try {
    // Ищем родительский проект в store
    const existingParent = projectStore.getProject(props.project.parent_hash);

    if (existingParent) {
      parentProject.value = existingParent;
    } else {
      // Загружаем родительский проект
      const loadedParent = await projectStore.loadProject({
        hash: props.project.parent_hash
      });
      parentProject.value = loadedParent || null;
    }
  } catch (error) {
    console.error('Ошибка при загрузке родительского проекта:', error);
    parentProject.value = null;
  }
};


// Функция инициализации формы с данными из профиля
const initializeForm = () => {
  // Предзаполняем поле значением из «О себе»
  contributionText.value = contributorStore.self?.about || '';
};

// Функция очистки формы
const clear = () => {
  initializeForm();
};

// Обработчик подтверждения отклика
const handleConfirmRespond = async () => {
  if (!props.project) return;

  const contribution = contributionText.value.trim();
  if (!contribution) {
    FailAlert('Опишите вклад, который можете внести в проект');
    return;
  }

  isSubmitting.value = true;
  try {
    const projectHashes: string[] = [props.project.project_hash];

    // Проверяем статус родительского проекта
    if (parentProject.value) {
      const parentPermissions = parentProject.value.permissions;

      // Если нет допуска к родительскому проекту и нет запроса в рассмотрении,
      // добавляем родительский проект в список для запроса
      if (!parentPermissions?.has_clearance && !parentPermissions?.pending_clearance) {
        projectHashes.unshift(parentProject.value.project_hash);
      }
      // Если допуск есть или запрос в рассмотрении, отправляем только запрос на текущий проект
    }

    // Отправляем запросы для всех необходимых проектов
    for (const projectHash of projectHashes) {
      // Находим соответствующий проект
      const targetProject = projectHash === props.project.project_hash
        ? props.project
        : parentProject.value;

      if (!targetProject) {
        throw new Error(`Проект с хэшем ${projectHash} не найден`);
      }

      // roles: [] — роли в форме отклика больше не выбираются
      const contributionWithMeta = JSON.stringify({
        text: contribution,
        roles: [] as string[],
      });

      // Передаем объект проекта и родительский проект (если есть)
      await respondToInvite(
        targetProject,
        info.coopname,
        contributionWithMeta,
        targetProject.parent_hash ? parentProject.value : null
      );
    }

    SuccessAlert('Отклик отправлен успешно!');
    dialogRef.value?.clear();

    // Уведомляем родительский компонент об успешной отправке запроса на допуск
    emit('clearance-submitted');

  } catch (error) {
    console.error('Ошибка при отправке отклика:', error);
    FailAlert(error, 'Не удалось отправить отклик');
  } finally {
    isSubmitting.value = false;
  }
};

// Загружаем родительский проект и инициализируем форму при монтировании компонента
onMounted(async () => {
  await loadParentProject();
  initializeForm();
});

// Следим за изменениями проекта и перезагружаем родительский проект при необходимости
watch(() => props.project, async (newProject, oldProject) => {
  if (newProject?.parent_hash !== oldProject?.parent_hash) {
    await loadParentProject();
  }
}, { deep: true });

// Следим за изменениями в профиле и обновляем предзаполнение, если пользователь ещё не правил текст
watch(() => contributorStore.self?.about, (newAbout, oldAbout) => {
  if (!contributionText.value.trim() || contributionText.value === (oldAbout || '')) {
    contributionText.value = newAbout || '';
  }
});

const openJoinDialog = () => {
  if (isSubmitting.value) {
    return;
  }
  dialogRef.value?.openDialog();
};

defineExpose({
  openDialog: openJoinDialog,
});
</script>
