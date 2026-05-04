<template lang="pug">
div

  q-card(flat)
    q-card-section(style='padding: 0px')
      q-table(
        :rows='requirements?.items || []',
        :columns='columns',
        :pagination='{ rowsPerPage: 0 }',
        row-key='_id',
        :loading='loading',
        flat,
        square,
        hide-header,
        hide-pagination
        no-data-label="Нет артефактов"
      )
        template(#body='props')
          q-tr(
            :props='props'
            @click='handleRequirementClick(props.row)'
            style='cursor: pointer'
          )
            q-td
              .row.items-center(style='padding: 12px; min-height: 48px')
                // Пустое пространство для выравнивания с проектами/компонентами (35px)
                .col-auto(style='width: 35px; flex-shrink: 0')


                // Иконка типа (кликабельная)
                .col-auto(style='width: 32px; flex-shrink: 0')
                  q-icon(
                    v-if="props.row"
                    :name='storyContentIcon(props.row)',
                    size='sm',
                    style='cursor: pointer; color: #666'
                    @click.stop='handleRequirementTypeClick(props.row)'
                  )

                // Заголовок; бейдж компонента — строкой ниже, мельче
                .col
                  .column.items-start(
                    style='word-wrap: break-word; white-space: normal; cursor: pointer; width: 100%'
                  )
                    span.text-body2.font-weight-medium.list-item-title {{ props.row.title }}
                    .q-mt-xs(
                      v-if='shouldShowComponentScopeBadge(props.row)'
                      @click.stop
                    )
                      EntityIdBadge.requirements-list__component-source-badge(
                        :raw-id='componentScopeBadgeText(props.row)'
                        @click='onComponentScopeBadgeClick(props.row)'
                      )


                // Кнопка удаления (правый край)
                .col-auto.ml-auto
                  DeleteStoryButton(
                    v-if='canDeleteRequirement',
                    :story-hash='props.row.story_hash',
                    @deleted='onRequirementDeleted',
                    @close='onDeleteDialogClose',
                    @click.stop
                  )

  // Диалог просмотра/редактирования артефакта
  EditRequirementDialog(
    ref='editDialog'
    :requirement='selectedRequirement'
    :canEdit='canEditRequirement'
    @updated='handleRequirementUpdated'
    @close='handleDialogClose'
  )
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import {
  type IStory,
  useStoryStore,
  type IGetStoriesInput,
} from 'app/extensions/capital/entities/Story/model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { DeleteStoryButton } from 'app/extensions/capital/features/Story/DeleteStory';
import { EditRequirementDialog } from 'app/extensions/capital/features/Story/EditRequirement';
import type { IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import type { IIssuePermissions } from 'app/extensions/capital/entities/Issue/model';
import { EntityIdBadge } from 'src/shared/ui/EntityIdBadge';

const props = withDefaults(
  defineProps<{
    filter?: Partial<IGetStoriesInput['filter']>;
    maxItems?: number;
    permissions?: IProjectPermissions | IIssuePermissions | null;
    /** Имя маршрута карточки артефакта (project-requirement-detail / component-requirement-detail) */
    detailRouteName?: string;
    /** На странице артефактов корневого проекта — подпись и ссылка на компонент для чужих project_hash */
    showComponentScopeBadge?: boolean;
  }>(),
  { showComponentScopeBadge: false },
);

const storyStore = useStoryStore();
const { info } = useSystemStore();
const router = useRouter();
const editDialog = ref();
const selectedRequirement = ref<IStory | null>(null);

// Проверка прав на редактирование артефакта
const canEditRequirement = computed(() => {
  return props.permissions?.can_edit_requirement ?? false;
});

// Проверка прав на удаление артефакта
const canDeleteRequirement = computed(() => {
  return props.permissions?.can_delete_requirement ?? false;
});


// Кэш для хранения загруженных названий проектов и задач
const projectTitles = ref<Record<string, string>>({});
const issueTitles = ref<Record<string, string>>({});
const loadingTitles = ref<Record<string, boolean>>({});

const loading = ref(false);

const listContextProjectHash = computed(() => props.filter?.project_hash ?? '');

const shouldShowComponentScopeBadge = (row: IStory): boolean => {
  if (!props.showComponentScopeBadge) return false;
  const ctx = listContextProjectHash.value;
  const ph = row.project_hash;
  if (!ctx || !ph) return false;
  return ph !== ctx;
};

const componentScopeBadgeText = (row: IStory): string => {
  const ph = row.project_hash;
  if (!ph) return '';
  const full = projectTitles.value[ph];
  if (full) {
    const cleaned = full.replace(/^\[(Компонент|Проект)\]\s*/, '').trim();
    return cleaned || full;
  }
  return `${ph.slice(0, 8)}…`;
};

const onComponentScopeBadgeClick = (row: IStory) => {
  const ph = row.project_hash;
  if (!ph) return;
  void router.push({
    name: 'component-description',
    params: { project_hash: ph },
  });
};

const storyContentIcon = (row: IStory): string => {
  if (row.content_format === Zeus.CapitalStoryContentFormat.BPMN) {
    return 'account_tree';
  }
  if (row.content_format === Zeus.CapitalStoryContentFormat.DRAWIO) {
    return 'device_hub';
  }
  if (row.content_format === Zeus.CapitalStoryContentFormat.MERMAID) {
    return 'schema';
  }
  return 'description';
};

// Реактивная связь с store
const requirements = computed(() => {
  if (!storyStore.stories) return null;

  // Сортируем артефакты по sort_order
  const sortedItems = [...storyStore.stories.items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }
    return 0;
  });

  // Ограничиваем количество элементов если указано maxItems
  if (props.maxItems && sortedItems.length > props.maxItems) {
    return {
      ...storyStore.stories,
      items: sortedItems.slice(0, props.maxItems),
    };
  }

  return {
    ...storyStore.stories,
    items: sortedItems,
  };
});

