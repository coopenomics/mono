# Система инжекта кнопок действий в заголовок

## Описание

Архитектурное решение для динамического добавления кнопок действий в `MainHeader` компонент. Позволяет страницам инжектировать свои главные кнопки действий в заголовок приложения.

## Использование

### В странице/компоненте:

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useHeaderActions } from 'src/shared/hooks';
import { MyActionButton } from 'src/features/MyFeature';

const { registerAction } = useHeaderActions();

onMounted(() => {
  registerAction({
    id: 'my-action',
    component: MyActionButton,
    props: {
      // опциональные пропсы
      variant: 'primary',
    },
    order: 1, // опциональный порядок сортировки
  });
});
</script>
```

### В MainHeader:

```vue
<template lang="pug">
q-header.header
  q-toolbar
    BackButton(v-if='loggedIn')

    // Инжектированные кнопки действий
    template(v-for='action in headerActions', :key='action.id')
      component(:is='action.component', v-bind='action.props')

    q-toolbar-title
      // остальное содержимое
</template>

<script setup lang="ts">
import { useHeaderActionsReader } from 'src/shared/hooks';

const { headerActions } = useHeaderActionsReader();
</script>
```

## API

### `useHeaderActions()`

Основной composable для работы с кнопками действий:

- `registerAction(action: HeaderAction)` - регистрирует новую кнопку
- `unregisterAction(actionId: string)` - удаляет кнопку по ID
- `clearActions()` - очищает все кнопки текущего компонента

### `useHeaderActionsReader()`

Composable только для чтения (используется в MainHeader):

- `headerActions` - реактивный массив зарегистрированных действий

### `HeaderAction`

Интерфейс для описания кнопки действия:

```typescript
interface HeaderAction {
  id: string; // Уникальный идентификатор
  component: Component; // Vue компонент кнопки
  props?: Record<string, any>; // Пропсы для компонента
  order?: number; // Порядок сортировки (по умолчанию 0)
}
```

## Особенности

1. **Автоматическая очистка** - кнопки автоматически удаляются при размонтировании компонента
2. **Сортировка** - кнопки сортируются по полю `order`
3. **Типизация** - полная поддержка TypeScript
4. **Реактивность** - изменения отражаются в реальном времени

## Примеры компонентов для заголовка

### Кнопка добавления пользователя:

```vue
<template lang="pug">
q-btn(
  color='primary',
  stretch,
  :size='isMobile ? "sm" : "md"',
  @click='showDialog = true'
)
  span.q-pr-sm добавить пайщика
  i.fa-solid.fa-plus

AddUserDialog(v-model='showDialog')
</template>
```

### Кнопка создания решения:

```vue
<template lang="pug">
q-btn(
  color='primary',
  stretch,
  :size='isMobile ? "sm" : "md"',
  @click='showDialog = true'
)
  span.q-pr-sm предложить повестку
  i.fa-solid.fa-plus

CreateProjectDialog(v-model='showDialog')
</template>
```

## Преимущества

1. **Централизованный UI** - все главные действия в одном месте
2. **Чистый код** - убирает дублирование кнопок в разных местах
3. **Автоматическое управление** - не требует ручной очистки
4. **Гибкость** - легко добавлять новые типы действий
5. **Типизация** - полная поддержка TypeScript
