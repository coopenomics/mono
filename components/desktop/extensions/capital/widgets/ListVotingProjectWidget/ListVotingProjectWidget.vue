<template lang="pug">
q-card(flat)
  q-table(
    :rows='projects?.items || []',
    :columns='columns',
    row-key='project_hash',
    :pagination='pagination',
    @request='onRequest',
    flat,
    square,
    hide-pagination,
    hide-header,
    no-data-label='Нет проектов на голосовании'
  )
    template(#body='tableProps')
      q-tr(
        :props='tableProps'
      )
        q-td(style='width: 35px')
          ExpandToggleButton(
            :expanded='expanded[tableProps.row.project_hash]',
            @click='handleToggleExpand(tableProps.row.project_hash)'
          )
        q-td

          ProjectComponentInfo(
            :title='tableProps.row.title'
            :parent-title='tableProps.row.parent_title'
            :project-hash='tableProps.row.project_hash'
            :parent-hash='tableProps.row.parent_hash'
          )
        q-td.text-right
          .row.q-gutter-sm.justify-end

            ColorCard(:color='getDeadlineCardColor(tableProps.row.status)')
              .card-label Голосование до
              .card-value {{ getDeadlineCardText(tableProps.row.status, tableProps.row.voting?.voting_deadline) }}
            ColorCard(:color='getVotingStatus(tableProps.row.status).color')
              .card-label Статус
              .card-value {{ getVotingStatus(tableProps.row.status).text }}
            ColorCard(color='blue')
              .card-label На распределении
              .card-value {{ formatAsset2Digits(tableProps.row.voting?.amounts?.total_voting_pool || '0') }}
            ColorCard(color='purple', v-if='!isVotingCompleted(tableProps.row)')
              .card-label Голосующая сумма
              .card-value {{ formatAsset2Digits(tableProps.row.voting?.amounts?.active_voting_amount || '0') }}

      // Слот для дополнительного контента проекта
      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='expanded[tableProps.row.project_hash]',
        :key='`e_${tableProps.row.project_hash}`'
      )
        q-td(colspan='100%', style='padding: 0px !important')
          slot(name='project-content', :project='tableProps.row')

  // Слот для дополнительного контента
  slot
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useProjectStore } from '../../entities/Project/model';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { Zeus } from '@coopenomics/sdk';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { ProjectComponentInfo } from '../../shared/ui/ProjectComponentInfo';

interface Props {
  coopname: string;
  expanded: Record<string, boolean>;
}

interface Emits {
  (e: 'toggle-expand', value: string): void;
  (e: 'project-click', value: string): void;
  (e: 'data-loaded', value: string[]): void;
  (e: 'projects-loaded', value: any[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const projectStore = useProjectStore();

const loading = ref(false);
const pagination = ref({
  page: 1,
  rowsPerPage: 1000,
  rowsNumber: 0,
});

const projects = computed(() => projectStore.projects);

// Проверка, завершено ли голосование для проекта
const isVotingCompleted = (project: any) => {
  if (!project) return false;

  const status = String(project.status);
  const voting = project.voting;

  if (status === Zeus.ProjectStatus.RESULT || status === 'RESULT') return true;
  if (voting && voting.votes_received === voting.total_voters) return true;

  return false;
};

// Определение статуса голосования
const getVotingStatus = (status: string) => {
  const projectStatus = status as Zeus.ProjectStatus;
  if (projectStatus === Zeus.ProjectStatus.VOTING) {
    return { text: 'Активно', color: 'green' as const };
  } else if (projectStatus === Zeus.ProjectStatus.RESULT || projectStatus === Zeus.ProjectStatus.CANCELLED) {
    return { text: 'Завершено', color: 'orange' as const };
  }
  return { text: 'Неизвестно', color: 'grey' as const };
};

// Определение цвета для карточки "Голосование до"
const getDeadlineCardColor = (status: string) => {
  const projectStatus = status as Zeus.ProjectStatus;
  if (projectStatus === Zeus.ProjectStatus.RESULT || projectStatus === Zeus.ProjectStatus.CANCELLED) {
    return 'red' as const; // Завершено - красный
  }
  return 'blue' as const; // Активно - синий
};

// Определение текста для карточки "Голосование до"
const getDeadlineCardText = (status: string, deadline?: string) => {
  const projectStatus = status as Zeus.ProjectStatus;
  const formattedDeadline = formatVotingDeadline(deadline);

  if (projectStatus === Zeus.ProjectStatus.RESULT || projectStatus === Zeus.ProjectStatus.CANCELLED) {
    return `${formattedDeadline}`;
  }
  return formattedDeadline;
};

// // Склонение слова "участник"
// const getContributorWord = (count: number) => {
//   const lastDigit = count % 10;
//   const lastTwoDigits = count % 100;

//   if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
//     return 'участников';
//   }

//   if (lastDigit === 1) {
//     return 'участник';
//   }

//   if (lastDigit >= 2 && lastDigit <= 4) {
//     return 'участника';
//   }

//   return 'участников';
// };

// Колонки таблицы
const columns = [
  {
    name: 'expand',
    label: '',
    align: 'left' as const,
    field: '',
  },
  {
    name: 'title',
    label: 'Проект',
    align: 'left' as const,
    field: 'title',
  },
  {
    name: 'voting',
    label: 'Голосование',
    align: 'right' as const,
    field: 'voting',
  },
];

const onRequest = async (props: any) => {
  loading.value = true;

  try {
    await projectStore.loadProjects({
      filter: {
        coopname: props.coopname,
        has_voting: true, // Фильтр для проектов с голосованиями
      },
      options: {
        page: props.pagination.page,
        limit: props.pagination.rowsPerPage,
        sortOrder: 'DESC',
      },
    });

    // Обновляем пагинацию
    pagination.value.rowsNumber = projects.value.totalCount;

    // Эмитим загруженные хэши проектов для очистки expanded состояния
    const projectHashes = projects.value?.items.map(p => p.project_hash) || [];
    emit('data-loaded', projectHashes);

    // Эмитим полные объекты проектов для автоматического раскрытия активных голосований
    const loadedProjects = projects.value?.items || [];
    emit('projects-loaded', loadedProjects);
  } catch (error) {
    console.error('Error loading voting projects:', error);
  } finally {
    loading.value = false;
  }
};


const handleToggleExpand = (projectHash: string) => {
  emit('toggle-expand', projectHash);
};

const formatVotingDeadline = (deadline?: string) => {
  if (!deadline) return 'Не указано';

  try {
    const date = new Date(deadline);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return deadline;
  }
};

// Загружаем данные при монтировании
onMounted(() => {
  console.log('onMounted', props.coopname)
  onRequest({
    pagination: pagination.value,
    coopname: props.coopname,
  });
});

// Перезагружаем при изменении coopname
watch(() => props.coopname, () => {
  onRequest({
    pagination: pagination.value,
    coopname: props.coopname,
  });
});
</script>

<style lang="scss" scoped>

.card-value {
  font-size: 16px;
  font-weight: 500;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}

.card-label {
  font-size: var(--p-fs-body);
  color: var(--p-ink-2);
  margin-bottom: var(--p-1);
}
</style>