// // Функция для получения названия источника артефакта
// const getSourceTitle = (requirement: IStory): string => {
//   const key = requirement.issue_hash || requirement.project_hash;
//   if (!key) return 'Артефакт';

//   if (requirement.issue_hash) {
//     if (issueTitles.value[requirement.issue_hash]) {
//       return `Задача: ${issueTitles.value[requirement.issue_hash]}`;
//     }
//     return loadingTitles.value[key] ? 'Загрузка...' : `Задача #${requirement.issue_hash.substring(0, 6)}`;
//   }

//   if (requirement.project_hash) {
//     if (projectTitles.value[requirement.project_hash]) {
//       const title = projectTitles.value[requirement.project_hash];
//       const isComponent = title.startsWith('[Компонент]');
//       const cleanTitle = title.replace(/^\[Компонент\]|\[Проект\]/, '').trim();
//       return isComponent ? `Компонент: ${cleanTitle}` : `Проект: ${cleanTitle}`;
//     }

//     const currentProjectHash = props.filter?.project_hash;
//     if (currentProjectHash && requirement.project_hash === currentProjectHash) {
//       return loadingTitles.value[key] ? 'Загрузка...' : 'Артефакт текущего проекта';
//     } else {
//       return loadingTitles.value[key] ? 'Загрузка...' : 'Артефакт компонента';
//     }
//   }

//   return 'Артефакт';
// };

