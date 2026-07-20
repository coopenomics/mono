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
    hide-header,
    no-data-label='Нет проектов для отправки результатов'
  )
    template(#body='tableProps')
      q-tr(
        :props='tableProps',
        @click='handleProjectClick(tableProps.row.project_hash)'
        style='cursor: pointer'
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

            ColorCard(color="blue")
              .card-label Стоимость Генерации ({{ calcShare(tableProps.row, 'total_generation_pool') }}%)
              .card-value {{ formatAsset2Digits(tableProps.row.fact?.total_generation_pool || `0 ${info.symbols.root_govern_symbol}`) }}


            ColorCard(color="teal")
              .card-label Стоимость Благороста ({{ calcShare(tableProps.row, 'contributors_bonus_pool') }}%)
              .card-value {{ formatAsset2Digits(tableProps.row.fact?.contributors_bonus_pool || `0 ${info.symbols.root_govern_symbol}`) }}


            ColorCard(color="purple")
              .card-label Стоимость ОАП (100.00%)
              .card-value {{ formatAsset2Digits(tableProps.row.fact?.total || `0 ${info.symbols.root_govern_symbol}`) }}
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
import { useSystemStore } from 'src/entities/System/model';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { Zeus } from '@coopenomics/sdk';
import { ProjectComponentInfo } from '../../shared/ui/ProjectComponentInfo';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';

interface Props {
  coopname: string;
  expanded: Record<string, boolean>;
}

interface Emits {
  (e: 'toggle-expand', value: string): void;
  (e: 'project-click', value: string): void;
  (e: 'data-loaded', value: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const projectStore = useProjectStore();
const { info } = useSystemStore();

const loading = ref(false);
const pagination = ref({
  page: 1,
  rowsPerPage: 100,
  rowsNumber: 0,
});

const projects = computed(() => projectStore.projects);


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
    name: 'status',
    label: 'Информация',
    align: 'right' as const,
    field: 'status',
  },
];

const onRequest = async (props: any) => {
  loading.value = true;

  try {
    await projectStore.loadProjects({
      filter: {
        coopname: props.coopname,
        statuses: [Zeus.ProjectStatus.VOTING, Zeus.ProjectStatus.RESULT, Zeus.ProjectStatus.CANCELLED],
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
  } catch (error) {
    console.error('Error loading result projects:', error);
  } finally {
    loading.value = false;
  }
};

const handleProjectClick = (projectHash: string) => {
  emit('project-click', projectHash);
};

const handleToggleExpand = (projectHash: string) => {
  emit('toggle-expand', projectHash);
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

const calcShare = (row: any, fieldName: string) => {
  const value = row.fact?.[fieldName];
  const total = row.fact?.total;

  if (!value || !total) return '0.00';

  const valueNum = parseFloat(value.split(' ')[0] || '0');
  const totalNum = parseFloat(total.split(' ')[0] || '1');

  if (totalNum === 0) return '0.00';

  const percentage = (valueNum / totalNum) * 100;
  return percentage.toFixed(2);
};
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
