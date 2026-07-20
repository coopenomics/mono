<template lang="pug">
q-card(flat, style='margin-left: 20px; ')

  // Таблица сегментов проекта
  q-table(
    :rows='allSegments',
    :columns='columns',
    row-key='username',
    :loading='loading',
    flat,
    square,
    hide-header,
    :no-data-label='hasSegments ? "Нет сегментов в этом проекте" : "Загрузка..."'
  )
    template(#body='tableProps')
      q-tr(
        :props='tableProps',
        @click='handleSegmentClick(tableProps.row.username)'
        style='cursor: pointer'
      )
        q-td(style='width: 35px')
          ExpandToggleButton(
            :expanded='expanded[tableProps.row.username]',
            @click='handleToggleExpand(tableProps.row.username)'
          )
        q-td
          .participant-info
            .participant-name {{ tableProps.row.display_name }}
            .participant-roles
              RoleBadges(
                :segment='tableProps.row',
                mode='chips',
                size='sm'
              )
            div(v-if='tableProps.row.status !== Zeus.SegmentStatus.GENERATION').row
              div.q-pa-sm.col-md-4.col-sm-12
                ColorCard(color='blue')
                  .card-label Стоимость Генерации ({{ calculateGeneration(tableProps.row).share }}%)
                  .card-value {{ formatAsset2Digits(`${calculateGeneration(tableProps.row).amount} ${info.symbols.root_govern_symbol}`) }}

              div.q-pa-sm.col-md-4.col-sm-12
                ColorCard(color='teal')
                  .card-label Стоимость Благороста ({{ calculateBlagorost(tableProps.row).share }}%)
                  .card-value {{ formatAsset2Digits(`${calculateBlagorost(tableProps.row).amount} ${info.symbols.root_govern_symbol}`) }}

              div.q-pa-sm.col-md-4.col-sm-12
                ColorCard(color='purple')
                  .card-label Всего ({{ tableProps.row.share_percent.toFixed(2) }}%)
                  .card-value {{ formatAsset2Digits(`${tableProps.row.intellectual_cost} ${info.symbols.root_govern_symbol}`) }}

            slot(name='actions' :segment='tableProps.row')






              //- ColorCard(color='blue')
              //-   .card-label Имущественный Взнос
              //-   .card-value {{ formatAsset2Digits(`${tableProps.row.investor_base || 0} ${info.symbols.root_govern_symbol}`) }}

      // Слот для дополнительного контента (детали сегмента)
      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='expanded[tableProps.row.username]',
        :key='`e_${tableProps.row.username}`'
      )
        q-td(colspan='100%').expanded-row

          SegmentResultInfoWidget(:segment='tableProps.row')
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSegmentStore, type ISegment } from 'app/extensions/capital/entities/Segment/model';
import { SegmentResultInfoWidget } from '../SegmentResultInfoWidget';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { FailAlert } from 'src/shared/api';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { useSystemStore } from 'src/entities/System/model';
import { Zeus } from '@coopenomics/sdk';
import { RoleBadges } from '../../shared/ui/RoleBadges';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';

interface Props {
  projectHash: string;
  coopname: string;
  expanded: Record<string, boolean>;
  project?: IProject;
}

interface Emits {
  (e: 'toggle-expand', value: string): void;
  (e: 'segment-click', value: string): void;
  (e: 'data-loaded', value: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const segmentStore = useSegmentStore();
const { info } = useSystemStore();

const loading = ref(false);

// Колонки таблицы
const columns = [
  {
    name: 'expand',
    label: '',
    align: 'left' as const,
    field: '',
  },
  {
    name: 'participant',
    label: 'Участник',
    align: 'left' as const,
    field: 'username',
  },
  {
    name: 'actions',
    label: 'Действия',
    align: 'right' as const,
    field: '',
  },
];

// Все сегменты проекта
const allSegments = computed(() => {
  return segmentStore.getSegmentsByProject(props.projectHash)?.items || [];
});

// Проверка наличия сегментов
const hasSegments = computed(() => {
  return allSegments.value.length > 0;
});

// Расчет суммы и доли "Генерация"
const calculateGeneration = (segment: ISegment) => {
  const amount = (
    parseFloat(segment.creator_base || '0') +
    parseFloat(segment.author_base || '0') +
    parseFloat(segment.direct_creator_bonus || '0') +
    parseFloat(segment.equal_author_bonus || '0') +
    parseFloat(segment.coordinator_base || '0') +
    parseFloat(segment.property_base || '0') +
    parseFloat(segment.voting_bonus || '0')
  );

  const total = parseFloat(props.project?.fact?.total?.split(' ')[0] || '1');
  const share = (amount / total) * 100;

  return {
    amount,
    share: share.toFixed(2),
  };
};

// Расчет суммы и доли "Благорост"
const calculateBlagorost = (segment: ISegment) => {
  const amount = parseFloat(segment.contributor_bonus || '0');
  const total = parseFloat(props.project?.fact?.total?.split(' ')[0] || '1');
  const share = (amount / total) * 100;

  return {
    amount,
    share: share.toFixed(2),
  };
};

// Загрузка всех сегментов проекта
const loadProjectSegments = async () => {
  loading.value = true;

  try {
    await segmentStore.loadSegments({
      filter: {
        coopname: props.coopname,
        project_hash: props.projectHash,
      },
      options: {
        page: 1,
        limit: 1000, // Увеличиваем лимит для получения всех сегментов
        sortOrder: 'ASC',
      },
    });

    // Эмитим загруженные username для очистки expanded состояния
    const usernames = segmentStore.getSegmentsByProject(props.projectHash)?.items.map((s: any) => s.username) || [];
    emit('data-loaded', usernames);
  } catch (error) {
    console.error('Ошибка при загрузке сегментов проекта:', error);
    FailAlert('Не удалось загрузить сегменты проекта');
  } finally {
    loading.value = false;
  }
};

const handleSegmentClick = (username: string) => {
  emit('segment-click', username);
};

const handleToggleExpand = (username: string) => {
  emit('toggle-expand', username);
};

// Загружаем данные при монтировании
onMounted(async () => {
  await loadProjectSegments();
});

// Перезагружаем при изменении projectHash
watch(() => props.projectHash, async () => {
  await loadProjectSegments();
});

</script>

<style lang="scss" scoped>
.result-header {
  padding: 16px 0;
}

.card-sub-value {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: -2px;
}

.participant-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.participant-name {
  font-weight: 500;
  color: #1976d2;
  font-size: 1rem;
}

.participant-roles {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.participant-actions {
  margin-top: 8px;
}

.expanded-row {
  padding-left: 0 !important;
}

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