// Функция для загрузки названия источника артефакта
const loadSourceTitle = async (requirement: IStory) => {
  const key = requirement.issue_hash || requirement.project_hash;
  if (!key || loadingTitles.value[key]) return;

  loadingTitles.value[key] = true;

  try {
    if (requirement.issue_hash && !issueTitles.value[requirement.issue_hash]) {
      const issueData = await IssueApi.loadIssue({
        issue_hash: requirement.issue_hash,
      });

      if (issueData?.title) {
        issueTitles.value[requirement.issue_hash] = issueData.title;
      }
    }

    if (requirement.project_hash && !projectTitles.value[requirement.project_hash]) {
      const projectData = await ProjectApi.loadProject({
        hash: requirement.project_hash,
      });

      if (projectData?.title) {
        const prefix = projectData.parent_hash ? '[Компонент]' : '[Проект]';
        projectTitles.value[requirement.project_hash] = `${prefix}${projectData.title}`;
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке названия:', error);
  } finally {
    loadingTitles.value[key] = false;
  }
};

// Определяем столбцы таблицы артефактов
const columns = [
  {
    name: 'expand',
    label: '',
    align: 'center' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'status',
    label: 'Статус',
    align: 'center' as const,
    field: 'status' as const,
    sortable: true,
  },
  {
    name: 'title',
    label: 'Артефакт',
    align: 'left' as const,
    field: 'title' as const,
    sortable: true,
  },
  {
    name: 'type',
    label: 'Тип',
    align: 'right' as const,
    field: '' as const,
    sortable: false,
  },
];

// Загрузка артефактов
const loadRequirements = async () => {
  loading.value = true;
  try {
    const filter: IGetStoriesInput['filter'] = {
      coopname: info.coopname,
      ...props.filter,
    };

    const options: IGetStoriesInput['options'] = {
      page: 1,
      limit: props.maxItems || 50,
      sortBy: '_created_at',
      sortOrder: 'DESC',
    };

    await storyStore.loadStories({ filter, options });
  } catch (error) {
    console.error('Ошибка при загрузке артефактов:', error);
    FailAlert('Не удалось загрузить артефакты');
  } finally {
    loading.value = false;
  }
};



// // Функция для получения иконки типа артефакта
// const getRequirementTypeIcon = (requirement: IStory): string => {
//   if (requirement?.issue_hash) {
//     return 'task'; // Иконка для задачи
//   }
//   if (requirement?.project_hash) {
//     // Проверяем, относится ли артефакт к текущему проекту или к компоненту
//     const currentProjectHash = props.filter?.project_hash;
//     if (currentProjectHash && requirement.project_hash === currentProjectHash) {
//       return 'folder'; // Иконка для проекта
//     } else {
//       return 'extension'; // Иконка для компонента
//     }
//   }
//   return 'description'; // Иконка для обычного артефакта
// };


// Обработчик клика по типу артефакта (бейдж)
const handleRequirementTypeClick = async (requirement: IStory) => {
  if (requirement?.issue_hash && requirement?.project_hash) {
    // Определяем тип родительского проекта для правильного маршрута задачи
    try {
      const projectData = await ProjectApi.loadProject({
        hash: requirement.project_hash,
      });

      if (projectData) {
        // Если у проекта есть parent_hash, это компонент - используем component-issue
        const routeName = projectData.parent_hash ? 'component-issue' : 'project-issue';

        router.push({
          name: routeName,
          params: {
            project_hash: requirement.project_hash,
            issue_hash: requirement.issue_hash
          }
        });
      }
    } catch (error) {
      console.error('Ошибка при определении типа родительского проекта:', error);
      // Fallback - пробуем project-issue
      router.push({
        name: 'project-issue',
        params: {
          project_hash: requirement.project_hash,
          issue_hash: requirement.issue_hash
        }
      });
    }
  } else if (requirement?.project_hash) {
    // Определяем тип целевого проекта (проект или компонент)
    try {
      const projectData = await ProjectApi.loadProject({
        hash: requirement.project_hash,
      });

      if (projectData) {
        // Если у проекта есть parent_hash, это компонент
        const routeName = projectData.parent_hash ? 'component-description' : 'project-description';

        router.push({
          name: routeName,
          params: {
            project_hash: requirement.project_hash
          }
        });
      }
    } catch (error) {
      console.error('Ошибка при определении типа проекта:', error);
      // Fallback - переходим на страницу проекта
      router.push({
        name: 'project-description',
        params: {
          project_hash: requirement.project_hash
        }
      });
    }
  }
};

// Обработчики для DeleteStoryButton
const onRequirementDeleted = () => {
  // Артефакт будет автоматически удалён из списка через store
};

const onDeleteDialogClose = () => {
  // Обработка закрытия диалога
};

// Обработчик клика на артефакт: переход на страницу или диалог (списки без detailRouteName)
const handleRequirementClick = (requirement: IStory) => {
  const ph = props.filter?.project_hash;
  if (props.detailRouteName && ph) {
    void router.push({
      name: props.detailRouteName,
      params: { project_hash: ph, story_hash: requirement.story_hash },
    });
    return;
  }
  selectedRequirement.value = requirement;
  editDialog.value?.openDialog();
};

// Обработчик обновления артефакта
const handleRequirementUpdated = (updatedRequirement: IStory) => {
  if (
    selectedRequirement.value?.story_hash === updatedRequirement.story_hash
  ) {
    selectedRequirement.value = updatedRequirement;
  }
};

// Обработчик закрытия диалога
const handleDialogClose = () => {
  selectedRequirement.value = null;
};

// Загрузка названий источников для видимых артефактов
const loadVisibleTitles = async () => {
  if (requirements.value?.items) {
    const loadPromises = requirements.value.items.map(req => loadSourceTitle(req));
    await Promise.allSettled(loadPromises);
  }
};

// Watcher для загрузки названий при изменении артефактов
watch(requirements, async (newRequirements) => {
  if (newRequirements?.items) {
    await loadVisibleTitles();
  }
}, { immediate: true });

// Инициализация
onMounted(async () => {
  await loadRequirements();
  await loadVisibleTitles();
});
</script>

<style lang="scss" scoped>
:deep(.requirements-list__component-source-badge.entity-id-badge__pill) {
  font-size: 0.6875rem;
  line-height: 1.25;
  padding: 1px 6px;
  font-weight: 500;
}

.q-table {
  tr {
    min-height: 48px;
  }

  .q-td {
    padding: 0; // Убираем padding таблицы, так как теперь используем внутренний padding
  }
}

.q-chip {
  font-weight: 500;
}

// Стили для бейджей типов артефактов
.q-badge {
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-size: 8px;
}
</style>
