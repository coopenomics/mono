<template lang="pug">
.column.flex-1.min-h-0.min-w-0.no-wrap
  router-view
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHeaderActions } from 'src/shared/hooks/useHeaderActions'
import RouteMenuButton from 'src/shared/ui/RouteMenuButton/RouteMenuButton.vue'

// DocumentsPage — shell-страница для 3 подвкладок отчётности. Инжектирует
// 3 кнопки в шапку сайта, переключение — через именованные маршруты
// reports-documents-calendar / -forms / -archive. Рендер содержимого — через
// <router-view>. Паттерн один-в-один как capital/ProjectPage.

const route = useRoute()
const { registerAction, clearActions } = useHeaderActions()

const menuButtons = computed(() => [
  {
    id: 'reports-documents-calendar-menu',
    component: markRaw(RouteMenuButton),
    props: {
      routeName: 'reports-documents-calendar',
      label: 'Календарь',
    },
    order: 1,
  },
  {
    id: 'reports-documents-forms-menu',
    component: markRaw(RouteMenuButton),
    props: {
      routeName: 'reports-documents-forms',
      label: 'Список форм',
    },
    order: 2,
  },
  {
    id: 'reports-documents-archive-menu',
    component: markRaw(RouteMenuButton),
    props: {
      routeName: 'reports-documents-archive',
      label: 'Архив',
    },
    order: 3,
  },
])

function registerAll() {
  menuButtons.value.forEach((b) => registerAction(b))
}

onMounted(() => {
  registerAll()
})

onBeforeUnmount(() => {
  clearActions()
})

// При переходе между своими child-маршрутами подсветка обновляется
// самим RouteMenuButton через route.name; дополнительной регистрации не надо.
// Но если кто-то попадёт на другую страницу (напр. reports-settings),
// clearActions() в onBeforeUnmount shell'а сам всё вычистит.
watch(() => route.name, () => {
  // no-op: оставлено как точка расширения, если понадобится условная регистрация.
})
</script>
