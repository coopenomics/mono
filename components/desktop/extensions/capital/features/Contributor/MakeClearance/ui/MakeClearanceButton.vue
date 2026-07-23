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

      .text-body2.text-weight-medium.q-mb-sm
        | Выберите роли участия

      RoleSelector(
        v-model="selectedRoles"
        :roles="roleOptions"
        :mini="true"
      ).q-mb-md

      template(v-if="shouldShowContributionField")
        q-input(
          v-model="contributionText"
          type="textarea"
          label="Опишите какой вклад вы можете внести в проект"
          outlined
          rows="4"
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
import { RoleSelector, type RoleOption } from 'app/extensions/capital/shared/ui';

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

// Роли участия (включая роль "ранний участник" для мини-версии)
const roleOptions: RoleOption[] = [
  {
    value: 'master',
    title: 'Мастер',
    description: 'Управляет процессом создания результатов'
  },
  {
    value: 'author',
    title: 'Соавтор',
    description: 'Принимает участие в постановке задания для производства результата'
  },
  {
    value: 'creator',
    title: 'Исполнитель',
    description: 'Создает результат, вкладывая время и компетенцию'
  },
  {
    value: 'investor',
    title: 'Инвестор',
    description: 'Вкладывает деньги в проект для производства результата'
  },
  {
    value: 'coordinator',
    title: 'Координатор',
    description: 'Распространяет информацию и привлекает финансирование'
  },
  {
    value: 'contributor',
    title: 'Участник',
    description: 'Получает долю в результате по условию раннего участия'
  }
];

const dialogRef = ref();
const contributionText = ref('');
const selectedRoles = ref<string[]>([]);
const isSubmitting = ref(false);
const parentProject = ref<IGetProjectOutput | null>(null);

// Показывать поле вклада только если выбрана роль мастера, автора или исполнителя
const shouldShowContributionField = computed(() => {
  return selectedRoles.value.includes('master') || selectedRoles.value.includes('author') || selectedRoles.value.includes('creator');
});

// Кнопка disabled если не выбрана роль или выбрана роль требующая "О себе" и поле пустое
const isSubmitDisabled = computed(() => {
  const hasSelectedRoles = selectedRoles.value.length > 0;
  const requiresContribution = shouldShowContributionField.value;
  const hasContributionText = contributionText.value.trim().length > 0;

  return !hasSelectedRoles || (requiresContribution && !hasContributionText);
});

// Функция загрузки родительского проекта
const loadParentProject = async () => {
  if (!props.project?.parent_hash) {
    parentProject.value = null;
    return;
  }

  try {
    // Ищем родительский проект в store
    const existingParent = projectStore.projects.items.find(
      p => p.project_hash === props.project?.parent_hash
    );

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
  // Предзаполняем поле значением из "О себе" как шаблоном
  contributionText.value = contributorStore.self?.about || '';
  selectedRoles.value = [];
};

// Функция очистки формы
const clear = () => {
  initializeForm();
};

// Обработчик подтверждения отклика
const handleConfirmRespond = async () => {
  if (!props.project) return;

  // Проверяем что выбрана хотя бы одна роль
  if (selectedRoles.value.length === 0) {
    FailAlert('Выберите хотя бы одну роль участия');
    return;
  }

  isSubmitting.value = true;
  try {
    // Формируем текст вклада
    const contribution = contributionText.value.trim() || 'Участие в проекте';
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

      // Формируем мета-данные с ролями
      const contributionWithMeta = JSON.stringify({
        text: contribution,
        roles: selectedRoles.value
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

// Следим за изменениями в профиле пользователя и обновляем предзаполненное значение
watch(() => contributorStore.self?.about, (newAbout) => {
  // Обновляем значение только если поле пустое или равно старому значению "О себе"
  if (!contributionText.value.trim() || contributionText.value === contributorStore.self?.about) {
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
