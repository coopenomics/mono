<template lang="pug">
// Одна surface-плоскость: «+ Добавить» и список на одном фоне (canvas снаружи).
// Вложенный в Мастерскую — белое-на-белом, визуально невидимо.
.list-surface
  // Полоска-добавлялка перед списком компонентов проекта
  CreateComponentButton(
    v-if='project && project.permissions?.can_edit_project',
    :project='project',
    row
  )

  // Список — плоские строки: таблица не нужна, под строкой раскрывается
  // контент переменной высоты (задачи компонента)
  template(v-for='component in components || []', :key='component.project_hash')
    ComponentListRow(
      :component='component',
      :expanded='expanded[component.project_hash]',
      :is-private='isLocalRow(component)',
      :show-parent='showParent',
      @toggle='handleToggleComponent(component.project_hash)',
      @open='handleOpenComponent(component.project_hash)',
      @open-parent='emit("openParent", component.parent_hash || "")'
    )
    .component-row__nested(v-if='expanded[component.project_hash]')
      slot(name='component-content', :component='component')

  // Канон-пустое состояние списка
  .list-empty(v-if='!components || !components.length')
    q-icon(name='inbox', size='20px')
    span {{ $t('capital.componentsListWidget.emptyText') }}
</template>
<script lang="ts" setup>
import { watch } from 'vue';
import type { IProject, IProjectComponent } from 'app/extensions/capital/entities/Project/model';
import { CreateComponentButton } from 'app/extensions/capital/features/Project/CreateComponent';
import ComponentListRow from './ComponentListRow.vue';

const props = defineProps<{
  components: IProjectComponent[] | undefined;
  expanded: Record<string, boolean>;
  expandAll?: boolean;
  /** Родительский проект — для полоски «Добавить компонент» в начале списка */
  project?: IProject;
  /** Приписать проект под заголовком компонента (список компонентов вне проекта) */
  showParent?: boolean;
}>();

const emit = defineEmits<{
  openComponent: [projectHash: string];
  toggleComponent: [componentHash: string];
  openParent: [parentHash: string];
}>();

// «Развернуть всё»: раскрываем каждый компонент, как только включён режим и
// компоненты пришли — в каком бы порядке это ни случилось. Без задержек:
// список компонентов — факт, по которому и раскрываем.
const expandAllComponents = (): void => {
  props.components?.forEach((component) => {
    if (!props.expanded[component.project_hash]) emit('toggleComponent', component.project_hash);
  });
};

watch(
  () => props.expandAll,
  (newValue, oldValue) => {
    if (!props.components || newValue === oldValue) return;
    if (newValue) {
      expandAllComponents();
      return;
    }
    props.components.forEach((component) => {
      if (props.expanded[component.project_hash]) emit('toggleComponent', component.project_hash);
    });
  },
);

watch(
  () => props.components,
  (components) => {
    if (components && props.expandAll) expandAllComponents();
  },
);

const isLocalRow = (row: IProjectComponent | IProject) =>
  row.origin === 'local' || props.project?.origin === 'local';

const handleToggleComponent = (componentHash: string) => {
  emit('toggleComponent', componentHash);
};

const handleOpenComponent = (componentHash: string) => {
  emit('openComponent', componentHash);
};
</script>

<style lang="scss" scoped>
// Рабочая плоскость списка: button+список на --p-surface, без рамки —
// при вложении в другую surface визуально сливается
.list-surface {
  background: var(--p-surface);
}

// Вложенный уровень (задачи компонента) — отступ каскада; подкраску
// вложения даёт родительский блок раскрытого проекта
.component-row__nested {
  padding-left: var(--p-7);
  min-width: 0;

  @media (max-width: 640px) {
    padding-left: var(--p-4);
  }
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

</style>
