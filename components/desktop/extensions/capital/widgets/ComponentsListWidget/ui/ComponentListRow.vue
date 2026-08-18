<template lang="pug">
.row.items-center.component-row
  // Кнопка раскрытия
  .col-auto.component-row__toggle
    ExpandToggleButton(
      :expanded='expanded',
      @click='emit("toggle")'
    )

  // ID — плоский muted-текст фиксированной колонки (Linear-style)
  .col-auto.component-row__id
    EntityIdBadge(
      v-if='component.id'
      :raw-id='component.id'
      copy-on-click
      address-clipboard
      flat
    )

  // Статус — фиксированный слот, заголовки уровня стартуют с одной координаты
  .col-auto.row-status
    q-icon(
      :name='getProjectStatusIcon(component.status)',
      :color='getProjectStatusDotColor(component.status)',
      size='xs'
    )

  // Title (+ приписка родительского проекта, когда компонент показан вне проекта)
  .col.component-row__title-col
    .title-stack
      .list-item-title(@click.stop='emit("open")')
        PrivateShieldIcon(:show='isPrivate')
        span {{ component.title }}
      span.context-label(
        v-if='parentLabel',
        role='link',
        tabindex='0',
        @click.stop='emit("open-parent")',
        @keydown.enter.prevent='emit("open-parent")'
      ) {{ parentLabel }}

  // Правая сетка строки: (слот времени) | (слот выравнивания) | действие —
  // время на уровне компонента пока скрыто — почти всегда нули
  .col-auto.row-cells
    .cell-time
    .cell-side
    .cell-actions
      // Мастер — ответственный за компонент (зеркально исполнителям задач)
      SetMasterAvatar(:project='component')
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { IProject, IProjectComponent } from 'app/extensions/capital/entities/Project/model';
import {
  getProjectStatusIcon,
  getProjectStatusDotColor,
} from 'app/extensions/capital/shared/lib/projectStatus';
import { SetMasterAvatar } from 'app/extensions/capital/features/Project/SetMaster';
import { EntityIdBadge } from 'src/shared/ui';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { PrivateShieldIcon } from 'app/extensions/capital/shared/ui';

const props = defineProps<{
  component: IProjectComponent | IProject;
  expanded?: boolean;
  /** Личный компонент — показать щит */
  isPrivate?: boolean;
  /** Приписать родительский проект под заголовком (список компонентов вне проекта) */
  showParent?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  open: [];
  openParent: [];
}>();

const parentLabel = computed(() =>
  props.showParent ? (props.component as IProject).parent_title || '' : '',
);
</script>

<style lang="scss" scoped>
// Структурные ширины колонок строки компонента. Собственного отступа
// уровня нет — каскадный отступ задаёт родительский виджет, чтобы при
// одиночном использовании список начинался от края.
//
// Линия снизу и подсветка на наведении раньше приходили от q-table; список
// собран строками, поэтому строка несёт их сама — иначе строки сливаются
// в сплошное полотно, а курсор не показывает, где он находится
.component-row {
  padding-right: var(--p-3);
  min-height: 48px;
  border-bottom: 1px solid var(--p-line);
  // Собственный белый фон: в раскрытом (подкрашенном) блоке проекта серым
  // остаётся только «пространство» вложения — полоски «Добавить…» и зона
  // отступа слева, сами строки компонентов читаются как контент
  background: var(--p-surface);
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--p-surface-3);
  }
}

.component-row__toggle {
  width: 28px;
  flex-shrink: 0;
}

.component-row__id {
  min-width: 28px;
  padding-right: var(--p-1);
  flex-shrink: 0;
}

.row-status {
  width: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

// Заголовок + приписка проекта — вертикальная стопка. Зазора между строками
// нет: интервал даёт сам line-height, иначе приписка «отлипает» от названия
// и читается как отдельная строка списка
.title-stack {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 100%;
  gap: 0;
}

.context-label {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  cursor: pointer;

  &:hover {
    color: var(--p-primary);
  }
}

// Правая сетка строки — фиксированные колонки, общие для всех уровней
// дерева (проект/компонент/задача): время | статус | люди. Ширины плотные,
// по самому широкому контенту колонки — группа читается цельным блоком
// у правого края, без растянутых пустот
.row-cells {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}

.cell-time {
  width: 80px;
  display: flex;
  justify-content: flex-end;
}

.cell-side {
  width: 112px;
  display: flex;
  justify-content: flex-end;
}

.cell-actions {
  width: 80px;
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

.list-item-title {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  vertical-align: top;
  word-wrap: break-word;
  white-space: normal;
  font-size: var(--p-fs-body);
  line-height: var(--p-lh-h3);
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: var(--p-primary);
  }
}
</style>
