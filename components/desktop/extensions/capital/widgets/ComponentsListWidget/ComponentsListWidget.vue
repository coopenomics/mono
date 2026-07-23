<template lang="pug">
div
  q-table(
    :rows='components || []',
    :columns='columns',
    row-key='project_hash',
    :loading='false',
    :pagination='{ rowsPerPage: 0 }',
    flat,
    square,
    hide-header,
    hide-pagination,
  )
    template(#body='props')
      q-tr(
        :props='props'
      )
        q-td
          .row.items-center.component-row
            // Кнопка раскрытия
            .col-auto.component-row__toggle
              ExpandToggleButton(
                :expanded='expanded[props.row.project_hash]',
                @click='handleToggleComponent(props.row.project_hash)'
              )

            // ID — плоский muted-текст фиксированной колонки (Linear-style)
            .col-auto.component-row__id
              EntityIdBadge(
                v-if='props.row.id'
                :raw-id='props.row.id'
                copy-on-click
                address-clipboard
                flat
              )

            // Статус — фиксированный слот, заголовки уровня стартуют с одной координаты
            .col-auto.row-status
              q-icon(
                :name='getProjectStatusIcon(props.row.status)',
                :color='getProjectStatusDotColor(props.row.status)',
                size='xs'
              )

            // Title
            .col.component-row__title-col
              .list-item-title(
                @click.stop='handleOpenComponent(props.row.project_hash)'
              )
                span {{ props.row.title }}

            // Правая сетка строки: время | инвестиции | действие —
            // фиксированные колонки, одинаковые для всех уровней дерева
            .col-auto.row-cells
              .cell-time
                .row-meta
                  q-icon(name='schedule', size='14px')
                  span.t-mono-sm {{ formatHoursFactPlan(props.row.fact?.creators_hours, props.row.plan?.creators_hours) }}
                  q-tooltip Часы исполнителей: факт / план
              .cell-side
                .row-meta(v-if='hasInvestMeta(props.row.fact?.total_received_investments, props.row.plan?.invest_pool)')
                  q-icon(name='payments', size='14px')
                  span.t-mono-sm {{ formatInvestFactPlan(props.row.fact?.total_received_investments, props.row.plan?.invest_pool) }}
                  q-tooltip Инвестиции: привлечено / план
              .cell-actions
                // Мастер — ответственный за компонент (зеркально исполнителям задач)
                SetMasterAvatar(:project='props.row')
                //- ProjectMenuWidget(:project='props.row', @click.stop)

      // Слот для дополнительного контента компонента
      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='expanded[props.row.project_hash]',
        :key='`e_${props.row.project_hash}`'
      )
        q-td.component-row__nested(colspan='100%')
          // Скелетон загрузки задач компонента
          .component-row__skeleton(v-if='loadingComponents[props.row.project_hash]')
            .skel.skel--num(v-for='i in 4', :key='i')
          // Реальный контент
          slot(v-else, name='component-content', :component='props.row')

    // Канон-пустое состояние вместо дефолтного q-table no-data
    template(#no-data)
      .list-empty
        q-icon(name='inbox', size='20px')
        span Нет компонентов

  // Полоска-добавлялка после всех компонентов проекта
  CreateComponentButton(
    v-if='project && project.permissions?.can_edit_project',
    :project='project',
    row
  )
</template>
<script lang="ts" setup>
import { ref, watch } from 'vue';
import type { IProject, IProjectComponent } from 'app/extensions/capital/entities/Project/model';
import {
  getProjectStatusIcon,
  getProjectStatusDotColor,
} from 'app/extensions/capital/shared/lib/projectStatus';
import { formatHoursFactPlan, formatInvestFactPlan, hasInvestMeta } from 'app/extensions/capital/shared/lib';
import { SetMasterAvatar } from 'app/extensions/capital/features/Project/SetMaster';
import { CreateComponentButton } from 'app/extensions/capital/features/Project/CreateComponent';
import { EntityIdBadge } from 'src/shared/ui';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
// import { ProjectMenuWidget } from 'app/extensions/capital/widgets/ProjectMenuWidget';

const props = defineProps<{
  components: IProjectComponent[] | undefined;
  expanded: Record<string, boolean>;
  expandAll?: boolean;
  /** Родительский проект — для полоски «Добавить компонент» в конце списка */
  project?: IProject;
}>();

const emit = defineEmits<{
  openComponent: [projectHash: string];
  toggleComponent: [componentHash: string];
}>();

// Локальное состояние загрузки для каждого компонента
const loadingComponents = ref<Record<string, boolean>>({});

// Watcher для автоматического развертывания/сворачивания всех компонентов
watch(() => props.expandAll, (newValue, oldValue) => {
  if (props.components && newValue !== oldValue) {
    if (newValue) {
      // Небольшая задержка, чтобы компоненты успели загрузиться после разворота проектов
      setTimeout(() => {
        if (props.components) {
          props.components.forEach((component) => {
            if (!props.expanded[component.project_hash]) {
              emit('toggleComponent', component.project_hash);
            }
          });
        }
      }, 200);
    } else {
      // Свернуть все компоненты
      props.components.forEach((component) => {
        if (props.expanded[component.project_hash]) {
          emit('toggleComponent', component.project_hash);
        }
      });
    }
  }
});

// Watcher для применения expandAll после загрузки компонентов
watch(() => props.components, (newComponents) => {
  if (newComponents && props.expandAll) {
    // Небольшая задержка для стабильности
    setTimeout(() => {
      if (props.components) {
        props.components.forEach((component) => {
          if (!props.expanded[component.project_hash]) {
            emit('toggleComponent', component.project_hash);
          }
        });
      }
    }, 50);
  }
});

const handleToggleComponent = (componentHash: string) => {
  // Если компонент разворачивается (становится expanded), устанавливаем loading
  if (!props.expanded[componentHash]) {
    loadingComponents.value[componentHash] = true;
    // Снимаем loading через 100мс, чтобы кнопка реагировала сразу
    setTimeout(() => {
      loadingComponents.value[componentHash] = false;
    }, 100);
  }
  emit('toggleComponent', componentHash);
};

const handleOpenComponent = (componentHash: string) => {
  emit('openComponent', componentHash);
};

// Определяем столбцы таблицы
const columns = [
  {
    name: 'expand',
    label: '',
    align: 'center' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'prefix',
    label: 'Префикс',
    align: 'left' as const,
    field: 'prefix' as const,
    sortable: true,
  },
  {
    name: 'name',
    label: 'Название',
    align: 'left' as const,
    field: 'title' as const,
    sortable: true,
  },
  {
    name: 'master',
    label: '',
    align: 'right' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'actions',
    label: '',
    align: 'right' as const,
    field: '' as const,
    sortable: false,
  },
];
</script>

<style lang="scss" scoped>
// Структурные ширины колонок строки компонента. Собственного отступа
// уровня нет — каскадный отступ задаёт родительский виджет, чтобы при
// одиночном использовании список начинался от края
.component-row {
  padding-right: var(--p-3);
  min-height: 48px;
}

.component-row__toggle {
  width: 28px;
  flex-shrink: 0;
}

.component-row__id {
  width: 96px;
  flex-shrink: 0;
}

.row-status {
  width: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

// Вложенный уровень (задачи компонента) — отступ каскада
.component-row__nested {
  padding: 0 0 0 var(--p-7) !important;

  @media (max-width: 640px) {
    padding-left: var(--p-3) !important;
  }
}

// Правая сетка строки — фиксированные колонки, общие для всех уровней
// дерева (проект/компонент/задача): время | статус-инвестиции | действия
.row-cells {
  display: flex;
  align-items: center;
}

.cell-time {
  width: 110px;
  display: flex;
  justify-content: flex-end;
}

.cell-side {
  width: 132px;
  display: flex;
  justify-content: flex-end;
}

.cell-actions {
  width: 160px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--p-2);
}

@media (max-width: 640px) {
  .cell-time,
  .cell-side {
    display: none;
  }

  .cell-actions {
    width: auto;
  }
}

.row-meta {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-ink-3);
  white-space: nowrap;
}

// Канон-пустое состояние списка
.list-empty {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
  padding: var(--p-3) var(--p-4);
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}

.component-row__skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding: var(--p-4);
}

.q-table {
  tr {
    min-height: 48px;
  }

  .q-td {
    padding: 0; // строка использует внутренние отступы .component-row
  }
}

:deep(.list-item-title) {
  display: inline-block;
  vertical-align: top;
  word-wrap: break-word;
  white-space: normal;
  font-size: var(--p-fs-body);
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: var(--p-primary);
  }
}
</style>
